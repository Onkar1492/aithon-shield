# Feature: `P1-D3` — API rate limiting + per-key scopes

**Short overview (no jargon):** [`P1-D3-OWNER-REFERENCE.md`](./P1-D3-OWNER-REFERENCE.md)

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category labels (1 / 2 / Both)** | This file (metadata table + **Category breakdown** below). Master-plan convention: [`README.md`](../README.md) section **Categories**. Phase index “typical category”: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (P1-D3 is **2**, with optional UI for headers). |
| **Implementation status** | [`_STATUS.md`](./_STATUS.md) — row for **P1-D3** (`implemented — pending user verification` until you confirm). |
| **Manual testing steps** | Section **Manual testing steps** in this file. |
| **Automated / agent testing results** | Section **Automated / agent testing performed** in this file (commands and pass/fail). |
| **User verification gate** | Section **User verification (required before next feature)** — checkboxes for you to mark after testing. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P1-D3` |
| **Phase** | Phase 1 — Trust and foundation |
| **Category** | **Both** — Category 2 (server: limits + scope enforcement) is primary; Category 1 (Settings UI for scopes on create + badges on list). Aligns with phase index: backend-first (**2**), with browser-facing pieces (**Both**). |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx) — when creating an API key, **read** / **write** / **admin** checkboxes; existing keys show **scope badges** next to the key prefix.
- **Category 2 — Backend:** [`rateLimitMiddleware.ts`](../../../00_Full_Source_Code/server/rateLimitMiddleware.ts) — global IP limit on `/api`, auth-strict limit on `POST /api/auth/login` and `POST /api/auth/signup`, per–API-key limit after validation. [`authMiddleware.ts`](../../../00_Full_Source_Code/server/authMiddleware.ts) — `req.apiKey`, scope checks for Bearer / `X-API-Key` only. [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — `POST /api/api-keys` accepts `scopes[]`. [`index.ts`](../../../00_Full_Source_Code/server/index.ts) — installs global limiter after `cookieParser`. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — describes scopes and rate-limit headers in `info.description` and create-key body.

---

## User-facing summary

API keys can be created with **read**, **write**, and **admin** scopes. Read-only keys can use GET/HEAD; mutating requests need **write** (or **admin**). Rate limits apply to API traffic with standard response headers; **demo mode** skips rate limiting so local trials stay smooth.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Scopes** | Stored on `api_keys.scopes` (comma-separated). Enforced only for API key auth, not session cookies. |
| **Rate limits** | Defaults: ~120/min per IP on `/api` (not `/api/health`), ~15 per 15 min per IP on login/signup, ~60/min per API key hash. Env: `AITHON_RATE_LIMIT_GLOBAL_PER_MIN`, `AITHON_RATE_LIMIT_AUTH_STRICT_POINTS`, `AITHON_RATE_LIMIT_AUTH_STRICT_WINDOW_SEC`, `AITHON_RATE_LIMIT_API_KEY_PER_MIN`. |
| **Headers** | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; `429` includes `Retry-After`. |
| **API** | `POST /api/api-keys` body: `{ "name": string, "scopes"?: ["read","write","admin"] }` (default `["read","write"]`). |

---

## Manual testing steps

Use a **non-demo** server if you need to see rate-limit headers and 429 behavior (demo mode skips rate limiting).

1. **Settings UI (Category 1)**  
   Open **Settings**, find **API keys and agents**. Create a key with a label; toggle only **Read**, create the key, copy the secret once. Confirm the list shows **read** (and only read) as a badge. Repeat with **Write** (and **Read** if you need GET + POST) and confirm badges match.

2. **Read-only key rejects writes (Category 2)**  
   Call `GET /api/mvp-scans` (or another authenticated GET) with `Authorization: Bearer <key>` using a **read-only** key — expect **200**. Call `POST /api/mvp-scans` (or any non-GET) with the same key — expect **403** JSON with `code: "INSUFFICIENT_SCOPE"` and `required: "write"`.

3. **Write-capable key mutates**  
   Use a key that includes **write** (and **read** for workflows that read then write). Confirm a create/start-scan style request succeeds where your product allows it.

4. **Rate limit headers (non-demo)**  
   Send a few requests to any `/api/...` route (browser **Network** tab or your HTTP client). Confirm response headers include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (values may vary by layer: global vs per-key).

5. **Demo mode**  
   With `AITHON_DEMO_MODE` enabled in development, confirm normal use is not blocked by throttling (limits are skipped).

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` (in `00_Full_Source_Code`) | **pass** |
| DB push | Not required for this feature (no new columns) | **not applicable** |

**Notes:** No separate integration test suite was added for rate limiting; validation is manual plus typecheck.

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above  
- [ ] Read-only key cannot mutate; write-capable key can  
- [ ] Rate limit headers visible when not in demo mode (if you test that path)  
- [ ] **Approved to proceed** — next feature: **`P2-E1`** (Shield Advisor — multi-model chat, scan context) per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Tuning or disabling limits: adjust or unset the `AITHON_RATE_LIMIT_*` environment variables.  
- Existing keys keep stored `scopes` (historical default was `read,write`).
