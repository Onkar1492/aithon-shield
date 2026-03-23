import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { IStorage } from "./storage";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  // Must match comparePassword: same trimming rules whenever we hash
  return await bcrypt.hash(password.trim(), SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const trimmed = password.trim();
  // Prefer trimmed (matches current hashPassword); fall back to raw for accounts created before trimming
  if (trimmed && (await bcrypt.compare(trimmed, hash))) return true;
  if (password.length > 0 && password !== trimmed && (await bcrypt.compare(password, hash))) return true;
  // Allow numeric passwords typed with grouping hyphens (e.g. 987-654-321 vs 987654321)
  if (trimmed.includes("-")) {
    return await bcrypt.compare(trimmed.replace(/-/g, ""), hash);
  }
  return false;
}

export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function createSession(storage: IStorage, userId: string): Promise<string> {
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);
  
  await storage.createSession({
    id: sessionId,
    userId,
    expiresAt,
  });
  
  return sessionId;
}

export async function getSessionUserId(storage: IStorage, sessionId: string): Promise<string | undefined> {
  const session = await storage.getSession(sessionId);
  
  if (!session) {
    return undefined;
  }
  
  // Check if session is expired
  if (new Date() > session.expiresAt) {
    await storage.deleteSession(sessionId);
    return undefined;
  }
  
  return session.userId;
}

export async function deleteSession(storage: IStorage, sessionId: string): Promise<void> {
  await storage.deleteSession(sessionId);
}

// Setup periodic cleanup of expired sessions
export function setupSessionCleanup(storage: IStorage): void {
  // Run cleanup immediately on startup
  storage.cleanupExpiredSessions().catch(console.error);
  
  // Run cleanup every hour
  setInterval(() => {
    storage.cleanupExpiredSessions().catch(console.error);
  }, 60 * 60 * 1000);
}
