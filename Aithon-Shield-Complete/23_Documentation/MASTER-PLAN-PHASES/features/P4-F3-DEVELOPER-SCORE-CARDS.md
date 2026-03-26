# Feature: `P4-F3` — Developer score cards

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-F3` |
| **Phase** | Phase 4 — Dashboards & analytics |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

A new page **Developer score cards** (sidebar under Core) shows one **card per project** (each MVP, mobile, or web scan that has findings). Each card displays:

- A **0–100 engagement score** and letter **grade** (A–F)
- Counts of **open**, **resolved**, and **accepted-risk** findings
- **Open critical / high** badges when applicable
- **Resolution rate** and a compact open-severity breakdown
- **Open scan** button to jump to that scan’s detail view

Scores favor resolving findings and penalize open critical/high issues. Accepted-risk findings are excluded from “open” severity counts (they are tracked separately).

---

## Technical summary

- **Code paths / files:**
  - `shared/developerScoreCards.ts` — Pure functions: `computeEngagementScore`, `buildDeveloperScoreCards`, types
  - `server/developerScoreCardRoutes.ts` — `GET /api/developer-score-cards` (uses `getAllFindings` + `enrichFindingsList`)
  - `server/routes.ts` — Early registration: `registerDeveloperScoreCardRoutes(app, { storage, requireAuth })`
  - `client/src/pages/DeveloperScoreCards.tsx` — Page UI
  - `client/src/App.tsx` — Route `/developer-score-cards`
  - `client/src/components/AppSidebar.tsx` — Nav item with Award icon
  - `public/openapi.json` — Path documented
  - `cli/verifyDeveloperScoreCardsRoute.ts` — Smoke + pure-function checks
  - `package.json` — `verify:developer-score-cards`

- **Schema / migrations:** None (derived from existing findings + scan visibility in `getAllFindings`)

- **Environment variables:** None new

- **API routes:**
  - `GET /api/developer-score-cards` — Session or API key (`requireAuth`). Response: `{ generatedAt, cards: DeveloperScoreCardRow[] }`

---

## Category breakdown

- **Category 1:** New page, sidebar link, refresh control, responsive card grid, navigation to scan detail.
- **Category 2:** Aggregation API, shared scoring logic, reuse of RBAC-aware `getAllFindings` and fix-confidence enrichment pipeline.

---

## Manual testing steps

1. Sign in and open **Developer score cards** from the sidebar (Award icon).
2. If you have MVP/mobile/web findings, confirm one card per distinct scan; verify **Open scan** navigates to the correct scan route.
3. Resolve a finding (or mark accepted risk) and click **Refresh** — score and counts should update.
4. Open the same data via API (optional): with a session cookie, `GET /api/developer-score-cards` should return JSON with `cards` sorted lowest score first.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npx tsc --noEmit` (in `00_Full_Source_Code`) | **pass** |
| DB push | Not required (no schema change) | N/A |
| Verify script | `npm run verify:developer-score-cards` | **pass** — pure-function checks + isolated Express 401; full server line **401** when dev server restarted with new code |
| curl (dev server) | `GET /api/developer-score-cards` unauthenticated | **401** |
| curl (dev server) | Same with session cookie after login | **200** — `{ generatedAt, cards[] }` (5 cards in agent env) |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above  
- [ ] Behavior matches the user-facing summary  
- [ ] **Approved to proceed** — next feature: `P4-E4`

**Verified by:** _name / date_  
**Comments:**

---

## Rollback / risks

- Remove route registration, delete new files, revert sidebar/App changes.
- Scoring is heuristic; tune `shared/developerScoreCards.ts` if product wants different weights.
