# Feature: `P1-B1` — Project-level RBAC (orgs, roles, scan scoping)

| Field | Value |
|-------|--------|
| **Feature ID** | `P1-B1` |
| **Phase** | Phase 1 — Trust and foundation |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

### Category breakdown

- **Category 1 (Frontend):** [`Workspace.tsx`](../../../00_Full_Source_Code/client/src/pages/Workspace.tsx) lists organizations and roles via `GET /api/organizations` (session-only). Sidebar link under Resources. [`App.tsx`](../../../00_Full_Source_Code/client/src/App.tsx) route `/workspace`.
- **Category 2 (Backend):** [`rbac.ts`](../../../00_Full_Source_Code/server/rbac.ts) role weights; [`storage.ts`](../../../00_Full_Source_Code/server/storage.ts) org-scoped list/get/update/delete for MVP / mobile / web scans, findings visibility and mutation rules, `canMutate*` helpers; [`authMiddleware.ts`](../../../00_Full_Source_Code/server/authMiddleware.ts) ensures personal org on authenticated requests when `defaultOrganizationId` is missing; signup/login call [`ensurePersonalOrganization`](../../../00_Full_Source_Code/server/storage.ts); new scans set `organizationId` from `defaultOrganizationId`; [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) mutating scan endpoints enforce write permission (developer+ in org; legacy scans without `organizationId` remain owner-only). `GET /api/organizations` (session-only). [`schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) nullable `organization_id` on `mvp_code_scans`, `mobile_app_scans`, `web_app_scans` (organizations table moved earlier for FK order). OpenAPI updated.

---

## User-facing summary

Each account gets a **personal workspace** (organization) automatically on signup, login, or the first authenticated API request. **MVP, mobile, and web scans** you create are tied to your default organization so teammates in the same org can **see** shared scans and findings. **Viewer** and **auditor** roles can read but not start scans, upload, or delete; **developer**, **admin**, and **owner** can mutate scans. The **Workspace** page shows organizations you belong to and your **role**. Legacy scans with no organization remain visible only to the original owner.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Roles** | `owner`, `admin`, `developer` (write scans), `viewer`, `auditor` (read org scans only) — see `organization_members.role` |
| **Scoping** | List scans: `organization_id IN (user's orgs)` OR (`organization_id` IS NULL AND `user_id` = user). Read/write single scan uses same rules; write requires developer+ when `organization_id` is set |
| **Findings** | Listed if owned by user or if the finding’s `scanId`/`scanType` is an MVP/mobile/web scan the user can read; mutations require write access on that scan |
| **API** | `GET /api/organizations` — session cookie only (like audit log) |
| **Not in this slice** | Inviting users, changing roles, multiple org switching in UI, RBAC for pipeline/container/network/linter scans (still user-owned as before) |

---

## Manual testing steps

1. Apply DB schema: agent ran `npm run db:push` (or approve agent run in your environment).  
2. Sign **up** or **in** — open **Workspace** (`/workspace`); confirm at least one org and **owner** (or your role).  
3. Create an **MVP** (or mobile/web) scan — confirm it appears in lists; optional: inspect DB/API response for `organizationId` on the scan row.  
4. Confirm **Findings** and scan detail still work for your own scans.  
5. (Optional, multi-user) Add another user to the same org in DB with role `viewer` — confirm they can open the scan but **cannot** PATCH/delete/start scan (expect **403** on mutate).  
6. Confirm **API key** auth still works for list/create after first request (personal org backfill).  

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` | **pass** |
| DB push | `npm run db:push` | **pass** (changes applied) |

**Notes:** No automated E2E browser test in this run; manual steps above validate UX and permissions.

---

## User verification (required before next feature)

- [ ] Workspace page loads and shows my organization(s) and role  
- [ ] Scans and findings still behave as expected for my account  
- [ ] (If tested) viewer cannot mutate org scans  
- [ ] **Approved to proceed** — next feature: **`P1-A1`** (real remediation pipeline — GitHub + GitLab OAuth)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / risks

- `organization_id` columns are nullable; old rows stay personal-only until backfilled.  
- Multi-tenant invite/role management is **not** implemented yet; DB edits are required to simulate a second member.
