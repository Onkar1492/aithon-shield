import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { ensureDevSeedUsers } from "./devSeedUsers";
import { isDemoMode } from "./demoMode";
import { apiGlobalRateLimitMiddleware } from "./rateLimitMiddleware";
import { startScheduledScanEngine } from "./scheduledScanEngine";

const app = express();

const serverBootIso = new Date().toISOString();

app.get("/api/health", (_req, res) => {
  const port = parseInt(process.env.PORT || "5001", 10);
  res.json({
    ok: true,
    demoMode: isDemoMode(),
    port,
    nodeEnv: process.env.NODE_ENV ?? null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: serverBootIso,
  });
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(apiGlobalRateLimitMiddleware);

// Optional CORS for /api when browser tools call the API with Bearer keys (comma-separated origins)
const agentCorsOrigins = process.env.AGENT_CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
if (agentCorsOrigins && agentCorsOrigins.length > 0) {
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
      return next();
    }
    const origin = req.headers.origin as string | undefined;
    if (origin && agentCorsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });
}

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Prevent information leakage
  res.removeHeader('X-Powered-By');
  
  next();
});

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  // Other ports are firewalled. Default to 5001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5001', 10);
  server.listen(port, "0.0.0.0", async () => {
    log(`serving on port ${port}`);
    log(`health: http://127.0.0.1:${port}/api/health  ·  app: http://127.0.0.1:${port}/`);
    if (isDemoMode()) {
      log("AITHON_DEMO_MODE is on: signup disabled; API keys allowed for local testing; scan targets unrestricted (see /api/app-config).");
    }

    try {
      await ensureDevSeedUsers(storage);
    } catch (error) {
      log(`Dev seed users skipped or failed: ${error}`);
    }

    try {
      startScheduledScanEngine();
    } catch (error) {
      log(`Scheduled scan engine failed to start: ${error}`);
    }

    if (isDemoMode()) {
      log("Demo login: demo@aithonshield.local / DemoMode1! (also milan_demo, samuel_demo if seeded)");
    }
    
    // Run cleanup on server startup
    try {
      await storage.cleanupOldArchivedFindings();
      log("Initial cleanup of old archived findings completed");
    } catch (error) {
      log(`Error during initial cleanup: ${error}`);
    }
    
    // Recalculate priority scores for all findings
    try {
      await storage.recalculatePriorityScores();
      log("Priority scores recalculated for all findings");
    } catch (error) {
      log(`Error during priority score recalculation: ${error}`);
    }
    
    // Schedule cleanup to run every 24 hours
    setInterval(async () => {
      try {
        await storage.cleanupOldArchivedFindings();
        log("Periodic cleanup of old archived findings completed");
      } catch (error) {
        log(`Error during periodic cleanup: ${error}`);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  });
})();
