# Feature: `P3-F2` — Scheduled scans engine + drift detection

**Short overview:** [`P3-F2-OWNER-REFERENCE.md`](./P3-F2-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P3-F2 |
|----------|---------|--------|
| **1** | User-visible UI / navigation | Scheduled Scans page, sidebar link, create / list / toggle / delete |
| **2** | Backend, schema, APIs, jobs | Engine tick, storage claim, drift JSON, MVP background path, OpenAPI |
| **Both** | This feature | **Both** — you validate **Category 1** in the app; **Category 2** is covered by agent/CI checks and a running server with current schema |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md) **Categories**. Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Manual / automated testing** | Sections below. |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P3-F2` |
| **Phase** | Phase 3 — Analytics and continuous monitoring |
| **Category** | **Both** — Category 1: Scheduled Scans UI + sidebar. Category 2: engine, drift JSON, shared utils, MVP refactor. |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`ScheduledScans.tsx`](../../../00_Full_Source_Code/client/src/pages/ScheduledScans.tsx) — list schedules, create (name, frequency, MVP target), toggle active, delete. Route `/scheduled-scans`. [`AppSidebar.tsx`](../../../00_Full_Source_Code/client/src/components/AppSidebar.tsx) **Scheduled Scans** nav item.
- **Category 2 — Backend:** [`server/scheduledScanEngine.ts`](../../../00_Full_Source_Code/server/scheduledScanEngine.ts) — periodic tick (`AITHON_SCHEDULED_SCAN_TICK_MS`, default 30s). [`server/storage.ts`](../../../00_Full_Source_Code/server/storage.ts) — `getDueScheduledScans`, `claimScheduledScanRun`. [`shared/scheduledScanUtils.ts`](../../../00_Full_Source_Code/shared/scheduledScanUtils.ts) — config parse, next-run math, `buildNextRunSummary` / drift. [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) — `last_run_summary_json`. [`executeMvpScanBackground.ts`](../../../00_Full_Source_Code/server/executeMvpScanBackground.ts) — shared MVP run path; [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) `POST /api/mvp-scans/:id/scan` delegates to it. [`index.ts`](../../../00_Full_Source_Code/server/index.ts) starts the engine after listen. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — `/api/scheduled-scans`.

---

## User-facing summary

**Scheduled scans** lets you attach a **recurring cadence** (daily / weekly / monthly / custom placeholder) to an **MVP code scan**. The server runs a background job on a timer, executes MVP scans when `next_run_at` is due, and stores a **last-run summary** with **drift** (delta vs the previous scheduled run’s counts). Web and mobile targets in `scan_config` are **skipped** by the engine until those paths are implemented.

---

## Technical summary

| Area | Detail |
|------|--------|
| **DB** | `scheduled_scans.last_run_summary_json` — JSON text; drift payload type `ScheduledRunLastSummary` in shared utils. |
| **Engine** | Loads active jobs with `next_run_at` null or ≤ now; **claim** advances `last_run_at` / `next_run_at` with optimistic lock on previous `next_run_at`. |
| **MVP** | Same pipeline as manual scan: status → scanning, `startMvpScanBackground`, `onCompleted` writes drift summary. |
| **Env** | `AITHON_SCHEDULED_SCAN_TICK_MS` (min 5000 ms), `APP_BASE_URL` optional for preview URLs when no HTTP `req`. |

---

## Product owner test guide (browser only — no terminal)

Use this to confirm **Category 1** and the visible parts of **Category 2** (scheduled runs and drift). The app must be running with a database that already has the latest schema (your deploy, local dev started by the team, or Cursor agent after schema sync — **not** something you run yourself in Terminal).

**Prerequisites (conceptual, not a command list):** You are signed in, at least one **MVP code scan** exists, and the server process includes the scheduled-scan engine (normal dev/prod start).

### Step-by-step

1. **Navigation (Category 1)**  
   Open the app, expand the sidebar if needed, and click **Scheduled Scans** (or go to `/scheduled-scans`). Confirm the page title and table (or empty state) load without errors.

2. **Create schedule (Category 1)**  
   Click **New schedule**. Choose an MVP scan, set a name and frequency, and save. Confirm a new row appears with **Next run** showing a time roughly **about one minute** after creation.

3. **First scheduled run (Category 2 — observable)**  
   Wait until **Next run** time passes and the engine picks up the job (default check every **30 seconds**). After the MVP scan finishes, confirm **Last run** fills in and **Drift** shows **—** or “No change” on the first successful completion (no prior run to compare).

4. **Drift on second run (Category 2 — observable)**  
   Wait for the **next** cycle (next **Next run** time after the engine advances the schedule). After that run completes, confirm **Drift** shows deltas (e.g. Δ findings, CRIT, HIGH) when counts changed vs the previous run.

5. **Pause (Category 1 + engine)**  
   Turn **Active** off for that row. Confirm the schedule remains listed but should **not** execute again on subsequent due times (inactive schedules are not picked up).

6. **Delete (Category 1)**  
   Remove the schedule with the delete control and confirm it disappears from the list.

7. **Manual MVP scan still works (Category 2 regression)**  
   From **MVP Scan**, start a scan manually on the same project. Confirm it still starts and completes as before (shared background runner).

---

## Automated / agent testing (not run by the product owner)

| Check | Who runs it | Result |
|-------|-------------|--------|
| Typecheck `npm run check` | Agent / CI in `00_Full_Source_Code` | **pass** (last agent run) |
| Schema sync `db:push` | Agent when `DATABASE_URL` is available, or deploy pipeline | Required before drift column exists in DB |

---

## User verification (required before next feature)

- [ ] **Category 1:** Scheduled Scans page, create, list, toggle, delete — all behave as above  
- [ ] **Category 2 (visible):** At least one scheduled MVP run completes; **Drift** updates meaningfully after a **second** run when findings counts change  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Disable engine: comment out `startScheduledScanEngine()` in `server/index.ts`.  
- Drop or ignore `last_run_summary_json` if reverting schema.  
- Manual MVP scan still uses `executeMvpScanBackground` — keep file if reverting only UI.
