# Feature: `P5-C10` — API security testing module (OpenAPI static analysis)

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-C10` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **Both** (API + findings + New Scan UI) |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

You can start an **OpenAPI / API contract** scan from **Scans → New Scan**. Provide either:

- A **URL** to fetch OpenAPI 3.x JSON or YAML, and/or  
- **Pasted** spec text in the dialog.

The server runs a **static** analysis job (no attack traffic against your API): it reports contract hygiene such as missing `securitySchemes`, operations without a `security` requirement, cleartext `http://` server URLs, and a high-level operation count. This **does not** replace DAST or tools like OWASP ZAP — it complements them with **design-time** checks.

---

## Technical summary

- **Analyzer:** [`server/services/openApiApiSecurityService.ts`](../../../00_Full_Source_Code/server/services/openApiApiSecurityService.ts) — `analyzeOpenApiApiSecurity`, `fetchOpenApiSpecText`  
- **Job:** [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — `runApiSecurityScanJob`  
- **Storage:** [`server/storage.ts`](../../../00_Full_Source_Code/server/storage.ts) — `api_security_scans` CRUD + `userCanReadScanByType` / `userCanWriteScanByType` for `api`  
- **Schema:** [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) — `apiSecurityScans`, `findings.api_security_scan_id`  
- **UI:** [`client/src/components/NewScanDialog.tsx`](../../../00_Full_Source_Code/client/src/components/NewScanDialog.tsx), [`Scans.tsx`](../../../00_Full_Source_Code/client/src/pages/Scans.tsx), [`ScanDetails.tsx`](../../../00_Full_Source_Code/client/src/pages/ScanDetails.tsx)  
- **Attack path:** [`shared/attackPathGraphModel.ts`](../../../00_Full_Source_Code/shared/attackPathGraphModel.ts) — OpenAPI / swagger heuristic → initial phase  
- **OpenAPI doc:** [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — `/api/api-security-scans`  

---

## Result parameters (output shape)

| Field / concept | Value |
|-----------------|--------|
| **Finding `source`** | `api-security-scan` |
| **Finding `scanType`** | `api` |
| **Finding `apiSecurityScanId`** | UUID of `api_security_scans` row |
| **Finding `category`** | **`API Security`** (all findings from this job) |
| **Finding `asset`** | Scan label (`apiName`) |
| **Typical severities** | **LOW** (OpenAPI summary, large surface), **MEDIUM** (no `securitySchemes`, many unauthenticated ops, cleartext server URL, no operations), **HIGH** (parse failure, missing `paths`, sensitive/state-changing ops without `security`) |
| **Spec input** | `specUrl` (fetched server-side) and/or `specBody` (paste); at least one required on create |

---

## Manual testing (detailed)

1. **Paste minimal OpenAPI 3.0 JSON**  
   - New Scan → **OpenAPI / API contract** → label `Test API`, paste a minimal valid `openapi: 3.0.0` with one `paths` entry and `info`.  
   - Open **Scan details** (`/scan-details/api/{id}`) and **Findings**; expect category **API Security** and at least a **LOW** summary finding.

2. **Unauthenticated operations**  
   - Use a spec with `paths` and methods but **no** global `security`, **no** per-operation `security`, and empty or missing `components.securitySchemes`.  
   - Expect findings for missing schemes and operations without `security` (severities depend on path/method heuristics).

3. **Cleartext server**  
   - Add `servers: [{ url: "http://example.com" }]` or set **Base URL override** to `http://...`.  
   - Expect a **MEDIUM** finding about cleartext `http://`.

4. **Invalid spec**  
   - Paste non-JSON/non-YAML garbage.  
   - Expect **HIGH** parse failure (or similar) and scan may end **completed** with findings (analyzer returns a finding for parse errors).

5. **Fetch from URL**  
   - Use a public `https://` OpenAPI URL (e.g. a well-known petstore sample).  
   - Ensure scan completes and findings appear.

6. **Scans list**  
   - Confirm the row appears as **API Security** and links to scan details.

7. **Failed fetch**  
   - Use a spec URL that returns 404 or is unreachable.  
   - Expect scan **failed** with `scanError` visible on the scan details progress card.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| Schema | `npm run db:push` | **applied** |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above  
- [ ] Behavior matches the user-facing summary  
- [ ] **Approved to proceed** — next feature in plan: `P5-C7` (or as prioritized in `_STATUS.md`)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / risks

- Server **fetches user-supplied URLs** (SSRF surface). URLs are only fetched server-side with a timeout and size cap; still avoid pointing at internal-only hosts in untrusted environments.  
- Static analysis can **false-positive** on intentionally public endpoints.  
- **YAML** parsing: extremely large or deeply nested YAML could be expensive — cap enforced on character length.
