import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateToken, comparePassword, authMiddleware, adminMiddleware } from "./utils/auth";
import { upload, extractPdfText, deleteFile } from "./utils/file-processor";
import {
  extractQueryIntent,
  classifyDomain,
  searchInDocuments,
  searchInImages,
  analyzeImage,
  generateGeneralAnswer,
  generateSourceAnswer,
  parseTaggedSource,
  isInsufficientSourceAnswer,
  analyzePdfDocument,
  askAboutDocument,
  askAboutImage,
  withTimeout,
} from "./utils/openai-service";
import { fetchAgricultureData, fetchFromHDXFoodSecurity, type ExternalApiResult } from "./utils/external-apis";
import type { SourceAnswerBlock } from "@shared/search-response";
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
  const CACHE_VERSION = "v18";

  function isUsefulApiResult(r: ExternalApiResult): boolean {
    const d = r.data;
    if (!d || d.error) return false;
    if (d.currentPrice != null) return true;
    if (d.ipcPhase != null && d.ipcPhase !== "Unknown") return true;
    if (typeof d.populationInNeed === "number") return true;
    return false;
  }

  async function fetchRelevantApiData(
    extractedParams: Awaited<ReturnType<typeof extractQueryIntent>>,
    coreQuery: string,
    useAllSources: boolean
  ): Promise<ExternalApiResult[]> {
    const PRICE_KEYWORDS =
      /\b(prices?|costs?|rates?|market|how much|ksh|usd|inr|per kg|per ton|per tonne|afford|cheap|expensive|value|worth)\b/i;

    const hasLocation = extractedParams.crop != null || extractedParams.country != null;
    const wantsFoodSecurity =
      extractedParams.intent === "food_security" && extractedParams.country != null;

    const wantsPrice = useAllSources
      ? hasLocation
      : (extractedParams.intent === "price" ||
          (extractedParams.intent === "food_security" && PRICE_KEYWORDS.test(coreQuery))) &&
        hasLocation;

    const tasks: Promise<ExternalApiResult[]>[] = [];

    if (wantsPrice) {
      tasks.push(
        fetchAgricultureData(extractedParams, { priceOnly: true }).catch(() => [] as ExternalApiResult[])
      );
    }
    if (wantsFoodSecurity) {
      tasks.push(
        fetchFromHDXFoodSecurity(extractedParams).then((r) => (r ? [r] : []))
      );
    }

    if (tasks.length === 0) return [];

    const batches = await Promise.all(tasks);
    const merged = batches.flat();
    const seen = new Set<string>();
    return merged.filter((r) => {
      const key = `${r.source}:${r.data?.country ?? ""}:${r.data?.crop ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return isUsefulApiResult(r);
    });
  }

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
            generalAnswer: cachedResults.generalAnswer ?? cachedResults.answer,
            documentAnswers: cachedResults.documentAnswers,
            imageAnswers: cachedResults.imageAnswers,
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

      const useAllSources = responseStyle === "brief" || responseStyle === "one-word";

      const [userDocuments, userImages] = await Promise.all([
        storage.getUserDocuments(userId),
        storage.getUserImages(userId),
      ]);

      const [apiResults, pdfResults, imageResults] = await Promise.all([
        withTimeout(fetchRelevantApiData(extractedParams, coreQuery, useAllSources), 50000, "Agriculture API fetch"),
        userDocuments.length > 0
          ? withTimeout(searchInDocuments(coreQuery, userDocuments), 30000, "Document search")
          : Promise.resolve([]),
        userImages.length > 0
          ? withTimeout(searchInImages(coreQuery, userImages), 30000, "Image search")
          : Promise.resolve([]),
      ]);

      console.log(
        `[Search] pdfs=${pdfResults.length} images=${imageResults.length} api=${apiResults.length}`
      );

      const prior =
        typeof priorContext === "string" ? priorContext : undefined;

      const hasApiHits = apiResults.length > 0;

      const docAnswerPromises = pdfResults.map((entry) =>
        withTimeout(generateSourceAnswer(query, entry, "document", responseStyle), 30000, "Document answer")
      );
      const imgAnswerPromises = imageResults.map((entry) =>
        withTimeout(generateSourceAnswer(query, entry, "image", responseStyle), 30000, "Image answer")
      );

      const [generalRaw, ...sourceAnswers] = await Promise.all([
        withTimeout(
          generateGeneralAnswer(
            query,
            extractedParams,
            apiResults.map((r) => r.data),
            prior,
            responseStyle,
            { briefBecauseFiles: false }
          ),
          35000,
          "General answer"
        ),
        ...docAnswerPromises,
        ...imgAnswerPromises,
      ]);

      let generalAnswer = normalizeAnswerText(generalRaw);
      if (generalAnswer && !/Source:/i.test(generalAnswer)) {
        const apiLabels = apiResults.map((r) => r.source).filter(Boolean);
        const suffix =
          apiLabels.length > 0
            ? `${apiLabels.join("; ")}; General Knowledge`
            : "General Knowledge";
        generalAnswer = `${generalAnswer}\n\nSource: ${suffix}`;
      }

      const documentAnswers: SourceAnswerBlock[] = [];
      pdfResults.forEach((entry, i) => {
        const text = sourceAnswers[i];
        if (!text || isInsufficientSourceAnswer(text)) return;
        const parsed = parseTaggedSource(entry, "document");
        if (parsed) {
          documentAnswers.push({
            filename: parsed.filename,
            content: normalizeAnswerText(text),
          });
        }
      });

      const imageAnswers: SourceAnswerBlock[] = [];
      const seenImageNames = new Set<string>();
      imageResults.forEach((entry, i) => {
        const text = sourceAnswers[pdfResults.length + i];
        if (!text || isInsufficientSourceAnswer(text)) return;
        const parsed = parseTaggedSource(entry, "image");
        if (parsed && !seenImageNames.has(parsed.filename)) {
          seenImageNames.add(parsed.filename);
          imageAnswers.push({
            filename: parsed.filename,
            content: normalizeAnswerText(text),
          });
        }
      });

      const hasUsefulFileAnswers = documentAnswers.length > 0 || imageAnswers.length > 0;
      const omitGeneral =
        hasUsefulFileAnswers &&
        !hasApiHits &&
        extractedParams.intent !== "price" &&
        extractedParams.intent !== "food_security";

      const sourceTypeParts: string[] = [];
      if (apiResults.length > 0) sourceTypeParts.push("API");
      if (!omitGeneral) sourceTypeParts.push("GK");
      if (pdfResults.length > 0) sourceTypeParts.push("PDF");
      if (imageResults.length > 0) sourceTypeParts.push("Image");
      const sourceType = sourceTypeParts.join("+");

      const responsePayload = {
        cacheVersion: CACHE_VERSION,
        generalAnswer,
        omitGeneral: omitGeneral ? true : undefined,
        answer: omitGeneral
          ? documentAnswers[0]?.content || imageAnswers[0]?.content || generalAnswer
          : generalAnswer,
        documentAnswers: documentAnswers.length > 0 ? documentAnswers : undefined,
        imageAnswers: imageAnswers.length > 0 ? imageAnswers : undefined,
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
        analysisSummary: summary,
        fileSize: req.file.size,
      });

      res.json({
        message: "Document uploaded and analyzed successfully",
        document,
        summary,
        analysis: summary,
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
        analyzeImage(dataUrl, { filename: req.file.originalname, catalog: true }),
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
