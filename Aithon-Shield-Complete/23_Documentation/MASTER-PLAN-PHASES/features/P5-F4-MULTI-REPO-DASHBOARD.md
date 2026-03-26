# Feature: Multi-repo / multi-environment dashboard

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-F4` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **1** (UI-focused, with supporting API) |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

A new **"Repos & Environments"** page (accessible from the sidebar) gives a bird's-eye view of every repository and application that has been scanned, grouped by project and broken down by branch/environment.

Each repo card shows:
- Total scans, open findings, critical/high counts
- Last scan date and status (completed / failed / running)
- Expandable branch breakdown with per-branch stats

This replaces the need to manually navigate between scan types to understand the security posture of each project.

---

## Technical summary

| Piece | Location |
|-------|----------|
| Aggregation engine | `server/services/repoEnvironmentSummaryService.ts` |
| API | `GET /api/repo-environment-summary` in `server/routes.ts` |
| UI page | `client/src/pages/ReposDashboard.tsx` |
| Route | `/repos` in `client/src/App.tsx` |
| Sidebar nav | "Repos & Environments" in `client/src/components/AppSidebar.tsx` |

### How grouping works

- **MVP scans** are grouped by normalized `repositoryUrl` (host + path, lowercase, no `.git`). Branch comes from the scan's `branch` field (defaults to "main").
- **Mobile scans** are grouped by `appName` with a synthetic key `mobile/<name>`. Branch is "default".
- **Web scans** are grouped by `appName` or `appUrl` with key `web/<name>`. Branch is "default".

Repos are sorted by severity: critical findings first, then high, then open count, then total scans.

---

## Category breakdown

- **Category 1 (Frontend):** `ReposDashboard.tsx` — summary cards (total repos, scans, findings), repo list with expandable branch breakdown, severity-sorted cards; `AppSidebar.tsx` — nav item; `App.tsx` — `/repos` route.
- **Category 2 (Backend):** `repoEnvironmentSummaryService.ts` — aggregation engine grouping MVP scans by normalized repo URL, mobile by app name, web by app name/URL; `routes.ts` — `GET /api/repo-environment-summary` endpoint.

---

## Manual testing

1. Open the web app and click **"Repos & Environments"** in the sidebar.
2. You should see summary cards (total repos, total scans, open findings).
3. Below that, each repo/app is listed with scan types, branch count, and finding stats.
4. Click a repo card to expand it — see the branch breakdown with per-branch scan counts and findings.
5. Verify the data matches what you see on the All Scans and Findings pages.

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

- Grouping is heuristic — repos are matched by normalized URL. Two slightly different URLs for the same repo will appear as separate entries.
- No schema migration required — all data is computed on the fly from existing scan and finding tables.
- Mobile and web scans always show "default" as the branch since they don't have a branch concept.
