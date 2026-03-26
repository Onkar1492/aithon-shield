# Feature: `P3-H1` — Security onboarding wizard

**Short overview:** [`P3-H1-OWNER-REFERENCE.md`](./P3-H1-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P3-H1 |
|----------|---------|--------|
| **1** | User-visible UI / navigation | **Onboarding wizard** — 6-step modal tour shown on first login (before dashboard), covers scans, findings, monitoring, governance |
| **2** | Backend | `users.onboarding_completed_at` column, `POST /api/onboarding/complete`, audit event `user.onboarding_completed` |
| **Both** | This feature | **Both** (primarily Category 1) |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md) **Categories**. Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Product-only testing** | **Product owner test guide** below (browser only). |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P3-H1` |
| **Phase** | Phase 3 — Analytics and continuous monitoring |
| **Category** | **Both** (primarily **1 — Frontend**) |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`SecurityOnboardingWizard.tsx`](../../../00_Full_Source_Code/client/src/components/SecurityOnboardingWizard.tsx) — 6-step modal wizard (Welcome → Scans → Findings → Monitoring → Governance → Ready). Rendered in [`App.tsx`](../../../00_Full_Source_Code/client/src/App.tsx) after `TermsOfServiceDialog`, before routes. Clicking a feature card closes the wizard and navigates to that page. "Skip tour" and "Get started" both call the complete endpoint.
- **Category 2 — Backend:** [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) — `users.onboarding_completed_at` (nullable timestamp). [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — `POST /api/onboarding/complete`. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json).

---

## User-facing summary

When a user logs in for the **first time** (or has never completed the wizard), a **6-step guided tour** appears as a blocking dialog:

1. **Welcome** — introduces Aithon Shield  
2. **Run security scans** — links to MVP, Mobile, Web, Linter scans  
3. **Review and remediate** — Findings, Shield Advisor, Archive  
4. **Continuous monitoring** — Security Health, Scheduled Scans, CVE Watchlist  
5. **Governance and compliance** — .aithonshield.yml, Merge Gate, Audit Log, Compliance  
6. **You're all set!** — closes wizard and lands on dashboard  

Each step shows **clickable feature cards** that close the wizard and navigate directly to that page. Users can **Skip tour** at any step. Once completed or skipped, the wizard never appears again (persisted via `onboarding_completed_at` on the user record). The wizard appears **after** Terms of Service acceptance (sequenced correctly).

---

## Technical summary

| Area | Detail |
|------|--------|
| **Trigger** | `user.onboardingCompletedAt === null` (checked client-side from `/api/auth/me` response) |
| **Persistence** | `POST /api/onboarding/complete` sets `users.onboarding_completed_at = now()` |
| **Sequencing** | Rendered after `TermsOfServiceDialog` in `Router` — ToS blocks first, then wizard |
| **Audit** | `user.onboarding_completed` event logged |
| **Existing users** | Column is nullable; existing users have `null` so they will see the wizard once on next login |

---

## Product owner test guide (browser only — no Terminal)

**Prerequisites:** Signed in; dev server running current code; database migrated.

### Step-by-step

1. **Log in** (or sign up a new account). If this is the first time after the feature was deployed, the **onboarding wizard** should appear as a full-screen dialog.

2. Confirm **Step 1 of 6** shows "Welcome to Aithon Shield." Click **Next**.

3. Walk through all 6 steps. On the **Scans** step, click one of the feature cards (e.g. "MVP / Code Scan"). Confirm the wizard closes and you navigate to that page.

4. **Log out and log back in.** Confirm the wizard does **not** appear again (it was completed).

5. To re-test: if you need to see the wizard again for an existing user, the `onboarding_completed_at` column would need to be set to `NULL` in the database (not a user action — admin/dev only).

6. **Skip tour test:** Sign up a new user, accept ToS, then click **Skip tour** on step 1. Confirm wizard closes and does not reappear on next login.

**Note for existing users:** Since `onboarding_completed_at` starts as `NULL`, all existing users will see the wizard **once** after this feature is deployed. This is intentional — it introduces them to features added since they signed up.

---

## Automated / agent testing (not run by the product owner)

| Check | Who runs it | Result |
|-------|-------------|--------|
| Typecheck `npm run check` | Agent / CI in `00_Full_Source_Code` | **pass** (agent run) |
| Schema `npm run db:push` | Agent (needs `DATABASE_URL`) | **pass** (agent run) |
| `GET /api/auth/me` — `onboardingCompletedAt: null` for existing user | Agent (curl) | **pass** |
| `POST /api/onboarding/complete` — returns 200, sets timestamp | Agent (curl) | **pass** |
| `GET /api/auth/me` — `onboardingCompletedAt` now set | Agent (curl) | **pass** |

---

## User verification (required before next feature)

- [ ] **Category 1:** Wizard appears on first login, 6 steps, feature cards navigate, Skip works, does not reappear after completion  
- [ ] **Category 2:** `POST /api/onboarding/complete` in OpenAPI matches behavior  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P4-B3** — SLA enforcement engine)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Drop column `users.onboarding_completed_at` and remove `SecurityOnboardingWizard` import from `App.tsx` if reverting.  
- Future: add a "Replay onboarding" button in Settings for users who want to see the tour again.
