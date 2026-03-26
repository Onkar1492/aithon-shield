# Feature: `P4-E4` — Interactive attack path graph

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-E4` |
| **Phase** | Phase 4 — AI / Shield Advisor (visualization) |
| **Category** | **Category 1 — Frontend (UI)** |
| **Status** | `user verified` |

---

## User-facing summary

A new **Attack path graph** page ([`/attack-path`](/attack-path)) shows an **interactive SVG graph** of your findings arranged into **attack phases** (Reconnaissance → Initial access → Execution / injection → Credentials / session → Data exposure → Impact). Findings are placed using **explainable text heuristics** on title, category, CWE, and asset (not a live penetration test).

You can **pan** (drag the canvas), **zoom** (mouse wheel or buttons), **toggle “Include resolved”** and **“Show empty phases”**, and **click a finding node** to see details in the side panel with a shortcut to the Findings page.

---

## Technical summary

- **Code paths / files:**
  - `shared/attackPathGraphModel.ts` — `classifyAttackPhase`, `buildAttackPathGraph`, types (unit-tested via CLI)
  - `client/src/pages/AttackPathGraphPage.tsx` — Page UI (SVG pan/zoom, selection panel)
  - `client/src/App.tsx` — Route `/attack-path`
  - `client/src/components/AppSidebar.tsx` — Nav item **Attack path graph**
  - `client/src/components/SecurityOnboardingWizard.tsx` — Monitoring step link
  - `public/openapi.json` — Note on `GET /api/findings` consumption for P4-E4
  - `cli/verifyAttackPathGraphModel.ts` — Pure-model smoke checks
  - `package.json` — `verify:attack-path-graph`

- **Schema / migrations:** None

- **Environment variables:** None new

- **API routes:** None new — uses existing `GET /api/findings` (session / API key as today)

---

## Category breakdown

- **Category 1:** Entire feature is client-side visualization and interaction; data source is the existing findings API.

---

## Manual testing steps

1. Open **Attack path graph** from the sidebar.
2. Confirm nodes appear for open findings; drag the background to pan; scroll to zoom.
3. Toggle **Include resolved** and confirm the graph updates after refetch.
4. Toggle **Show empty phases** and confirm empty phase boxes appear or hide.
5. Click a **finding** rectangle; confirm the right panel shows title, severity, category, and **Open Findings** navigates to `/findings`.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npx tsc --noEmit` (in `00_Full_Source_Code`) | **pass** |
| Verify script | `npm run verify:attack-path-graph` | **pass** |
| DB push | Not required | N/A |

---

## User verification (required before next feature)

- [x] I followed the manual testing steps above  
- [x] Behavior matches the user-facing summary  
- [x] **Approved to proceed** — next feature: `P5-C3`

**Verified by:** product owner (attack graph layout) — 2026-03-24  
**Comments:** Overlap fix verified (waterfall layout + scrollable SVG).

---

## Rollback / risks

- Remove route, sidebar entry, shared model, and page file.
- Heuristic phase assignment is **not** a substitute for red-team validated attack paths; copy in the UI states this clearly.
