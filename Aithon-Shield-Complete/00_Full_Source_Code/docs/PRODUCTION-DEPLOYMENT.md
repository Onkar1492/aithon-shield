# Production deployment (real-world checklist)

This app is designed to run as a **single Node process** serving the API and the built SPA (`npm run build` → `node dist/index.js`).

## Required

- **`DATABASE_URL`** — Postgres connection string (validated at startup via `server/db.ts`).
- **`NODE_ENV=production`** — enables secure session cookies, safer API error messages, and quieter access logs.

## Recommended for public HTTPS

- **`APP_BASE_URL`** or **`PUBLIC_APP_URL`** — public origin (e.g. `https://app.example.com`). Used for Stripe Checkout return URLs and consistent redirects. Startup logs a warning if missing in production.
- **`TRUST_PROXY=1`** — when the app sits behind nginx, Kubernetes ingress, or a load balancer so `X-Forwarded-*` headers are trusted (correct client IP / scheme for Stripe URLs).
- **TLS termination** — terminate HTTPS at the proxy; keep the app on HTTP internally or ensure cookies work (`COOKIE_SECURE`).

## Stripe billing (optional but needed for real payments)

- **`STRIPE_SECRET_KEY`** (or `TESTING_STRIPE_SECRET_KEY` in test)
- **`STRIPE_PRICE_STARTER`**, **`STRIPE_PRICE_PRO`**
- **`STRIPE_WEBHOOK_SECRET`** — required for subscription webhooks; register `POST /api/webhooks/stripe` in the Stripe dashboard (raw JSON body).

## Session cookies

- Default in production: **`Secure`** cookies (HTTPS only).
- Plain HTTP (e.g. local Docker on `http://localhost:5001`): set **`COOKIE_SECURE=false`** so browsers accept the session cookie.

## Health endpoints

- **`GET /api/health`** — process liveness (no DB probe).
- **`GET /api/health/ready`** — DB connectivity (`select 1`); returns **503** if the database is unreachable.

## Operations

- **`npm run verify:prod`** — TypeScript check + production build (same as CI gate).
- **Graceful shutdown** — `SIGTERM` / `SIGINT` closes the HTTP server and the DB pool (Docker/K8s friendly).

## Logging

- In production, **JSON response bodies are not** appended to access logs (reduces PII leakage). Set **`API_LOG_RESPONSES=true`** only when debugging.

