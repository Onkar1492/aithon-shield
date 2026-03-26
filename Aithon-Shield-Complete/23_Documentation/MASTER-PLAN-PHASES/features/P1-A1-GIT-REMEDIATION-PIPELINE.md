# Feature: `P1-A1` — Git OAuth + remediation PR/MR pipeline

| Field | Value |
|-------|--------|
| **Feature ID** | `P1-A1` |
| **Phase** | Phase 1 — Trust and foundation |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

### Category breakdown

- **Category 1 (Frontend):** [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx) — **Git integrations** card: connect GitHub/GitLab (full-page OAuth), list connections, disconnect, OAuth return toasts; demo mode hides connect actions.
- **Category 2 (Backend):** [`gitIntegrationRoutes.ts`](../../../00_Full_Source_Code/server/gitIntegrationRoutes.ts) — OAuth start/callback, `GET/DELETE /api/git-connections`, `GET/POST /api/remediation-jobs`, `GET /api/remediation-jobs/:id`; [`remediationPrWorker.ts`](../../../00_Full_Source_Code/server/remediationPrWorker.ts) — async job: Octokit PR (GitHub) or GitLab API MR; [`oauthStateStore.ts`](../../../00_Full_Source_Code/server/oauthStateStore.ts); storage `userCanReadScanByType` exposed on `IStorage` for authorization.

---

## User-facing summary

In **Settings**, you can link **GitHub** or **GitLab** with OAuth. After linking, the API can create **remediation jobs** that open a branch, add a markdown summary of scan findings, and open a **pull request** (GitHub) or **merge request** (GitLab). **Demo mode** disables OAuth start and job creation.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Env** | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`; `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`; optional `GITLAB_BASE_URL` (default `https://gitlab.com`); optional `GITHUB_OAUTH_SCOPE` (default `repo`), `GITLAB_OAUTH_SCOPE` (default `api write_repository`); **`APP_BASE_URL`** when public URL differs from `Host` (reverse proxy). |
| **Encryption** | Access (and GitLab refresh) tokens stored via existing `encrypt` / `decrypt` in `git_connections`. |
| **Audit** | `git.connect`, `git.disconnect`, `remediation.job.create` via `logAuditEvent`. |
| **Scan access** | Jobs require `storage.userCanReadScanByType` for the given `scanType` / `scanId`. |

### OpenAPI

`public/openapi.json` — paths under `/api/oauth/*`, `/api/git-connections`, `/api/remediation-jobs`.

---

## Manual testing steps

1. Register OAuth applications: redirect URIs must match **`{APP_BASE_URL or origin}/api/oauth/github/callback`** and **`…/api/oauth/gitlab/callback`**.  
2. Set env vars, restart server, sign in → **Settings** → **Connect GitHub** / **Connect GitLab** → complete OAuth → confirm toast and listed account.  
3. Call **`POST /api/remediation-jobs`** (session cookie or browser `fetch` from devtools) with a scan you can read, `provider`, and `repoFullName` (`owner/repo` on GitHub; GitLab `namespace/project` path or project id).  
4. Poll **`GET /api/remediation-jobs?scanType=…&scanId=…`** or **`GET /api/remediation-jobs/:id`** until `succeeded` or `failed`; open `prUrl` on success.  
5. **Disconnect** in Settings — row removed.  
6. **Demo mode** (`AITHON_DEMO_MODE=true`): connect buttons hidden; `POST /api/remediation-jobs` and OAuth start return **403**.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` | run in agent env |

**Notes:** Live OAuth and PR/MR creation require real apps and repos; not executed in CI here.

---

## User verification (required before next feature)

- [ ] OAuth connect + disconnect works for at least one provider  
- [ ] Remediation job creates an expected PR/MR on a test repo  
- [ ] **Approved to proceed** — next feature per master plan  
