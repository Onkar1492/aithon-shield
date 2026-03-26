# Feature: `P3-A2` — CI/CD merge gate (GitHub Check Run, CLI, PR comment)

**Short overview:** [`P3-A2-OWNER-REFERENCE.md`](./P3-A2-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P3-A2 |
|----------|---------|--------|
| **1** | User-visible UI / navigation | Settings → **CI/CD merge gate (GitHub)** — instructions, browser test form |
| **2** | Backend, APIs, automation | `POST /api/merge-gate/github/report`, audit event, `cli/merge-gate.ts`, npm script `merge-gate` |
| **Both** | This feature | **Both** — you validate **Category 1** in the app and **Category 2** on GitHub (Checks / PR) |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md) **Categories**. Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Product-only testing** | **Product owner test guide** below (no Terminal). |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P3-A2` |
| **Phase** | Phase 3 — Analytics and continuous monitoring |
| **Category** | **Both** — Category 1: Settings UI + copy-safe API docs. Category 2: GitHub Checks API + optional issue comment, `merge-gate` CLI entry. |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx) — **CI/CD merge gate (GitHub)** card: browser “Try it” form (repo, SHA, conclusion, optional PR, summary), API/CI notes without asking the product owner to run shell commands.
- **Category 2 — Backend:** [`mergeGateRoutes.ts`](../../../00_Full_Source_Code/server/mergeGateRoutes.ts) — `POST /api/merge-gate/github/report` (OAuth token from `git_connections` for `github`). [`cli/merge-gate.ts`](../../../00_Full_Source_Code/cli/merge-gate.ts) — `npm run merge-gate` with `AITHON_API_KEY` / `AITHON_API_BASE_URL`. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json). GitLab merge-request status is **not** in this slice (GitHub-first).

---

## User-facing summary

Teams can **publish a GitHub Check Run** on a commit (and optionally **comment on the pull request**) using the same GitHub account they linked in Settings. CI can call the HTTP API with an API key, or use the **merge-gate** CLI helper in this repository. **Demo mode** disables merge gate reporting.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Auth** | Session cookie or API key (`write` required for POST). |
| **GitHub** | `@octokit/rest` — `checks.create` + `issues.createComment` when `pullRequestNumber` set. |
| **Env (CLI)** | `AITHON_API_KEY`, `AITHON_API_BASE_URL` or `AITHON_BASE_URL` (default `http://127.0.0.1:5001`). |

---

## Product owner test guide (browser + GitHub — no Terminal)

### Demo mode vs full verification (read this first)

| Environment | Git connect + merge gate API | What you can verify |
|-------------|-------------------------------|---------------------|
| **Demo mode** — port 5001 (yellow banner) | **Disabled** on purpose | UI copy and disabled messaging only. Cannot complete end-to-end P3-A2 here. |
| **Non-demo** — port **5002** (no banner) | **Enabled** | Full flow: sign in, link GitHub, use **Try it**, see Check Run + optional PR comment on GitHub. |

**The non-demo server is already running at [http://127.0.0.1:5002](http://127.0.0.1:5002).** Open that URL in your browser — no Terminal needed. Sign in with the same credentials (e.g. `milan@yahoo.com`).

---

### A — While in demo mode at port 5001 (partial verification only)

1. Open **Settings** → **CI/CD merge gate (GitHub)**.  
2. Confirm the section shows the disabled message explaining demo mode blocks Git and merge gate.  
3. This is **documentation / UX review** only — not a live GitHub test.

---

### B — Full verification at [http://127.0.0.1:5002](http://127.0.0.1:5002) (no Terminal for you)

**Prerequisites:** No yellow demo banner visible; **GitHub** connected in Settings; a repo you control on GitHub.

1. **Open** [http://127.0.0.1:5002/settings](http://127.0.0.1:5002/settings) in your browser. Sign in.

2. **Connect GitHub** — scroll to **Git integrations** → **Connect GitHub** → authorise in GitHub → return to Settings and confirm the account appears.

3. **Scroll to CI/CD merge gate (GitHub)** — confirm the **Try it (browser)** form is visible.

4. **Prepare a commit SHA** — in GitHub, open any repo you own → **Commits** → copy a full or short SHA.

5. **Fill the form** — enter `owner/repo`, the SHA, pick **Conclusion**, optional **PR number**, summary → **Send test check run** → success toast.

6. **Verify on GitHub** — open that commit or the repo **Checks** tab. Confirm the **Aithon Shield** check with the chosen conclusion. If you set a PR number, confirm a comment on that PR.

---

## Automated / agent testing (not run by the product owner)

| Check | Who runs it | Result |
|-------|-------------|--------|
| Typecheck `npm run check` | Agent / CI in `00_Full_Source_Code` | **pass** (last agent run) |
| `merge-gate` CLI | Agent / CI when `AITHON_API_KEY` and server URL are set | Exercises same API as automation |

---

## User verification (required before next feature)

- [ ] **Demo mode (optional):** Settings shows disabled merge gate + Git messaging consistently (no expectation of live GitHub).  
- [ ] **Category 1 (non-demo):** Merge gate section and **Try it** form appear after GitHub is linked.  
- [ ] **Category 2 (non-demo):** A GitHub Check Run appears on the chosen commit; optional PR comment when PR number is set.  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove `registerMergeGateRoutes` from [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) and delete [`mergeGateRoutes.ts`](../../../00_Full_Source_Code/server/mergeGateRoutes.ts) / `cli/merge-gate.ts` if reverting.  
- GitLab-native merge status can be added later.
