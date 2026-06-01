import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { logRouteError, sendError } from "./utils/errors";

async function seedDatabase() {
  try {
    const adminEmail = "admin@agrisearch.com";
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      await storage.createUser({
        email: adminEmail,
        password: "admin123",
        fullName: "Admin User",
        role: "admin",
        isActive: true,
      });
      log("Admin user created");
    }

    const userEmail = "user@agrisearch.com";
    const existingUser = await storage.getUserByEmail(userEmail);
    
    if (!existingUser) {
      await storage.createUser({
        email: userEmail,
        password: "user123",
        fullName: "Test User",
        role: "user",
        isActive: true,
      });
      log("Test user created");
    }
  } catch (error) {
    console.error("Database seeding error:", error);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const geminiKeyLen = process.env.GOOGLE_API_KEY?.trim().length ?? 0;
  if (geminiKeyLen === 0) {
    console.warn("[startup] GOOGLE_API_KEY is missing — search and AI uploads will fail.");
  } else {
    log(`Gemini configured (key length ${geminiKeyLen}, model ${process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash"})`);
  }

  await seedDatabase();
  const server = await registerRoutes(app);

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logRouteError(`${req.method} ${req.path}`, err);
    sendError(res, err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
