# Feature: `P1-C1` — SBOM generation (CycloneDX / SPDX) for MVP / SCA

| Field | Value |
|-------|--------|
| **Feature ID** | `P1-C1` |
| **Phase** | Phase 1 — Trust and foundation |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

### Category breakdown

- **Category 1 — Frontend:** [`MvpCodeScan.tsx`](../../../00_Full_Source_Code/client/src/pages/MvpCodeScan.tsx) — when a scan is **completed** and `sbomAvailable` is true, **CycloneDX JSON** and **SPDX JSON** download buttons (browser download via `GET /api/mvp-scans/:id/sbom`).
- **Category 2 — Backend:** [`sbomGenerator.ts`](../../../00_Full_Source_Code/server/services/sbomGenerator.ts) builds CycloneDX 1.5 and SPDX 2.3 documents from the same dependency manifest as SCA (`parseDependencies` in [`scaAnalyzer.ts`](../../../00_Full_Source_Code/server/services/scaAnalyzer.ts)). [`mvpScanService.ts`](../../../00_Full_Source_Code/server/services/mvpScanService.ts) runs SBOM generation before temp clone cleanup; [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) persists `sbom_cyclonedx_json`, `sbom_spdx_json`, `sbom_generated_at`, strips large blobs from list/detail JSON (`sbomAvailable` flag), exposes download route.

---

## User-facing summary

After an **MVP code scan** completes successfully, the scan detail card can show **Software bill of materials (SBOM)** with two downloads: **CycloneDX JSON** and **SPDX JSON**, built from dependency manifests found in the cloned repo (same inputs as the SCA step).

---

## Technical summary

| Area | Detail |
|------|--------|
| **Schema** | `mvp_code_scans`: `sbom_cyclonedx_json`, `sbom_spdx_json` (jsonb), `sbom_generated_at` (timestamp). Insert schema omits SBOM fields (server-only). |
| **API** | `GET /api/mvp-scans` and `GET /api/mvp-scans/:id` omit SBOM JSON; include `sbomAvailable: boolean`. `GET /api/mvp-scans/:id/sbom?format=cyclonedx\|spdx` returns JSON attachment. |
| **OpenAPI** | `public/openapi.json` — `/api/mvp-scans/{id}/sbom` |

---

## Manual testing steps

1. Apply DB schema in your environment (agent ran `npm run db:push` where `DATABASE_URL` is set).  
2. Create or use an MVP scan whose repo has a discoverable manifest (e.g. `package.json`).  
3. Run **Start scan** and wait until status is **completed**.  
4. Confirm the **SBOM** section appears and both **CycloneDX** and **SPDX** downloads succeed; open files and verify JSON shape (`bomFormat` / `spdxVersion`).  
5. Confirm list view does not embed large SBOM payloads (network response size / `sbomAvailable` only).

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` | **pass** |
| DB push | `npm run db:push` | **pass** (changes applied) |

---

## Rollback / notes

- To clear SBOM for a row: set `sbom_cyclonedx_json`, `sbom_spdx_json` to null and `sbom_generated_at` to null via DB or a future admin path (not exposed in UI).  
- SBOM reflects **declared** manifest versions (same as current SCA parser), not necessarily lockfile-resolved graphs for all ecosystems.

---

## User verification (required before next feature)

- [ ] SBOM section appears after a completed MVP scan with dependencies  
- [ ] Both JSON downloads open and look valid  
- [ ] **Approved to proceed** — next feature: **`P1-D3`** (API rate limiting + per-key scopes) per phase index  
