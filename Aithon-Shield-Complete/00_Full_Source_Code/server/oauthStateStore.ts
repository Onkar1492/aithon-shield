import { randomBytes } from "crypto";

type PendingOAuth = { userId: string; provider: "github" | "gitlab"; createdAt: number };

const store = new Map<string, PendingOAuth>();
const TTL_MS = 10 * 60 * 1000;

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.createdAt > TTL_MS) store.delete(k);
  }
}

export function createOAuthState(userId: string, provider: "github" | "gitlab"): string {
  prune();
  const state = randomBytes(24).toString("hex");
  store.set(state, { userId, provider, createdAt: Date.now() });
  return state;
}

export function consumeOAuthState(state: string | undefined): PendingOAuth | undefined {
  if (!state) return undefined;
  prune();
  const p = store.get(state);
  if (p) store.delete(state);
  return p;
}
