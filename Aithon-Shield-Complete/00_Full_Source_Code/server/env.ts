/**
 * Production-oriented env helpers (session cookies, startup validation).
 * Keep this module free of heavy imports so it can load early from `db.ts`.
 */

export type SessionCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: string;
};

/**
 * Session cookie flags. In production, `Secure` defaults to true (HTTPS).
 * For HTTP-only deployments (e.g. local Docker on http://localhost), set `COOKIE_SECURE=false`.
 */
export function getSessionCookieOptions(): SessionCookieOptions {
  const secure =
    typeof process.env.COOKIE_SECURE === "string"
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

/**
 * Log Stripe billing gaps in production (do not crash — checkout may be intentionally off).
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const sk = process.env.STRIPE_SECRET_KEY || process.env.TESTING_STRIPE_SECRET_KEY;
  if (sk && (!process.env.STRIPE_PRICE_STARTER || !process.env.STRIPE_PRICE_PRO)) {
    console.warn(
      "[prod] STRIPE_SECRET_KEY is set but STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO are missing — paid checkout will fail until price IDs are set.",
    );
  }
  if (sk && !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      "[prod] STRIPE_WEBHOOK_SECRET is not set — Stripe webhooks will not update subscription state.",
    );
  }
  if (!process.env.APP_BASE_URL && !process.env.PUBLIC_APP_URL) {
    console.warn(
      "[prod] APP_BASE_URL (or PUBLIC_APP_URL) is not set — Stripe success/cancel URLs may be wrong behind proxies; set the public origin explicitly.",
    );
  }
}
