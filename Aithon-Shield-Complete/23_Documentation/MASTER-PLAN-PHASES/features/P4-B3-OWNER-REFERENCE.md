# P4-B3 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P4-B3-SLA-ENFORCEMENT.md`](./P4-B3-SLA-ENFORCEMENT.md).

---

## What is this feature?

**P4-B3** adds an **SLA enforcement engine**:

1. **Targets** — You set **hours to fix** per severity (Critical / High / Medium / Low) in **Settings**.  
2. **Engine** — For each **open** finding, the app computes a **due time** from when the finding was **first seen** (`createdAt`).  
3. **SLA page** — Shows **breaches** (past due) and **upcoming** work ordered by deadline, plus an **at risk** band in the last 25% of the window.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Settings** | Card **SLA targets (hours)** with save |
| **Navigation** | **SLA** under Core |
| **Screen** | `/sla` — breaches table, upcoming table, summary counts |
| **API** | `GET /api/sla/summary`, `PATCH /api/user/sla-policy` (session) |

---

## Category: 1, 2, or both?

**Both** — UI plus database column, APIs, and shared evaluation logic.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P4-B3-SLA-ENFORCEMENT.md`](./P4-B3-SLA-ENFORCEMENT.md) | Full feature doc, testing, verification. |
| [`P4-B3-OWNER-REFERENCE.md`](./P4-B3-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P4-B3 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | SLA paths. |

---

## Step-by-step: test the UI only

1. **Settings** → set SLA hours → **Save**.  
2. Open **SLA** from the sidebar — confirm the page loads and numbers make sense for your data.  
3. Adjust targets and refresh to see changes in **upcoming** / **breaches**.
