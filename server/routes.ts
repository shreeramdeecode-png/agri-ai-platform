import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateToken, comparePassword, authMiddleware, adminMiddleware } from "./utils/auth";
import { upload, extractPdfText, deleteFile } from "./utils/file-processor";
import {
  extractQueryIntent,
  classifyDomain,
  searchInDocuments,
  analyzeImage,
  generateAgricultureResponse,
  analyzePdfDocument,
  askAboutDocument,
  askAboutImage,
  withTimeout,
} from "./utils/openai-service";
import { fetchAgricultureData } from "./utils/external-apis";
import { insertUserSchema, insertSearchHistorySchema, insertApiSettingSchema } from "@shared/schema";
import { stripFollowUpQuery, normalizeAnswerText } from "@shared/market";
import { parseResponseStyle } from "@shared/query-style";
import { AppError, logRouteError, sendError } from "./utils/errors";
import path from "path";
import fs from "fs/promises";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser(userData);
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  // User profile routes
  app.get("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.put("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { fullName, password } = req.body;

      const updates: any = {};
      if (fullName) updates.fullName = fullName;
      if (password) updates.password = password;

      const user = await storage.updateUser(userId, updates);
      res.json({ message: "Profile updated successfully", user });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Search routes
  // Bump this string whenever the response-shaping logic changes so that old
  // cached results are automatically ignored rather than served stale.
  const CACHE_VERSION = "v13";

  app.post("/api/search/query", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { priorContext } = req.body;
      const query = stripFollowUpQuery(String(req.body.query || ""));
      const { style: responseStyle, coreQuery } = parseResponseStyle(query);

      if (!query.trim()) {
        return res.status(400).json({ message: "Query is required" });
      }

      const startTime = Date.now();

      // Check cache first — same query by this user in the last 24 hours.
      // Only use the cached entry if it was saved with the current CACHE_VERSION;
      // older entries (with stale market data, unfiltered images, etc.) are ignored.
      const cached = await storage.findCachedSearch(userId, query);
      if (cached && cached.results) {
        const cachedResults = cached.results as any;
        if (cachedResults.cacheVersion === CACHE_VERSION) {
          return res.json({
            ...(typeof cachedResults === "object" ? cachedResults : {}),
            answer: cachedResults.answer,
            responseStyle: cachedResults.responseStyle ?? responseStyle,
            sourceType: cached.sourceType,
            extractedParams: cached.extractedParams,
            executionTime: cached.executionTime,
            cached: true,
            cachedAt: cached.createdAt,
          });
        }
      }

      // Extract intent and classify domain in parallel (use core query without style phrases)
      const [extractedParams, domain] = await Promise.all([
        extractQueryIntent(coreQuery),
        classifyDomain(coreQuery),
      ]);

      if (domain !== "agriculture") {
        throw new AppError(
          400,
          "Currently only agriculture queries are supported. Try crops, prices, food security, soil, or farming practices.",
          "DOMAIN_NOT_SUPPORTED",
        );
      }

      // Only fetch market data when ALL THREE conditions are true:
      // 1. Gemini classified intent as price or food_security
      // 2. A specific crop or country was named
      // 3. The raw query actually contains a price/market keyword (failsafe against mis-classification)
      const PRICE_KEYWORDS = /\b(prices?|costs?|rates?|market|how much|ksh|usd|inr|per kg|per ton|per tonne|afford|cheap|expensive|value|worth)\b/i;
      const useAllSources = responseStyle === "brief" || responseStyle === "one-word";
      const needsMarketData = useAllSources
        ? extractedParams.crop != null || extractedParams.country != null
        : (extractedParams.intent === "price" || extractedParams.intent === "food_security") &&
          (extractedParams.crop != null || extractedParams.country != null) &&
          PRICE_KEYWORDS.test(coreQuery);

      // Fetch documents/images always; market API only when relevant
      const [userDocuments, userImages] = await Promise.all([
        storage.getUserDocuments(userId),
        storage.getUserImages(userId),
      ]);

      // Run API fetch + PDF search in parallel for speed
      const STOP_WORDS = new Set(["the","a","an","is","in","of","to","and","or","for","on","with","that","this","are","it","be","from","by","at","which","what","how","do","does","can","help","about","more","some","have","has"]);
      const queryKeywords = coreQuery
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

      const [apiResultsRaw, pdfResults] = await Promise.all([
        needsMarketData
          ? withTimeout(fetchAgricultureData(extractedParams, { priceOnly: true }), 50000, "Agriculture API fetch")
          : Promise.resolve([]),
        userDocuments.length > 0
          ? withTimeout(searchInDocuments(coreQuery, userDocuments), 30000, "Document search")
          : Promise.resolve([]),
      ]);

      const apiResults = apiResultsRaw.filter(
        (r) => r.data?.currentPrice != null
      );

      // Filter images by keyword relevance
      const imageResults: string[] = userImages
        .filter((img) => {
          if (!img.extractedData) return false;
          if (useAllSources || queryKeywords.length === 0) return true;
          const imgText = img.extractedData.toLowerCase();
          return queryKeywords.some((kw) => imgText.includes(kw));
        })
        .slice(0, useAllSources ? 5 : 3)
        .map((img) => img.extractedData as string);

      console.log(
        `[Search] pdfs=${pdfResults.length} images=${imageResults.length} api=${apiResults.length}`
      );

      // Generate comprehensive AI response (use all available sources together)
      const answer = await withTimeout(
        generateAgricultureResponse(
          query,
          extractedParams,
          apiResults.map((r) => r.data),
          pdfResults,
          imageResults,
          typeof priorContext === "string" ? priorContext : undefined,
          responseStyle
        ),
        35000,
        "Response generation"
      );

      let finalAnswer = normalizeAnswerText(answer);
      if (!/Source:/i.test(finalAnswer)) {
        const sources: string[] = [];
        if (pdfResults.length > 0) {
          const name = pdfResults[0].match(/^\[SOURCE_DOCUMENT: (.+?)\]/)?.[1];
          if (name) sources.push(name);
        }
        if (imageResults.length > 0) sources.push("Image Data");
        if (apiResults.length > 0) sources.push("Live Market API Data");
        if (sources.length > 0) {
          finalAnswer = finalAnswer + `\n\nSource: ${sources.join("; ")}`;
        }
      }

      let sourceType = "";
      if (apiResults.length > 0) sourceType += "API";
      if (pdfResults.length > 0) sourceType += sourceType ? "+PDF" : "PDF";
      if (imageResults.length > 0) sourceType += sourceType ? "+Image" : "Image";
      if (!sourceType) sourceType = "None";

      const responsePayload = {
        cacheVersion: CACHE_VERSION,
        answer: finalAnswer,
        responseStyle,
        apiResults: apiResults.map((r) => ({ source: r.source, data: r.data })),
        pdfResults,
        imageResults,
      };

      // Save to history
      await storage.createSearchHistory(
        insertSearchHistorySchema.parse({
          userId,
          query,
          extractedParams,
          sourceType,
          results: responsePayload,
          agentUsed: "Agriculture",
          executionTime: Date.now() - startTime,
        })
      );

      res.json({
        ...responsePayload,
        sourceType,
        extractedParams,
        executionTime: Date.now() - startTime,
        cached: false,
      });
    } catch (error) {
      logRouteError("Search", error);
      sendError(res, error);
    }
  });

  app.get("/api/search/history", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const history = await storage.getUserSearchHistory(userId);
      res.json(history);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/search/history/clear-all", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const deleted = await storage.deleteAllUserSearchHistory(userId);
      res.json({ message: "All search history cleared", deleted });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/search/history/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      if (id === "clear" || id === "clear-all") {
        return res.status(404).json({ message: "Not found" });
      }
      const userId = (req as any).user.userId;
      const history = await storage.getUserSearchHistory(userId);
      const entry = history.find((h) => h.id === id);
      if (!entry) {
        return res.status(404).json({ message: "History entry not found" });
      }
      await storage.deleteSearchHistory(id);
      res.json({ message: "History entry deleted" });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Document routes
  app.post("/api/documents/upload", authMiddleware, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (req.file.mimetype !== "application/pdf") {
        await deleteFile(req.file.path);
        return res.status(400).json({ message: "Only PDF files are supported for document upload" });
      }

      const userId = (req as any).user.userId;
      const extractedText = await extractPdfText(req.file.path);

      if (!extractedText || extractedText.trim().length < 10) {
        return res.status(400).json({
          message: "Could not extract text from this PDF. The file may be scanned or image-based.",
        });
      }

      // Generate AI summary of the document
      const summary = await withTimeout(
        analyzePdfDocument(extractedText, req.file.originalname),
        35000,
        "PDF analysis"
      );

      const document = await storage.createDocument({
        userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        extractedText,
        fileSize: req.file.size,
      });

      res.json({
        message: "Document uploaded and analyzed successfully",
        document,
        summary,
      });
    } catch (error) {
      logRouteError("Document upload", error);
      if (req.file?.path) {
        await deleteFile(req.file.path).catch(() => {});
      }
      sendError(res, error);
    }
  });

  // Ask a question about a specific document
  app.post("/api/documents/:id/ask", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { question } = req.body;

      if (!question || !question.trim()) {
        return res.status(400).json({ message: "Question is required" });
      }

      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (doc.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!doc.extractedText) {
        return res.status(400).json({ message: "No text content available in this document" });
      }

      const answer = await withTimeout(
        askAboutDocument(doc.extractedText, doc.filename, question),
        30000,
        "Document Q&A"
      );

      res.json({ answer, documentName: doc.filename });
    } catch (error) {
      logRouteError("Document ask", error);
      sendError(res, error);
    }
  });

  app.get("/api/documents/list", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/documents/:id", authMiddleware, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (doc) {
        await deleteFile(doc.filePath);
        await storage.deleteDocument(req.params.id);
      }
      res.json({ message: "Document deleted" });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Image routes
  app.post("/api/images/upload", authMiddleware, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = (req as any).user.userId;

      const imageBuffer = await fs.readFile(req.file.path);
      const base64Image = imageBuffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      const extractedData = await withTimeout(
        analyzeImage(dataUrl),
        30000,
        "Image analysis"
      );

      const image = await storage.createImage({
        userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        extractedData,
        fileSize: req.file.size,
      });

      res.json({ message: "Image uploaded and analyzed successfully", image, analysis: extractedData });
    } catch (error) {
      logRouteError("Image upload", error);
      if (req.file?.path) {
        await deleteFile(req.file.path).catch(() => {});
      }
      sendError(res, error);
    }
  });

  // Ask a question about a specific image
  app.post("/api/images/:id/ask", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { question } = req.body;

      if (!question || !question.trim()) {
        return res.status(400).json({ message: "Question is required" });
      }

      const img = await storage.getImage(req.params.id);
      if (!img) {
        return res.status(404).json({ message: "Image not found" });
      }

      if (img.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const imageBuffer = await fs.readFile(img.filePath);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = img.filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const answer = await withTimeout(
        askAboutImage(dataUrl, img.filename, question),
        30000,
        "Image Q&A"
      );

      res.json({ answer, imageName: img.filename });
    } catch (error) {
      logRouteError("Image ask", error);
      sendError(res, error);
    }
  });

  app.get("/api/images/list", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const images = await storage.getUserImages(userId);
      res.json(images);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/images/:id", authMiddleware, async (req, res) => {
    try {
      const img = await storage.getImage(req.params.id);
      if (img) {
        await deleteFile(img.filePath);
        await storage.deleteImage(req.params.id);
      }
      res.json({ message: "Image deleted" });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Admin routes
  app.get("/api/admin/dashboard", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/analytics", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const analytics = await storage.getQueryAnalytics();
      res.json(analytics);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
        }))
      );
    } catch (error) {
      sendError(res, error);
    }
  });

  app.put("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { isActive } = req.body;
      const user = await storage.updateUser(req.params.id, { isActive });

      await storage.createAdminLog({
        adminId: (req as any).user.userId,
        action: isActive ? "activate_user" : "deactivate_user",
        targetEntity: "user",
        targetId: req.params.id,
        details: { isActive },
      });

      res.json({ message: "User updated", user });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);

      await storage.createAdminLog({
        adminId: (req as any).user.userId,
        action: "delete_user",
        targetEntity: "user",
        targetId: req.params.id,
        details: {},
      });

      res.json({ message: "User deleted" });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);

      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser(userData);

      await storage.createAdminLog({
        adminId: (req as any).user.userId,
        action: "create_user",
        targetEntity: "user",
        targetId: user.id,
        details: { email: user.email },
      });

      res.json({ message: "User created", user });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/documents", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/images", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const images = await storage.getAllImages();
      res.json(images);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/logs", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const logs = await storage.getAllAdminLogs();
      res.json(logs);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/search-history", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const history = await storage.getAllSearchHistory();
      res.json(history);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/admin/settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const settings = await storage.getAllApiSettings();
      res.json(settings);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.put("/api/admin/settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { keyName, keyValue, isActive } = req.body;

      const existing = await storage.getApiSetting(keyName);
      let setting;

      if (existing) {
        setting = await storage.updateApiSetting(keyName, { keyValue, isActive });
      } else {
        setting = await storage.createApiSetting(
          insertApiSettingSchema.parse({ keyName, keyValue, isActive })
        );
      }

      await storage.createAdminLog({
        adminId: (req as any).user.userId,
        action: "update_setting",
        targetEntity: "api_setting",
        targetId: setting?.id,
        details: { keyName },
      });

      res.json({ message: "Setting updated", setting });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Notification routes
  app.get("/api/admin/notifications", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/admin/notifications/clear", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.clearAllNotifications();
      res.json({ message: "All notifications cleared" });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete("/api/admin/notifications/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ message: "Notification deleted" });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Unknown API routes (must be after all /api handlers)
  app.all("/api/*", (_req, res) => {
    sendError(res, new AppError(404, "API endpoint not found.", "NOT_FOUND"));
  });

  // Multer and other middleware errors forwarded via next(err)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    logRouteError(`${req.method} ${req.path}`, err);
    sendError(res, err);
  });

  const httpServer = createServer(app);
  return httpServer;
}
