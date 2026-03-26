# Feature: `P4-B3` — SLA enforcement engine

**Short overview:** [`P4-B3-OWNER-REFERENCE.md`](./P4-B3-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P4-B3 |
|----------|---------|--------|
| **1** | User-visible UI | **SLA** page (`/sla`), **Settings → SLA targets (hours)**, sidebar **SLA** |
| **2** | Backend / shared | `users.sla_policy_hours` JSON, `GET /api/sla/summary`, `PATCH /api/user/sla-policy`, `shared/slaPolicy.ts` evaluation |
| **Both** | This feature | **Both** |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md). Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Product-only testing** | **Product owner test guide** below. |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-B3` |
| **Phase** | Phase 4 — Enterprise governance and integrations |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Sla.tsx`](../../../00_Full_Source_Code/client/src/pages/Sla.tsx), [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx) (SLA targets card), [`App.tsx`](../../../00_Full_Source_Code/client/src/App.tsx) route `/sla`, [`AppSidebar.tsx`](../../../00_Full_Source_Code/client/src/components/AppSidebar.tsx), onboarding wizard governance link in [`SecurityOnboardingWizard.tsx`](../../../00_Full_Source_Code/client/src/components/SecurityOnboardingWizard.tsx).
- **Category 2 — Backend / shared:** [`shared/slaPolicy.ts`](../../../00_Full_Source_Code/shared/slaPolicy.ts), [`server/slaRoutes.ts`](../../../00_Full_Source_Code/server/slaRoutes.ts), [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) (`sla_policy_hours`), [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts), [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json).

---

## User-facing summary

Teams set **remediation targets in hours** per severity (**Critical**, **High**, **Medium**, **Low**) in **Settings**. The same semantics apply as YAML `policy.sla` in `.aithonshield.yml` (e.g. `24h` → **24** hours). The **SLA** page lists **breaches** (open findings past their due time from first seen) and **upcoming** deadlines (soonest due first; **at risk** = inside the last 25% of the remediation window). Clearing all fields removes SLA tracking until new targets are saved.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Due time** | `dueAt = finding.createdAt + hoursBudget` (wall-clock). |
| **Open finding** | Status open / in-progress; not archived; not resolved/fixed. |
| **PATCH /api/user/sla-policy** | Session only; merges partial updates; `null` clears a severity. |
| **Audit** | `user.sla_policy_update` |

---

## Product owner test guide (browser only — no Terminal)

**Prerequisites:** Signed in; dev server running current code; schema applied.

### Step-by-step

1. Open **Settings** → **SLA targets (hours)**. Enter e.g. Critical **1**, High **48**, leave others blank. Click **Save SLA targets**. Confirm success toast.

2. Open **SLA** from the sidebar. Confirm counts and tables (may be empty if no open findings).

3. Create or use an **open** finding with severity **Critical** older than your Critical SLA (or temporarily set Critical to **0.001** hours for a quick test — not recommended for production). Confirm it appears under **Breaches** when past due.

4. Clear SLA fields and save; confirm **SLA** page shows the empty-policy hint.

**API keys:** `GET /api/sla/summary` works with API key (read). `PATCH /api/user/sla-policy` requires a **browser session** (session cookie), not API key alone.

---

## Automated / agent testing (not run by the product owner)

| Check | Who runs it | Result |
|-------|-------------|--------|
| Typecheck `npm run check` | Agent / CI | **pass** (agent run) |
| Schema `npm run db:push` | Agent | **pass** (agent run) |
| `GET /api/sla/summary` unauthenticated | Agent (curl) | **401** (not 404) after server restart with new code |

---

## User verification (required before next feature)

- [ ] **Category 1:** Settings SLA card, `/sla` page, sidebar, breaches/upcoming tables behave as expected  
- [ ] **Category 2:** OpenAPI paths match behavior  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P4-B4** — Exception / risk acceptance workflow)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove `registerSlaRoutes`, drop column `sla_policy_hours`, delete `shared/slaPolicy.ts` and `server/slaRoutes.ts`, revert UI files if reverting.  
- Future: tie SLA to org/project; notifications on breach; import from `.aithonshield.yml` automatically.
