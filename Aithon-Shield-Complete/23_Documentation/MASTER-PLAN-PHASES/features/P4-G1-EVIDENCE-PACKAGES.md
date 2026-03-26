# Feature: `P4-G1` — One-click compliance evidence packages

**Short overview:** [`P4-G1-OWNER-REFERENCE.md`](./P4-G1-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P4-G1 |
|----------|---------|--------|
| **1** | User-visible UI | **Compliance** page — **Evidence package (ZIP)** button; **sidebar → Core → Compliance** (after Risk exceptions); onboarding governance link |
| **2** | Backend / shared | `GET /api/compliance/evidence-package` (ZIP stream), `archiver`, audit `compliance.evidence_package_download` |
| **Both** | This feature | **Both** |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md). Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Product-only testing** | **Manual testing steps** below. |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-G1` |
| **Phase** | Phase 4 — Enterprise governance and integrations |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Compliance.tsx`](../../../00_Full_Source_Code/client/src/pages/Compliance.tsx), [`SecurityOnboardingWizard.tsx`](../../../00_Full_Source_Code/client/src/components/SecurityOnboardingWizard.tsx).
- **Category 2 — Backend / shared:** [`server/complianceEvidenceRoutes.ts`](../../../00_Full_Source_Code/server/complianceEvidenceRoutes.ts), [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts) (early registration), [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json), dependency **`archiver`**.

---

## User-facing summary

From **Compliance & Standards**, users can download a **single ZIP** with operational evidence: **findings** (JSON + CSV), **recent audit events**, **SLA summary** (breaches/upcoming from current policy), **risk exceptions**, plus **README.txt** and **manifest.json**. Intended for auditors and internal governance. The action is logged to the **audit log**.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Endpoint** | `GET /api/compliance/evidence-package` — `requireAuth` (session or API key **read**). |
| **Response** | `Content-Type: application/zip`, `Content-Disposition: attachment`. |
| **ZIP entries** | `manifest.json`, `README.txt`, `findings.json`, `findings-summary.csv`, `audit-events.json`, `sla-summary.json`, `risk-exceptions.json` |
| **Findings** | Includes archived (`getAllFindings(userId, true)`). |
| **Audit** | `compliance.evidence_package_download` |
| **Agent smoke** | `npm run verify:compliance-evidence` (needs **running** server on `PORT`; uses `python3` to list ZIP entries). |

---

## Manual testing steps (product owner — browser)

1. Sign in. Open **Compliance** (`/compliance`). Click **Evidence package (ZIP)**. Confirm a `.zip` file downloads and your OS can open it.

2. Inside the ZIP, confirm **README.txt**, **manifest.json**, **findings.json**, **findings-summary.csv**, **audit-events.json**, **sla-summary.json**, **risk-exceptions.json** exist.

3. Open **Audit log** and confirm an event for **`compliance.evidence_package_download`** after a successful download.

4. (Optional) Call the same URL with an API key that has **read** scope; expect a ZIP download.

---

## Automated / agent testing performed

| Command / check | Result |
|-----------------|--------|
| `npm run check` | **pass** |
| `npm run verify:compliance-evidence` (with dev server on same `PORT`) | **pass** after agent started server and ran script |
| `GET /api/compliance/evidence-package` unauthenticated | **401** (via running server) |

**Note:** If the UI or script returns **`API route not found`**, the running Node process is stale — restart the dev server from current `00_Full_Source_Code` and match browser `PORT`.

---

## User verification (required before next feature)

- [ ] **Category 1:** Button downloads ZIP; contents look correct  
- [ ] **Category 2:** OpenAPI and audit event align with behavior  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P4-C2** implemented; next queued: **P4-D1**)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove route registration, delete `complianceEvidenceRoutes.ts`, revert Compliance button, `npm uninstall archiver`.  
- Future: per-framework annex PDFs, SBOM attachments, org-scoped packages.
