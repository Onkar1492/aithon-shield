# Feature: `P4-C2` — VEX document output

**Short overview:** [`P4-C2-OWNER-REFERENCE.md`](./P4-C2-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P4-C2 |
|----------|---------|--------|
| **1** | User-visible UI | **Compliance** — **VEX document (JSON)** download (workspace scope) |
| **2** | Backend / shared | `GET /api/vex/document`, `GET /api/mvp-scans/:id/vex`, `vexGenerator`, audit `vex.workspace_export` / `vex.mvp_scan_export` |
| **Both** | This feature | **Both** (phase table listed **2**; UI added for the same discoverability pattern as P4-G1) |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md). Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Manual testing** | **Manual testing steps** below. |
| **User verification** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-C2` |
| **Phase** | Phase 4 — Enterprise governance and integrations |
| **Category** | **Both** |
| **Status** | `user verified` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Compliance.tsx`](../../../00_Full_Source_Code/client/src/pages/Compliance.tsx) (`button-compliance-vex-workspace`).
- **Category 2 — Backend / shared:** [`server/services/vexGenerator.ts`](../../../00_Full_Source_Code/server/services/vexGenerator.ts), [`server/vexRoutes.ts`](../../../00_Full_Source_Code/server/vexRoutes.ts), [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts), [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json), [`shared/cveWatchlistUtils.ts`](../../../00_Full_Source_Code/shared/cveWatchlistUtils.ts) (CVE extraction).

---

## User-facing summary

Users can download a **CycloneDX 1.5–style VEX JSON** built from **findings that mention CVE IDs** in title, description, remediation, or AI suggestion text. **Analysis state** reflects finding workflow (e.g. open high/critical → `exploitable`, accepted risk → `not_affected` with justification, resolved/archived → `resolved`). **Workspace** export covers all non-archived findings; **MVP scan** export scopes to that scan’s findings. **Per-scan** URL matches the SBOM pattern: `/api/mvp-scans/:id/vex`.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Format** | `bomFormat: CycloneDX`, `specVersion: "1.5"`, `vulnerabilities[]` with `id` (CVE), `source`, `ratings[]`, `analysis.state` |
| **CVE detection** | `extractCveIdsFromText` (same as CVE watchlist) |
| **Audit** | `vex.workspace_export`, `vex.mvp_scan_export` |
| **Agent smoke** | `npm run verify:vex` (running server on `PORT`) |

---

## Manual testing steps (product owner — browser)

1. **Compliance** → **VEX document (JSON)**. Confirm download and open JSON: `bomFormat` = CycloneDX, `vulnerabilities` array (may be empty if no CVE text in findings).

2. **Audit log**: after download, find **`vex.workspace_export`**.

3. (Optional) With at least one **MVP scan**, call **`GET /api/mvp-scans/<id>/vex`** (browser devtools, API client, or curl with session) and confirm JSON; audit **`vex.mvp_scan_export`**.

---

## Automated / agent testing performed

| Command / check | Result |
|-----------------|--------|
| `npm run check` | **pass** (agent env, after doc + onboarding line) |
| `GET /api/vex/document` without session cookie | **401** |
| `npm run verify:vex` with `npm run dev` | **pass** — log: `verify:vex PASS — workspace + mvp scan scoped VEX OK` (`cli/devServerPort.ts` matches `package.json` `dev` `PORT`) |

**Note:** If the UI shows `API route not found` for `/api/vex/document`, restart the Node dev server and open the app on the same port as `/api/health` (see master-plan rule *Dev server: API route not found*).

---

## User verification (required before next feature)

- [x] **Category 1:** Compliance VEX button works  
- [x] **Category 2:** OpenAPI + MVP route + audit events  
- [x] **Approved to proceed** — next per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P4-D1** — Jira / Linear sync)

**Verified by:** product owner (confirmed in chat)  
**Comments:** VEX download verified working.  

---

## Rollback / notes

- Remove `registerVexRoutes`, delete `vexRoutes.ts` / `vexGenerator.ts`, revert Compliance button and OpenAPI.  
- Future: link VEX entries to SBOM `bom-ref`, CSAF export, org-level publisher metadata.
