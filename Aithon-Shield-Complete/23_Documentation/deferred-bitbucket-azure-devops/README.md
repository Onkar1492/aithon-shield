# Deferred: Bitbucket & Azure DevOps (Phase 1 → Phase 3)

**Status:** Not in current sprint. Revisit in a few weeks.

**Context:** Scenario 1 implements **GitHub + GitLab only** for OAuth, PR creation, and CI-related flows. This folder holds the plan to add the other two major Git providers.

---

## When to schedule

Target: **Phase 3** of the master plan (after CI merge gates and `.aithonshield.yml` are stable), or earlier if a customer requires Bitbucket Cloud / Azure Repos.

**Estimated extra effort:** ~1.5–2 weeks wall-clock with AI-assisted implementation (vs. ~2 weeks traditional) — mostly duplicate adapter work after GitHub/GitLab patterns exist.

---

## Work breakdown

### Bitbucket Cloud

1. Register OAuth consumer in Atlassian developer console (callback URL: `https://<host>/api/integrations/bitbucket/callback`).
2. Env: `BITBUCKET_CLIENT_ID`, `BITBUCKET_CLIENT_SECRET`.
3. OAuth 2.0 authorization code flow; store tokens in `git_connections` with `provider = 'bitbucket'`.
4. API: Bitbucket REST 2.0 for branches, commits, pull requests (create PR from branch).
5. Extend [`server/remediation/gitAdapter.ts`](../../00_Full_Source_Code/server/remediation/gitAdapter.ts) (once created) with `BitbucketAdapter` implementing the same interface as GitHub/GitLab.

### Azure DevOps (Repos)

1. Register app in Azure AD / Entra ID; OAuth scopes for `Code (read, write, manage)` and `Pull Request Read & Write`.
2. Env: `AZURE_DEVOPS_CLIENT_ID`, `AZURE_DEVOPS_CLIENT_SECRET`, `AZURE_DEVOPS_TENANT` (if applicable).
3. Callback: `/api/integrations/azure-devops/callback`.
4. API: Azure DevOps REST for Git refs, pushes, and pull requests (organization + project + repo from user input or parsed URL).
5. Extend git adapter with `AzureDevOpsAdapter`.

### Product / UX

- Settings → Integrations: add “Connect Bitbucket” and “Connect Azure DevOps” alongside GitHub/GitLab.
- Repository URL parser: detect `bitbucket.org` and `dev.azure.com` / `visualstudio.com` and suggest the correct provider.
- Docs: required OAuth scopes, org policy notes (some enterprises block third-party OAuth).

### Data model

Reuse existing tables planned for GitHub/GitLab:

- `git_connections` — add `provider` enum values `bitbucket`, `azure_devops`.
- `remediation_jobs` — no schema change; adapter resolves provider from connection.

---

## Testing checklist

- [ ] OAuth connect / disconnect / token refresh
- [ ] Create branch + commit + open PR on a test repo
- [ ] Handle permission errors and expired tokens
- [ ] Webhook (optional): PR merged → remediation job state update (parity with GitHub)

---

## References

- [Bitbucket Cloud REST API](https://developer.atlassian.com/cloud/bitbucket/rest/intro/)
- [Azure DevOps Git REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/)
