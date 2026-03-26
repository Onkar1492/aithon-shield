import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Do not exit: Vite sometimes logs recoverable issues; exiting kills API + client for everyone.
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Do not run Vite's Connect stack for /api — future Vite versions or plugins must not intercept API paths.
  app.use((req, res, next) => {
    const pathOnly = (req.originalUrl ?? "").split("?")[0] ?? "";
    if (pathOnly.startsWith("/api")) {
      return next();
    }
    return vite.middlewares(req, res, next);
  });

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const pathOnly = url.split("?")[0] ?? url;
    // Never serve SPA HTML for /api — unmatched API routes must return JSON (not <!DOCTYPE>).
    if (pathOnly.startsWith("/api")) {
      res.status(404).json({
        message: "API route not found",
        path: pathOnly,
        hint:
          "No Express handler matched this path. After pulling new code, fully restart the Node dev server (the process running server/index.ts). Open the app on the same port the server prints (GET /api/health shows pid and uptime).",
        code: "API_ROUTE_NOT_REGISTERED_OR_STALE_SERVER",
      });
      return;
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const listenPort = (process.env.PORT || "5001").replace(/[^0-9]/g, "") || "5001";
      template = template.replace(
        "</head>",
        `<meta name="aithon-listen-port" content="${listenPort}" /></head>`,
      );
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (never for /api)
  app.use("*", (req, res) => {
    const pathOnly = (req.originalUrl ?? "").split("?")[0] ?? "";
    if (pathOnly.startsWith("/api")) {
      res.status(404).json({
        message: "API route not found",
        path: pathOnly,
        hint:
          "No Express handler matched. Restart the Node server after deploys; confirm /api/health on this host.",
        code: "API_ROUTE_NOT_REGISTERED_OR_STALE_SERVER",
      });
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
