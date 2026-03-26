# Feature: `P4-D1` — Jira / Linear sync

**Short overview:** [`P4-D1-OWNER-REFERENCE.md`](./P4-D1-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P4-D1 |
|----------|---------|--------|
| **1** | User-visible UI | **Settings** — connect Jira Cloud / Linear; **Findings** — Create Jira/Linear issue, ticket link on row |
| **2** | Backend / shared | `tracker_connections` table, encrypted tokens, Jira REST v3 + Linear GraphQL, audit events |
| **Both** | This feature | **Both** |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Manual testing** | **Manual testing steps** below. |
| **User verification** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-D1` |
| **Phase** | Phase 4 — Enterprise governance and integrations |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx), [`FindingsTable.tsx`](../../../00_Full_Source_Code/client/src/components/FindingsTable.tsx).
- **Category 2 — Backend / shared:** [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) (`tracker_connections`, finding `trackerIssue*`), [`server/storage.ts`](../../../00_Full_Source_Code/server/storage.ts), [`server/services/trackerIssueService.ts`](../../../00_Full_Source_Code/server/services/trackerIssueService.ts), [`server/trackerIntegrationRoutes.ts`](../../../00_Full_Source_Code/server/trackerIntegrationRoutes.ts), [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts), [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json).

---

## User-facing summary

Connect **Jira Cloud** (site URL + Atlassian email + API token) or **Linear** (API key + default team UUID) in **Settings**. From **Findings**, use **More (⋮)** → **Create Jira issue** or **Create Linear issue** to open a ticket prefilled with severity, description, and remediation. The finding shows a **ticket link** after creation. **Bi-directional status sync** is not in this slice (future).

---

## Technical summary

| Area | Detail |
|------|--------|
| **Jira** | Basic auth (email + API token), `POST /rest/api/3/issue`, ADF description from plain text |
| **Linear** | `POST https://api.linear.app/graphql` — `issueCreate` |
| **Secrets** | AES-GCM via existing `encrypt` / `decrypt`; session-only credential APIs |
| **Demo** | `POST .../tracker-issue` returns **503** in demo mode |
| **Audit** | `tracker.jira_connect`, `tracker.jira_disconnect`, `tracker.linear_connect`, `tracker.linear_disconnect`, `tracker.issue_created` |

---

## Manual testing steps (product owner — browser)

1. **Findings** → row **⋮** — **Create Jira issue** and **Create Linear issue** are always listed for open, non–risk-accepted findings without a linked ticket. If not connected yet, they show a **Setup** hint and take you to **Settings** with a toast. After **Settings** → **Issue trackers** → **Connect Jira** (real Cloud site + token), use **Create Jira issue** again to create the issue and see the ticket link on the row.

2. **Linear** — Connect with API key and team ID; create issue from a finding; confirm in Linear.

3. **Disconnect** — Remove each integration; confirm menu items disappear.

4. **Audit log** — Optional: confirm `tracker.*` events after connect and issue create.

---

## Automated / agent testing performed

| Command / check | Result |
|-----------------|--------|
| `npm run check` | **pass** |
| `npm run db:push` | **pass** — `tracker_connections` + finding `tracker_issue_*` columns applied |
| `npm run verify:tracker-integration` | **pass** — `GET /api/tracker-connections` → **401** (route registered, session required) |

---

## User verification (required before next feature)

- [ ] **Category 1:** Settings + Findings create/link flow  
- [ ] **Category 2:** OpenAPI + audit + encrypted storage  
- [ ] **Approved to proceed** — next per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P4-D2** — Structured webhooks + SIEM)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Drop `tracker_connections`; remove finding columns `tracker_issue_*`; delete tracker routes/service; revert Settings/FindingsTable.  
- Future: OAuth 3LO (Jira), webhooks for status sync, bulk create, API-key access to create issues.
