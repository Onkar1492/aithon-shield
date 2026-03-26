# Feature: `P1-B2` — Immutable audit log (API + UI + emission)

| Field | Value |
|-------|--------|
| **Feature ID** | `P1-B2` |
| **Phase** | Phase 1 — Trust and foundation |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

### Category breakdown

- **Category 1 (Frontend):** [`AuditLog.tsx`](../../../00_Full_Source_Code/client/src/pages/AuditLog.tsx) loads events from the API, filter box, **Export CSV** button, loading and error states, metadata preview.
- **Category 2 (Backend):** [`auditEmitter.ts`](../../../00_Full_Source_Code/server/auditEmitter.ts), `GET /api/audit-events`, `GET /api/audit-events/export.csv` (session-only), `logAuditEvent` wired into auth, API keys, profile, MVP scan create/delete/start. OpenAPI subset updated.

---

## User-facing summary

The **Audit Log** page shows a chronological list of security-relevant actions for your account. You can filter by text and download a CSV export. New actions (login, signup, API key changes, profile updates, MVP scan create/delete/start) create new rows automatically.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Emitter** | `server/auditEmitter.ts` — `logAuditEvent`, `getRequestMeta`; failures logged, never thrown to callers |
| **Routes** | `server/routes.ts` — audit routes after API keys; emissions on listed actions |
| **Storage** | `storage.insertAuditEvent`, `storage.listAuditEvents` (existing from P1-PREREQ) |
| **Schema** | `audit_events` table (append-only by convention — no update/delete routes) |
| **OpenAPI** | `public/openapi.json` — `/api/audit-events`, `/api/audit-events/export.csv` |
| **Session** | List + CSV use **`requireSessionAuth`** (not API key) so agents cannot read audit via the same key used for scans |

### Actions currently audited

| Action | When |
|--------|------|
| `auth.signup` | After user created |
| `auth.login` | Successful password login |
| `auth.logout` | Before session destroyed |
| `api_key.create` / `api_key.delete` | After success |
| `user.profile_update` | After profile patch (field names only in metadata, not password value) |
| `mvp_scan.create` / `mvp_scan.delete` / `mvp_scan.scan_started` | After success |

*(Additional scan types and findings can be added in a follow-up feature.)*

---

## Manual testing steps

1. Apply DB schema: agent ran `npm run db:push` (or run via agent approval in your environment).  
2. Start the app, sign **up** or **in** — open **Audit Log** (`/audit-log`).  
3. Confirm rows appear for `auth.signup` or `auth.login`.  
4. **Logout** and **login** again — confirm `auth.logout` and `auth.login`.  
5. In **Settings**, create and revoke an **API key** — confirm `api_key.create` and `api_key.delete`.  
6. Update **profile** (e.g. name) — confirm `user.profile_update` with `updatedFields` in metadata.  
7. Create an **MVP code scan**, **start scan**, then **delete** the scan — confirm `mvp_scan.*` events.  
8. Use the **search** box — filter by `mvp` or `auth`.  
9. Click **Export CSV** — file downloads and contains columns `id,createdAt,action,resourceType,resourceId,userId,ipAddress`.  

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` | **pass** |
| DB push | `npm run db:push` | **pass** (changes applied) |

**Notes:** No automated E2E browser test in this run; manual steps above validate UX.

---

## User verification (required before next feature)

- [ ] Audit Log page loads without error while signed in  
- [ ] Events appear for actions I performed  
- [ ] CSV export works  
- [ ] **Approved to proceed** — next feature: **`P1-B1`** (project-level RBAC)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / risks

- Removing audit emission is a code revert; existing `audit_events` rows remain in DB.  
- CSV export is capped at **5000** rows per download.
