# Feature: `P2-E2` — Fix confidence + explainability scores

**Short overview:** [`P2-E2-OWNER-REFERENCE.md`](./P2-E2-OWNER-REFERENCE.md)

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
| **Feature ID** | `P2-E2` |
| **Phase** | Phase 2 — Shield Advisor and AI confidence |
| **Category** | **Both** — Category 1: Findings table + remediation dialog. Category 2: shared heuristic, API enrichment on finding payloads. |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`FindingsTable.tsx`](../../../00_Full_Source_Code/client/src/components/FindingsTable.tsx) — **Fix confidence** column (score badge + tooltip with side-effect risk and rationale). [`RemediationDialog.tsx`](../../../00_Full_Source_Code/client/src/components/RemediationDialog.tsx) — optional **Fix confidence** card when `fixConfidence` is present. [`Dashboard.tsx`](../../../00_Full_Source_Code/client/src/pages/Dashboard.tsx) — passes `fixConfidence` into remediation from recent findings.
- **Category 2 — Backend:** [`shared/fixConfidence.ts`](../../../00_Full_Source_Code/shared/fixConfidence.ts) — `computeFixConfidence()` deterministic heuristic (0–100 score, explainability string, `sideEffectRisk`: low \| medium \| high). [`server/findingsEnrichment.ts`](../../../00_Full_Source_Code/server/findingsEnrichment.ts) — `enrichFindingWithFixConfidence` / `enrichFindingsList`. [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — finding list/detail and mutations return enriched rows. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — findings endpoints describe `fixConfidence`.

---

## User-facing summary

Each finding can show a **fix confidence** percentage and a short **explanation** of how that score was derived, plus a **side-effect risk** label (low / medium / high). These values are **rules-based**, not ML predictions: they summarize severity, category/CWE, remediation depth, and location sensitivity so reviewers can prioritize before applying fixes.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Payload** | `fixConfidence: { score: number, explainability: string, sideEffectRisk: "low" \| "medium" \| "high" }` |
| **Computation** | `computeFixConfidence` in `shared/fixConfidence.ts`; resolved / fixes-applied findings receive a high score with a fixed explainability string. |
| **API** | Responses that return finding objects include `fixConfidence` after enrichment (list, single, scan-scoped findings, archive/restore flows where applicable). |

---

## Manual testing steps

1. **Findings page:** Open **Findings**; confirm a **Fix confidence** column with a percentage; hover the badge for tooltip text and side-effect risk.  
2. **AI Remediation:** Open **Fix → AI Remediation** (or **View Details**); confirm the **Fix confidence** card appears at the top of the dialog with score, side-effect risk, and explanation.  
3. **Dashboard:** From **Recent Findings**, open remediation; confirm the same card when data is returned from `/api/findings`.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` (in `00_Full_Source_Code`) | **pass** |

---

## User verification (required before next feature)

- [ ] Findings table shows fix confidence and tooltip  
- [ ] Remediation dialog shows fix confidence block  
- [ ] **Approved to proceed** — next feature: **`P3-F1`** (security health timeline + MTTR + regressions) per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove `fixConfidence` from API responses by stopping enrichment in `routes.ts` (client tolerates absence).  
- Remove column and dialog card in UI components listed above.
