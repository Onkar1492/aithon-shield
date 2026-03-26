# P1-D3 — Plain-language reference (for the product owner)

Use this file when you do not want to read the full technical feature doc. The full spec stays in [`P1-D3-API-RATE-LIMITING.md`](./P1-D3-API-RATE-LIMITING.md).

---

## What is this feature?

**P1-D3** adds two protections for people who use **API keys** (agents, scripts, MCP, `curl`):

1. **Rate limiting** — The server limits how many requests can come from one place in a short time (by IP, by login/signup attempts, and per API key). That reduces abuse and accidental overload.
2. **Per-key scopes** — Each API key can be limited to **read-only** (mostly GET requests) or **read + write** (create scans, updates, deletes). An **admin** scope on a key means full access for anything the server currently treats as admin-level for keys.

**Important:** If you use the website while logged in with a normal **session cookie**, you are not limited by these API-key scopes. Scopes apply when someone sends `Authorization: Bearer <aithon_…>` or `X-API-Key: <aithon_…>`.

---

## What was implemented (summary)

| Area | What you get |
|------|----------------|
| **Server** | Limits on `/api` traffic, stricter limits on login and signup, extra limit per API key after the key is checked. Response headers like `X-RateLimit-*` when limits apply; **429 Too Many Requests** when over the limit. **Demo mode** turns off rate limiting so local demos stay easy. |
| **API keys** | When a key is used, the server checks its stored **scopes**. Read-only keys cannot run mutating requests (POST, PATCH, DELETE, etc.). |
| **Creating keys** | In **Settings**, you can tick **Read**, **Write**, and **Admin** when creating a key. Existing keys show small **badges** for their scopes. |
| **Create-key API** | `POST /api/api-keys` accepts an optional `scopes` array (defaults to read + write if omitted). |

---

## What category is P1-D3?

The master plan uses **Category 1**, **Category 2**, and **Both**:

| Label | Meaning |
|-------|--------|
| **Category 1** | **Frontend** — what you see and click in the browser. |
| **Category 2** | **Backend** — server, database behavior, API behavior without a new screen (or invisible rules). |
| **Both** | The feature has a **real UI part** and a **real server part**. |

**P1-D3 is “Both.”**

- **Category 1 (frontend):** The Settings page lets you pick scopes when creating a key and shows scope badges on each key.
- **Category 2 (backend):** Rate limiting and scope enforcement run on the server; OpenAPI text describes limits and headers.

The phase index sometimes labels P1-D3 as **2** because the **main** work is server-side; the UI piece is smaller but real, so **Both** is the accurate full picture.

---

## Documentation created or updated for P1-D3

| Document | Role |
|----------|------|
| [`P1-D3-API-RATE-LIMITING.md`](./P1-D3-API-RATE-LIMITING.md) | Full feature doc: categories, technical summary, manual steps, automated test log, verification checklist, links to code. |
| [`P1-D3-OWNER-REFERENCE.md`](./P1-D3-OWNER-REFERENCE.md) | **This file** — short overview, category explanation, doc list, UI test steps. |
| [`_STATUS.md`](./_STATUS.md) | Single table: P1-D3 status (`implemented — pending user verification` until you confirm). |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | API description mentions scopes, rate limits, and headers. |

Related (not created only for P1-D3, but relevant):

| Document | Role |
|----------|------|
| [`README.md`](../README.md) | Explains Category 1 / 2 / Both and the verification workflow. |
| [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) | Where P1-D3 sits in Phase 1 and what comes next. |
| [`TEMPLATE-FEATURE.md`](../TEMPLATE-FEATURE.md) | Template for future feature docs. |

---

## Testing after each new feature (for the agent)

When a **new** feature is implemented, the agent should:

1. Run **`npm run check`** in [`00_Full_Source_Code`](../../../00_Full_Source_Code) so TypeScript still passes for the whole app.
2. If the new work touches **auth, API routes, Settings, or API keys**, re-check P1-D3 behavior: API keys still respect scopes, and rate limiting still applies where expected (non-demo).

You do not need to repeat full P1-D3 manual testing on every small change unless something touches those areas.

---

## Step-by-step: test the frontend UI only (Settings)

Demo mode **allows** creating API keys so you can test the Settings flow locally. New account **registration** stays off in demo; use a seeded demo user to sign in.

1. **Sign in** to the app in the browser (normal session).
2. Open **Settings** (use your app’s navigation to the Settings page).
3. Scroll to **“API keys and agents.”**
4. **Create flow:** Enter a label (for example `test-read-only`). Uncheck **Write** and **Admin** so only **Read** is checked. Click **Create API key**.
5. **One-time secret:** Copy the secret when prompted (it is shown only once).
6. **Badges:** In the list of keys, find the new key. Confirm you see a **read** badge (and that write/admin do not appear if you only selected read).
7. **Another key:** Create a second key with **Read** and **Write** checked. Confirm both badges appear for that row.
8. **Revoke (optional):** Use **Revoke** on a test key to confirm the dialog and that the key disappears after confirm.

That is enough to confirm **Category 1** behavior for P1-D3 without using `curl` or developer tools. Restart the dev server after pulling changes so the server no longer returns 403 for create in demo.

---

## If you need to test API behavior (optional)

Use the full doc [`P1-D3-API-RATE-LIMITING.md`](./P1-D3-API-RATE-LIMITING.md), section **Manual testing steps**, or ask the agent to run API checks in the environment when you approve tool use.
