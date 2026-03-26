import { createHash, randomBytes } from "crypto";

export const API_KEY_PREFIX = "aithon_";

export function generatePlainApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString("hex");
}

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function isApiKeyFormat(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length >= API_KEY_PREFIX.length + 16;
}

/** First 16 chars after prefix for UI display */
export function keyPrefixFromPlain(plain: string): string {
  if (!plain.startsWith(API_KEY_PREFIX)) return "unknown";
  const rest = plain.slice(API_KEY_PREFIX.length);
  return API_KEY_PREFIX + rest.slice(0, 8) + "…";
}
