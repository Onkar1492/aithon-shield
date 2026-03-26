# P3-A2 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P3-A2-MERGE-GATE.md`](./P3-A2-MERGE-GATE.md).

---

## Categories

| | |
|--|--|
| **1** | Settings screen: merge gate instructions + **Try it** form (no commands). |
| **2** | GitHub shows a **Check** on your commit; optional **PR comment**. |
| **Both** | This feature — **Both**. |

---

## What is this feature?

**P3-A2** adds a **merge gate** integration for **GitHub**:

1. **Check Run** — Your CI (or the in-app test form) tells Aithon Shield to post a **status check** on a specific commit.  
2. **PR comment** — Optionally, the same call can add a **comment** on the pull request.  
3. **CLI** — The codebase includes a small **`merge-gate`** script for pipelines to call the same API (configured in CI, not from this screen).

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Settings** | **CI/CD merge gate (GitHub)** — instructions + browser test when GitHub is linked. |
| **API** | `POST /api/merge-gate/github/report` (session or API key). |
| **GitHub** | Uses your **Connect GitHub** token. |

---

## Documentation list

| Document | Role |
|----------|------|
| [`P3-A2-MERGE-GATE.md`](./P3-A2-MERGE-GATE.md) | Full feature doc, categories, verification. |
| [`P3-A2-OWNER-REFERENCE.md`](./P3-A2-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P3-A2 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | `POST /api/merge-gate/github/report`. |

---

## Demo mode vs full test

| URL | Banner | Git + merge gate |
|-----|--------|-----------------|
| [http://127.0.0.1:5001](http://127.0.0.1:5001) | Yellow **Demo mode** | Off — docs review only |
| [http://127.0.0.1:5002](http://127.0.0.1:5002) | None | **On** — full test |

The non-demo server at **port 5002** is already running (started by the agent). Open it in your browser — no Terminal needed.

## Step-by-step: full test at [http://127.0.0.1:5002](http://127.0.0.1:5002) (no Terminal for you)

1. Open [http://127.0.0.1:5002/settings](http://127.0.0.1:5002/settings) → sign in.  
2. **Git integrations** → **Connect GitHub** → authorise → confirm account listed.  
3. **CI/CD merge gate (GitHub)** → **Try it** form appears.  
4. Enter `owner/repo`, commit SHA from GitHub, conclusion, optional PR # → **Send test check run**.  
5. On GitHub, confirm the **Aithon Shield** check on that commit (and PR comment if set).

Typecheck and CI wiring are handled by the agent — **not** by the product owner running shell commands.
