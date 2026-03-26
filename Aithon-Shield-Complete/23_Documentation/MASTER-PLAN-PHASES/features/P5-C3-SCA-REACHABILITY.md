# Feature: `P5-C3` — SCA reachability analysis (heuristic)

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-C3` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **Category 2** (Backend) + **Category 1** (Findings UI filter/column) |
| **Status** | `user verified` |

---

## User-facing summary

After an **MVP code scan** with SCA enabled, **dependency vulnerability** findings include a **SCA reachability** label derived from the cloned repository:

- **Import referenced** — Static patterns suggest your code imports or requires this package (JS/TS, Python, Go, Java/Kotlin, Ruby, PHP, Rust heuristics).
- **No import match** — No matching import/require was found in scanned source files (the dependency may still be used indirectly or at runtime).
- **Not analyzed** — Ecosystem not covered (e.g. Gradle-only) or no parsable sources.

The **Findings** page adds a filter (`scaReach` query param) and a **SCA reach** column; the remediation dialog explains the heuristic.

---

## Technical summary

- **Code paths / files:**  
  - [`server/services/scaReachability.ts`](../../../00_Full_Source_Code/server/services/scaReachability.ts) — `buildImportIndex`, `annotateScaReachability`  
  - [`server/services/scaAnalyzer.ts`](../../../00_Full_Source_Code/server/services/scaAnalyzer.ts) — `scaPackage` / `scaEcosystem` on SCA vulns; calls annotate after NVD/KEV  
  - [`server/executeMvpScanBackground.ts`](../../../00_Full_Source_Code/server/executeMvpScanBackground.ts) — persists `scaReachability`  
  - [`shared/scaReachability.ts`](../../../00_Full_Source_Code/shared/scaReachability.ts) — labels and types  
  - [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) — `findings.sca_reachability`  
  - [`client/src/pages/Findings.tsx`](../../../00_Full_Source_Code/client/src/pages/Findings.tsx) — filter + URL  
  - [`client/src/components/FindingsTable.tsx`](../../../00_Full_Source_Code/client/src/components/FindingsTable.tsx) — column  
  - [`client/src/components/RemediationDialog.tsx`](../../../00_Full_Source_Code/client/src/components/RemediationDialog.tsx) — explanation card  
- **Schema / migrations:** `sca_reachability` nullable `text` on `findings` — `npm run db:push`  
- **API:** `GET /api/findings` rows include `scaReachability`; see [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json)  

---

## Manual testing steps

1. Run `npm run db:push` in `00_Full_Source_Code` so `sca_reachability` exists.  
2. Run an **MVP scan** on a repo that declares npm (or other supported) dependencies and produces SCA findings.  
3. Open **Findings**; confirm **SCA reach** column and filter options (`?scaReach=import_referenced`, etc.).  
4. Open **AI Remediation** on a dependency finding; confirm the **SCA reachability** card.  

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` (in `00_Full_Source_Code`) | **pass** |
| DB push | `npm run db:push` | **pass** (agent env) |

---

## User verification (required before next feature)

- [x] I followed the manual testing steps above  
- [x] Behavior matches the user-facing summary  
- [x] **Approved to proceed** — next feature: `P5-C4`

**Verified by:** product owner (proceed to P5-C4) — 2026-03-24  
**Comments:**  

---

## Rollback / risks

- Heuristic only; false positives/negatives vs full call-graph reachability. Copy in UI states this clearly.
