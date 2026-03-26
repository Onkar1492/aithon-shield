import type { Request, Response, NextFunction } from "express";
import { RateLimiterMemory, type RateLimiterRes } from "rate-limiter-flexible";
import { isDemoMode } from "./demoMode";

const globalPerMin = parseInt(process.env.AITHON_RATE_LIMIT_GLOBAL_PER_MIN ?? "300", 10);
const authStrictPoints = parseInt(process.env.AITHON_RATE_LIMIT_AUTH_STRICT_POINTS ?? "15", 10);
const authStrictDurationSec = parseInt(process.env.AITHON_RATE_LIMIT_AUTH_STRICT_WINDOW_SEC ?? "900", 10);
const apiKeyPerMin = parseInt(process.env.AITHON_RATE_LIMIT_API_KEY_PER_MIN ?? "60", 10);

const GLOBAL_LIMIT_POINTS = Number.isFinite(globalPerMin) && globalPerMin > 0 ? globalPerMin : 300;
const AUTH_STRICT_LIMIT_POINTS = Number.isFinite(authStrictPoints) && authStrictPoints > 0 ? authStrictPoints : 15;
const API_KEY_LIMIT_POINTS = Number.isFinite(apiKeyPerMin) && apiKeyPerMin > 0 ? apiKeyPerMin : 60;

const globalLimiter = new RateLimiterMemory({
  points: GLOBAL_LIMIT_POINTS,
  duration: 60,
});

const authStrictLimiter = new RateLimiterMemory({
  points: AUTH_STRICT_LIMIT_POINTS,
  duration: Number.isFinite(authStrictDurationSec) && authStrictDurationSec > 0 ? authStrictDurationSec : 900,
});

const apiKeyLimiter = new RateLimiterMemory({
  points: API_KEY_LIMIT_POINTS,
  duration: 60,
});

export function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  const raw = req.socket?.remoteAddress ?? req.ip;
  return typeof raw === "string" && raw.length > 0 ? raw : "unknown";
}

function setRateLimitHeaders(res: Response, limiterResult: RateLimiterRes, limitPoints: number): void {
  res.setHeader("X-RateLimit-Limit", String(limitPoints));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limiterResult.remainingPoints ?? 0)));
  const resetMs = Date.now() + (limiterResult.msBeforeNext ?? 0);
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetMs / 1000)));
}

/**
 * Broad protection for all /api traffic (by IP). Skipped in demo mode and for /api/health.
 */
export function apiGlobalRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isDemoMode() || process.env.NODE_ENV === "development") {
    return next();
  }
  if (!req.path.startsWith("/api") || req.path === "/api/health") {
    return next();
  }
  if (req.method === "OPTIONS") {
    return next();
  }
  const key = `ip:${getClientIp(req)}`;
  const limitPoints = GLOBAL_LIMIT_POINTS;
  globalLimiter
    .consume(key, 1)
    .then((r) => {
      setRateLimitHeaders(res, r, limitPoints);
      next();
    })
    .catch((rej: RateLimiterRes) => {
      setRateLimitHeaders(res, rej, limitPoints);
      const retrySec = Math.max(1, Math.ceil((rej.msBeforeNext ?? 1000) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({ message: "Too many requests", code: "RATE_LIMIT" });
    });
}

/**
 * Stricter limit for login and signup (credential stuffing / abuse).
 */
export function authStrictRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isDemoMode()) {
    return next();
  }
  const key = `auth:${getClientIp(req)}`;
  const limitPoints = AUTH_STRICT_LIMIT_POINTS;
  authStrictLimiter
    .consume(key, 1)
    .then((r) => {
      setRateLimitHeaders(res, r, limitPoints);
      next();
    })
    .catch((rej: RateLimiterRes) => {
      setRateLimitHeaders(res, rej, limitPoints);
      const retrySec = Math.max(1, Math.ceil((rej.msBeforeNext ?? 1000) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({ message: "Too many authentication attempts", code: "RATE_LIMIT_AUTH" });
    });
}

/**
 * Per API key hash — call after the key is validated.
 */
export async function consumeApiKeyRateLimit(keyHash: string, res: Response): Promise<void> {
  if (isDemoMode()) {
    return;
  }
  const key = `ak:${keyHash}`;
  const limitPoints = API_KEY_LIMIT_POINTS;
  try {
    const r = await apiKeyLimiter.consume(key, 1);
    setRateLimitHeaders(res, r, limitPoints);
  } catch (rej) {
    const rejRes = rej as RateLimiterRes;
    setRateLimitHeaders(res, rejRes, limitPoints);
    const retrySec = Math.max(1, Math.ceil((rejRes.msBeforeNext ?? 1000) / 1000));
    res.setHeader("Retry-After", String(retrySec));
    throw Object.assign(new Error("RATE_LIMIT_API_KEY"), { status: 429 });
  }
}
