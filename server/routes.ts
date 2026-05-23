import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateToken, comparePassword, authMiddleware, adminMiddleware } from "./utils/auth";
import { upload, extractPdfText, deleteFile, chunkText, ensureUploadsDir } from "./utils/file-processor";
import {
  extractQueryIntent,
  classifyDomain,
  searchInDocuments,
  searchInChunks,
  analyzeImage,
  generateAgricultureResponse,
  lastUsedProvider,
} from "./utils/openai-service";
import { fetchAgricultureData } from "./utils/external-apis";
import { toHttpError } from "./utils/errors";
import { insertUserSchema, insertSearchHistorySchema, insertApiSettingSchema } from "@shared/schema";
import path from "path";
import fs from "fs/promises";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {

  await ensureUploadsDir();

  // ─── Auth ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) return res.status(400).json({ message: "Email already registered" });

      const user = await storage.createUser(userData);
      const token = generateToken({ userId: user.id, email: user.email, role: user.role });
      res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      if (!user.isActive) return res.status(403).json({ message: "Account is deactivated" });

      const isValid = await comparePassword(password, user.password);
      if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

      const token = generateToken({ userId: user.id, email: user.email, role: user.role });
      res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  // ─── User Profile ─────────────────────────────────────────────────────────
  app.get("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, createdAt: user.createdAt });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Chat Sessions ────────────────────────────────────────────────────────
  app.post("/api/chat/sessions", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { title } = req.body;
      const session = await storage.createChatSession({ userId, title: title || "New Chat" });
      res.json(session);
    } catch (error: any) {
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  app.get("/api/chat/sessions", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const sessions = await storage.getUserChatSessions(userId);
      res.json(sessions);
    } catch (error: any) {
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  app.get("/api/chat/sessions/:id", authMiddleware, async (req, res) => {
    try {
      const session = await storage.getChatSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const messages = await storage.getMessagesBySession(req.params.id);
      res.json({ session, messages });
    } catch (error: any) {
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  app.delete("/api/chat/sessions/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteChatSession(req.params.id);
      res.json({ message: "Session deleted" });
    } catch (error: any) {
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  // ─── Search ───────────────────────────────────────────────────────────────
  app.post("/api/search/query", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { query, sessionId } = req.body;
      const startTime = Date.now();

      // Step 1: Intent + domain in parallel
      const [extractedParams, domain] = await Promise.all([
        extractQueryIntent(query),
        classifyDomain(query),
      ]);

      if (domain !== "agriculture") {
        return res.status(400).json({
          message: "Currently only agriculture domain queries are supported",
          code: "DOMAIN_NOT_SUPPORTED",
        });
      }

      // Step 2: Fetch data sources in parallel
      const [apiResults, userDocuments, userImages, userChunks] = await Promise.all([
        fetchAgricultureData(extractedParams),
        storage.getUserDocuments(userId),
        storage.getUserImages(userId),
        storage.getChunksByUser(userId),
      ]);

      // Step 3: Search docs — prefer chunks if available, fallback to raw text
      let pdfResults: string[] = [];
      if (userChunks.length > 0) {
        pdfResults = await searchInChunks(query, userChunks);
      } else if (userDocuments.length > 0) {
        pdfResults = await searchInDocuments(query, userDocuments);
      }

      // Step 4: Image context
      const imageResults: string[] = [];
      for (const image of userImages.slice(0, 3)) {
        if (image.extractedData) imageResults.push(image.extractedData);
      }

      // Step 5: Generate answer
      const answer = await generateAgricultureResponse(
        query,
        extractedParams,
        apiResults.map((r) => r.data),
        pdfResults,
        imageResults
      );

      const aiProvider = lastUsedProvider;
      const executionTime = Date.now() - startTime;

      let sourceType = "";
      if (apiResults.length > 0) sourceType += "API";
      if (pdfResults.length > 0) sourceType += (sourceType ? "+PDF" : "PDF");
      if (imageResults.length > 0) sourceType += (sourceType ? "+Image" : "Image");
      if (!sourceType) sourceType = "None";

      // Step 6: Persist to search_history
      await storage.createSearchHistory(
        insertSearchHistorySchema.parse({
          userId,
          query,
          extractedParams,
          sourceType,
          results: { answer, apiResults, pdfResults, imageResults },
          agentUsed: `Agriculture/${aiProvider}`,
          executionTime,
        })
      );

      // Step 7: Persist to chat session if provided
      let activeSessionId = sessionId;
      if (activeSessionId) {
        await Promise.all([
          storage.createChatMessage({
            sessionId: activeSessionId,
            role: "user",
            content: query,
            metadata: null,
          }),
          storage.createChatMessage({
            sessionId: activeSessionId,
            role: "assistant",
            content: answer,
            metadata: { apiResults, pdfResults, imageResults, executionTime, aiProvider, sourceType },
          }),
        ]);

        // Update session title on first message
        const messages = await storage.getMessagesBySession(activeSessionId);
        if (messages.length <= 2) {
          const title = query.length > 50 ? query.substring(0, 50) + "..." : query;
          await storage.updateChatSession(activeSessionId, { title });
        }
      }

      res.json({
        answer,
        sourceType,
        extractedParams,
        apiResults: apiResults.map((r) => ({ source: r.source, data: r.data })),
        pdfResults,
        imageResults,
        executionTime,
        aiProvider,
        sessionId: activeSessionId,
      });
    } catch (error: any) {
      console.error("[search] Error:", error);
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  app.get("/api/search/history", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const history = await storage.getUserSearchHistory(userId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/search/history/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteSearchHistory(req.params.id);
      res.json({ message: "History entry deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Documents ────────────────────────────────────────────────────────────
  app.post("/api/documents/upload", authMiddleware, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const userId = (req as any).user.userId;
      const extractedText = await extractPdfText(req.file.path);

      const document = await storage.createDocument({
        userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        extractedText,
        fileSize: req.file.size,
      });

      // Chunk and store in background (don't block response)
      if (extractedText && extractedText.trim().length > 0) {
        const chunks = chunkText(extractedText, 500, 100);
        if (chunks.length > 0) {
          const chunkInserts = chunks.map((c) => ({
            documentId: document.id,
            userId,
            chunkIndex: c.index,
            content: c.content,
            embedding: null as string | null,
          }));
          storage.createDocumentChunks(chunkInserts).catch((err) => {
            console.error("[chunks] Failed to store chunks:", err.message);
          });
        }
      }

      res.json({ message: "Document uploaded successfully", document });
    } catch (error: any) {
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  app.get("/api/documents/list", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", authMiddleware, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (doc) {
        await Promise.all([
          deleteFile(doc.filePath),
          storage.deleteChunksByDocument(req.params.id),
        ]);
        await storage.deleteDocument(req.params.id);
      }
      res.json({ message: "Document deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Images ───────────────────────────────────────────────────────────────
  app.post("/api/images/upload", authMiddleware, upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const userId = (req as any).user.userId;
      const imageBuffer = await fs.readFile(req.file.path);
      const base64Image = imageBuffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      const extractedData = await analyzeImage(dataUrl);

      const image = await storage.createImage({
        userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        extractedData,
        fileSize: req.file.size,
      });

      res.json({ message: "Image uploaded successfully", image });
    } catch (error: any) {
      const err = toHttpError(error);
      res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
  });

  app.get("/api/images/list", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const images = await storage.getUserImages(userId);
      res.json(images);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Admin ────────────────────────────────────────────────────────────────
  app.get("/api/admin/dashboard", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/analytics", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const analytics = await storage.getQueryAnalytics();
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map((u) => ({
        id: u.id, email: u.email, fullName: u.fullName,
        role: u.role, isActive: u.isActive, createdAt: u.createdAt,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existing = await storage.getUserByEmail(userData.email);
      if (existing) return res.status(400).json({ message: "Email already exists" });
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
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/documents", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json(await storage.getAllDocuments());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/images", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json(await storage.getAllImages());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/logs", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json(await storage.getAllAdminLogs());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/search-history", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json(await storage.getAllSearchHistory());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json(await storage.getAllApiSettings());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
        setting = await storage.createApiSetting(insertApiSettingSchema.parse({ keyName, keyValue, isActive }));
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
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/notifications", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json(await storage.getAllNotifications());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/notifications/clear", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.clearAllNotifications();
      res.json({ message: "All notifications cleared" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/notifications/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ message: "Notification deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
