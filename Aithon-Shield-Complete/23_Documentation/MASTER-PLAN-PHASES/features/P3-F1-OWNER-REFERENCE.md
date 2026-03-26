# P3-F1 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P3-F1-SECURITY-HEALTH.md`](./P3-F1-SECURITY-HEALTH.md).

---

## What is this feature?

**P3-F1** adds a **Security health** area that shows:

1. **Timeline** — How many **new** findings appeared each day and how many were **resolved**, plus a **health score** line over the same period (aligned with the dashboard’s scoring idea).  
2. **MTTR (mean time to remediate)** — Average time to resolve issues, **overall** and by **severity**, when the system records a resolution time.  
3. **Regressions** — A count of **open** findings that look like a **duplicate** of something already **resolved** (same project scan, same weakness id, same title).

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Navigation** | **Security Health** under Core (sidebar). |
| **Screen** | Cards for current health, MTTR, regressions, and a chart for daily new/resolved + health trend. |
| **Database** | A **resolution timestamp** on findings so MTTR can be measured fairly going forward. |
| **API** | `GET /api/security-health` returns the numbers the page uses. |

---

## Category: 1, 2, or both?

**Both** — a visible page and server-side metrics plus a small schema addition.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P3-F1-SECURITY-HEALTH.md`](./P3-F1-SECURITY-HEALTH.md) | Full feature doc, testing, verification. |
| [`P3-F1-OWNER-REFERENCE.md`](./P3-F1-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P3-F1 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | `GET /api/security-health`. |

---

## Step-by-step: test the UI only

1. **Database:** After deploy, ensure the schema is applied (your team’s usual `db:push` or migration step).  
2. **Sign in** and open **Security Health**.  
3. Change the range to **Last 7 days** / **30** / **90** and confirm the chart updates.  
4. **Resolve** a finding from **Findings**, return to **Security Health**, and refresh — **MTTR** and **resolved** bars should improve as data accumulates (timestamps must be set on resolve).  
5. Read the **Regressions** card — if the number is zero, that means no “came back after fix” pattern was detected with current data.
