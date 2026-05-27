import type { Express, Request } from "express";
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
  explainPdfDocument,
  type AIProvider,
} from "./utils/ai-router";
import { fetchAgricultureData } from "./utils/external-apis";
import { insertUserSchema, insertSearchHistorySchema, insertApiSettingSchema } from "@shared/schema";
import path from "path";
import fs from "fs/promises";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

function sendError(res: any, statusCode: number, message: string, code?: string) {
  return res.status(statusCode).json({ message, ...(code ? { code } : {}) });
}

const CLIENT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || "180000", 10);

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return sendError(res, 400, "Email already registered");
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
    } catch (error: any) {
      sendError(res, 400, error.message || "Signup failed");
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return sendError(res, 401, "Invalid credentials");
      }

      if (!user.isActive) {
        return sendError(res, 403, "Account is deactivated");
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return sendError(res, 401, "Invalid credentials");
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
    } catch (error: any) {
      sendError(res, 500, error.message || "Login failed");
    }
  });

  // User profile routes
  app.get("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
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
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  // Search routes
  app.post("/api/search/query", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { query, provider: rawProvider } = req.body;
      const provider: AIProvider = rawProvider === "openai" ? "openai" : "gemini";
      const startTime = Date.now();

      // Step 1: Extract intent and classify domain
      const [extractedParams, domain] = await Promise.all([
        extractQueryIntent(provider, query),
        classifyDomain(provider, query),
      ]);

      if (domain !== "agriculture") {
        return sendError(res, 400, "Currently only agriculture domain queries are supported");
      }

      // Step 2: Fetch data from multiple sources (FEWSNET timeout won't fail the whole search)
      const [apiResults, userDocuments, userImages] = await Promise.all([
        fetchAgricultureData(extractedParams),
        storage.getUserDocuments(userId),
        storage.getUserImages(userId)
      ]);

      // Step 3: Search in PDFs — returns [{excerpt, filename, citationId}]
      const pdfResults = await searchInDocuments(provider, query, userDocuments);

      // Step 4: Collect image analysis data with citation IDs
      const imageSources: { text: string; citationId: string }[] = [];
      userImages.slice(0, 3).forEach((image, i) => {
        if (image.extractedData) {
          imageSources.push({
            text: image.extractedData,
            citationId: `Image-Q${i + 1}`,
          });
        }
      });

      // Step 5: Generate enterprise-grade structured response
      const structured = await generateAgricultureResponse(
        provider,
        query,
        extractedParams,
        apiResults.map(r => ({ source: r.source, data: r.data })),
        pdfResults,
        imageSources
      );

      // Determine source type
      let sourceType = "";
      if (apiResults.length > 0) sourceType += "API";
      if (pdfResults.length > 0) sourceType += (sourceType ? "+PDF" : "PDF");
      if (imageSources.length > 0) sourceType += (sourceType ? "+Image" : "Image");
      if (!sourceType) sourceType = "None";

      // Save to history
      const history = await storage.createSearchHistory(
        insertSearchHistorySchema.parse({
          userId,
          query,
          extractedParams,
          sourceType,
          results: { answer: structured.answer, structured, apiResults, pdfResults, imageSources },
          agentUsed: "Agriculture",
          executionTime: Date.now() - startTime,
        })
      );

      res.json({
        answer: structured.answer,
        structured,
        provider,
        sourceType,
        extractedParams,
        apiResults: apiResults.map(r => ({ source: r.source, data: r.data })),
        pdfResults,
        imageSources,
        executionTime: Date.now() - startTime,
        historyId: history.id,
      });
    } catch (error: any) {
      const status = error.statusCode || 500;
      sendError(res, status, error.message || "Search failed", error.code);
    }
  });

  app.get("/api/search/history", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const history = await storage.getUserSearchHistory(userId);
      res.json(history);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.delete("/api/search/history/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteSearchHistory(req.params.id);
      res.json({ message: "History entry deleted" });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  // Document routes
  app.post("/api/documents/upload", authMiddleware, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return sendError(res, 400, "No file uploaded");
      }

      const userId = (req as any).user.userId;
      let extractedText: string;

      try {
        extractedText = await extractPdfText(req.file.path);
      } catch (pdfError: any) {
        await deleteFile(req.file.path);
        return sendError(res, pdfError.statusCode || 400, pdfError.message, pdfError.code);
      }

      const document = await storage.createDocument({
        userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        extractedText,
        fileSize: req.file.size,
      });

      const explain = req.body?.explain === "true" || req.body?.explain === true;
      const question = req.body?.question || undefined;

      let explanation: string | undefined;

      if (explain) {
        try {
          explanation = await explainPdfDocument(req.file.originalname, extractedText, question);
          await storage.createSearchHistory(
            insertSearchHistorySchema.parse({
              userId,
              query: question || `Auto-summary: ${req.file.originalname}`,
              extractedParams: {},
              sourceType: "PDF",
              results: { answer: explanation, documentId: document.id },
              agentUsed: "PDFExplain",
              executionTime: 0,
            })
          );
        } catch (explainError: any) {
          console.error("Auto-explain error:", explainError.message);
        }
      }

      res.json({ message: "Document uploaded successfully", document, explanation });
    } catch (error: any) {
      const status = error.statusCode || 500;
      sendError(res, status, error.message, error.code);
    }
  });

  app.post("/api/documents/:id/explain", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const doc = await storage.getDocument(req.params.id);

      if (!doc) {
        return sendError(res, 404, "Document not found");
      }
      if (doc.userId !== userId) {
        return sendError(res, 403, "Access denied");
      }
      if (!doc.extractedText) {
        return sendError(res, 400, "Document has no extractable text");
      }

      const { question, provider: rawProvider } = req.body;
      const provider: AIProvider = rawProvider === "openai" ? "openai" : "gemini";
      const explanation = await explainPdfDocument(provider, doc.filename, doc.extractedText, question);

      const history = await storage.createSearchHistory(
        insertSearchHistorySchema.parse({
          userId,
          query: question || `Explain: ${doc.filename}`,
          extractedParams: {},
          sourceType: "PDF",
          results: { answer: explanation, documentId: doc.id },
          agentUsed: "PDFExplain",
          executionTime: 0,
        })
      );

      res.json({ explanation, historyId: history.id });
    } catch (error: any) {
      const status = error.statusCode || 500;
      sendError(res, status, error.message || "Explain failed", error.code);
    }
  });

  app.get("/api/documents/list", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error: any) {
      sendError(res, 500, error.message);
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
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  // Image routes
  app.post("/api/images/upload", authMiddleware, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return sendError(res, 400, "No file uploaded");
      }

      const userId = (req as any).user.userId;
      const provider: AIProvider = req.body?.provider === "openai" ? "openai" : "gemini";

      const imageBuffer = await fs.readFile(req.file.path);
      const base64Image = imageBuffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      let extractedData: string;
      try {
        extractedData = await analyzeImage(provider, dataUrl);
      } catch (imgError: any) {
        await deleteFile(req.file.path);
        return sendError(res, imgError.statusCode || 500, imgError.message, imgError.code);
      }

      const image = await storage.createImage({
        userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        extractedData,
        fileSize: req.file.size,
      });

      res.json({ message: "Image uploaded successfully", image });
    } catch (error: any) {
      const status = error.statusCode || 500;
      sendError(res, status, error.message, error.code);
    }
  });

  app.get("/api/images/list", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const images = await storage.getUserImages(userId);
      res.json(images);
    } catch (error: any) {
      sendError(res, 500, error.message);
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
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  // Admin routes
  app.get("/api/admin/dashboard", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/analytics", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const analytics = await storage.getQueryAnalytics();
      res.json(analytics);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })));
    } catch (error: any) {
      sendError(res, 500, error.message);
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
    } catch (error: any) {
      sendError(res, 500, error.message);
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
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/documents", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/images", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const images = await storage.getAllImages();
      res.json(images);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/logs", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const logs = await storage.getAllAdminLogs();
      res.json(logs);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/search-history", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const history = await storage.getAllSearchHistory();
      res.json(history);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.get("/api/admin/settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const settings = await storage.getAllApiSettings();
      res.json(settings);
    } catch (error: any) {
      sendError(res, 500, error.message);
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
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  // Notification routes
  app.get("/api/admin/notifications", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.post("/api/admin/notifications/clear", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.clearAllNotifications();
      res.json({ message: "All notifications cleared" });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  app.delete("/api/admin/notifications/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ message: "Notification deleted" });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  // Create user route
  app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return sendError(res, 400, "Email already exists");
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
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  });

  const httpServer = createServer(app);

  httpServer.timeout = CLIENT_TIMEOUT;

  return httpServer;
}
