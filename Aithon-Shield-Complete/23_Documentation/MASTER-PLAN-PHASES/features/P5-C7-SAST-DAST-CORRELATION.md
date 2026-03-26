# Feature: `P5-C7` — SAST + DAST correlation (web + MVP repo)

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-C7` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **2** (API + UI on web scan details) |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

On **Web App Scan** details (`/scan-details/web/:id`), when the scan was created with a **linked source repository** (same workflow as New App → Web App: repository URL + branch in `workflowMetadata`), the page shows a **SAST ↔ DAST correlation** card.

The server finds the **latest MVP code scan** for the **same normalized repository URL** and pairs **DAST findings** (this web scan) with **SAST findings** (MVP scan) when they share the same **normalized CWE** ID. Unmatched findings are summarized (DAST-only / SAST-only counts).

This does **not** re-run scans; it only correlates existing findings. Matching is **heuristic** (CWE equality); titles and locations may differ between tools.

---

## Technical summary

| Piece | Location |
|-------|----------|
| Correlation logic | `server/services/sastDastCorrelationService.ts` — `normalizeRepositoryUrl`, `correlateSastDastFindings` |
| API | `GET /api/web-scans/:id/sast-dast-correlation` in `server/routes.ts` |
| UI | `client/src/pages/ScanDetails.tsx` — card for `scanType === "web"` |
| OpenAPI | `public/openapi.json` |

**Repository match:** `workflowMetadata.sourceRepositoryUrl` on the web scan vs `repositoryUrl` on MVP scans — both normalized (host + path, lowercase, no `.git`, no trailing slash).

**MVP scan pick:** Same user, same normalized repo; prefer `scanStatus === completed`, else latest by `createdAt`.

---

## Category breakdown

- **Category 2 (Backend):** `sastDastCorrelationService.ts` — repository URL normalization, CWE-based pairing of DAST and SAST findings, MVP scan lookup; `routes.ts` — `GET /api/web-scans/:id/sast-dast-correlation` endpoint.
- **Category 1 (Frontend):** `ScanDetails.tsx` — SAST ↔ DAST correlation card on web scan detail view showing paired findings, unmatched counts, and linked MVP scan info.

---

## Manual testing

1. Create an **MVP** scan for `https://github.com/org/repo` and let it complete with findings.
2. Create a **Web** scan with the **same** repository URL in the workflow (New App → Web App) and a live app URL; complete the web scan.
3. Open **Scan details** for the web scan — correlation card should show paired rows when CWEs overlap.
4. Web scan **without** `sourceRepositoryUrl` — card explains that a repo link is required.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| DB push | Not required (no schema change) | N/A |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above
- [ ] Behavior matches the user-facing summary
- [ ] **Approved to proceed** — next feature in plan

**Verified by:** _name / date_
**Comments:**

---

## Rollback / limits

- **Uneven CWE counts:** If three DAST and one SAST share CWE-79, only one pair is formed; remainder listed as unmatched.
- **No path-level correlation:** Full correlation of URL ↔ file path is future work.
