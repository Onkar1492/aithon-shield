# Feature: `P3-F1` — Security health timeline + MTTR + regressions

**Short overview:** [`P3-F1-OWNER-REFERENCE.md`](./P3-F1-OWNER-REFERENCE.md)

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
| **Feature ID** | `P3-F1` |
| **Phase** | Phase 3 — Analytics and continuous monitoring |
| **Category** | **Both** — Category 1: Security Health page + charts. Category 2: `resolved_at`, metrics API, shared formulas. |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`SecurityHealth.tsx`](../../../00_Full_Source_Code/client/src/pages/SecurityHealth.tsx) — KPI cards (health, MTTR, regressions, window), composed chart (new vs resolved per UTC day + health line), MTTR-by-severity grid. [`App.tsx`](../../../00_Full_Source_Code/client/src/App.tsx) route `/security-health`. [`AppSidebar.tsx`](../../../00_Full_Source_Code/client/src/components/AppSidebar.tsx) **Security Health** nav item.
- **Category 2 — Backend:** [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) — `findings.resolved_at` (server-managed; stripped from client PATCH body in storage). [`server/storage.ts`](../../../00_Full_Source_Code/server/storage.ts) — set/clear `resolvedAt` on status transitions, bulk fix, archive, restore. [`shared/securityHealthMetrics.ts`](../../../00_Full_Source_Code/shared/securityHealthMetrics.ts) — `buildSecurityHealthSummary`, MTTR, regressions, timeline health. [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — `GET /api/security-health?days=`. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json).

---

## User-facing summary

The **Security health** screen shows how findings evolved over the last **7 / 30 / 90** days (UTC): **new** and **resolved** counts per day, a **health score** line aligned with the dashboard formula, **mean time to remediate (MTTR)** when resolution timestamps exist, and a **regression** count when an **open** finding duplicates a **resolved** one (same scan, CWE, and title).

---

## Technical summary

| Area | Detail |
|------|--------|
| **DB** | `findings.resolved_at` nullable timestamp; not accepted from arbitrary PATCH (stripped in `updateFinding`). |
| **MTTR** | Hours from `created_at` to `resolved_at` for resolved findings; excluded if `resolved_at` is null. |
| **Regressions** | Fingerprint `scanId + scanType + cwe + normalized title`; count open rows in a group that also has a resolved row. |
| **Health timeline** | Per UTC day end, `computeHealthScoreSnapshot` (same penalty/bonus structure as dashboard). |

---

## Manual testing steps

1. Run **`npm run db:push`** (or your env’s schema sync) so `resolved_at` exists.  
2. Open **Security Health** from the sidebar; pick **7 / 30 / 90** days.  
3. Resolve a finding (or run a flow that sets status resolved); confirm **MTTR** updates after `resolved_at` is set.  
4. Optional: create a duplicate open finding (same scan + CWE + title) as a resolved one to see **Regressions** ≥ 1.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` (in `00_Full_Source_Code`) | **pass** |
| DB push | Requires `DATABASE_URL` in env | **run locally after deploy** |

---

## User verification (required before next feature)

- [ ] Security Health page loads with chart and KPIs  
- [ ] MTTR shows plausible values after resolving findings  
- [ ] **Approved to proceed** — next feature: **`P3-F2`** (scheduled scans + drift) per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove route, page, sidebar link; drop or ignore `resolved_at` column if reverting schema.  
- Timeline uses UTC day boundaries; labels are formatted in the browser.
