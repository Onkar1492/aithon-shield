import type { IStorage } from "./storage";
import type { ApiKey } from "@shared/schema";
import { getSessionUserId } from "./auth";
import { isApiKeyFormat, hashApiKey } from "./apiKeyService";
import { consumeApiKeyRateLimit } from "./rateLimitMiddleware";

export type RequestApiKey = Pick<ApiKey, "id" | "scopes"> & { keyHash: string };

declare global {
  namespace Express {
    interface Request {
      /** Set when the request was authenticated with an API key (not session). */
      apiKey?: RequestApiKey;
    }
  }
}

export function parseApiKeyScopes(scopesCsv: string): Set<string> {
  return new Set(
    scopesCsv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** `admin` on the key grants read and write for API routes. */
export function apiKeyHasScope(granted: Set<string>, scope: "read" | "write" | "admin"): boolean {
  if (granted.has("admin")) return true;
  return granted.has(scope);
}

function enforceApiKeyScopesForRequest(req: any, res: any): boolean {
  const ak = req.apiKey as RequestApiKey | undefined;
  if (!ak) return true;
  const granted = parseApiKeyScopes(ak.scopes);
  const method = req.method as string;
  if (method === "GET" || method === "HEAD") {
    if (!apiKeyHasScope(granted, "read")) {
      res.status(403).json({
        message: "Insufficient API key scope",
        code: "INSUFFICIENT_SCOPE",
        required: "read",
      });
      return false;
    }
    return true;
  }
  if (!apiKeyHasScope(granted, "write")) {
    res.status(403).json({
      message: "Insufficient API key scope",
      code: "INSUFFICIENT_SCOPE",
      required: "write",
    });
    return false;
  }
  return true;
}

async function attachUserFromApiKey(
  storage: IStorage,
  keyHash: string,
  req: any,
  res: any,
): Promise<boolean> {
  const row = await storage.getApiKeyRowByHash(keyHash);
  if (!row) {
    res.status(401).json({ message: "Invalid API key" });
    return false;
  }
  let user = await storage.getUser(row.userId);
  if (!user) {
    res.status(401).json({ message: "Invalid API key" });
    return false;
  }
  try {
    await consumeApiKeyRateLimit(keyHash, res);
  } catch {
    res.status(429).json({ message: "Too many requests", code: "RATE_LIMIT_API_KEY" });
    return false;
  }
  void storage.touchApiKeyLastUsed(keyHash);
  if (!user.defaultOrganizationId) {
    await storage.ensurePersonalOrganization(user.id, user.username);
    const refreshed = await storage.getUser(user.id);
    if (refreshed) user = refreshed;
  }
  req.user = user;
  req.apiKey = { id: row.id, scopes: row.scopes, keyHash };
  if (!enforceApiKeyScopesForRequest(req, res)) {
    return false;
  }
  return true;
}

export function buildAuthMiddleware(storage: IStorage) {
  const requireSessionAuth = async (req: any, res: any, next: any) => {
    req.apiKey = undefined;
    const sessionId = req.cookies?.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = await getSessionUserId(storage, sessionId);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    let user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!user.defaultOrganizationId) {
      await storage.ensurePersonalOrganization(user.id, user.username);
      const refreshed = await storage.getUser(user.id);
      if (refreshed) user = refreshed;
    }
    req.user = user;
    next();
  };

  // Session cookie OR Bearer / X-API-Key with aithon_* key (for agents, Claude, Cursor MCP HTTP, etc.)
  const requireAuth = async (req: any, res: any, next: any) => {
    req.apiKey = undefined;
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (isApiKeyFormat(token)) {
        const h = hashApiKey(token);
        const ok = await attachUserFromApiKey(storage, h, req, res);
        if (ok) return next();
        return;
      }
    }

    const xKey = req.headers["x-api-key"];
    if (typeof xKey === "string" && isApiKeyFormat(xKey)) {
      const h = hashApiKey(xKey);
      const ok = await attachUserFromApiKey(storage, h, req, res);
      if (ok) return next();
      return;
    }

    const sessionId = req.cookies?.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = await getSessionUserId(storage, sessionId);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    let user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!user.defaultOrganizationId) {
      await storage.ensurePersonalOrganization(user.id, user.username);
      const refreshed = await storage.getUser(user.id);
      if (refreshed) user = refreshed;
    }
    req.user = user;
    next();
  };

  return { requireAuth, requireSessionAuth };
}
