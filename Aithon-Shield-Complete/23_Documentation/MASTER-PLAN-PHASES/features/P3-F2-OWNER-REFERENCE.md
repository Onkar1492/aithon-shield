# P3-F2 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P3-F2-SCHEDULED-SCANS.md`](./P3-F2-SCHEDULED-SCANS.md).

---

## What is this feature?

**P3-F2** adds **scheduled MVP code scans** and **drift**:

1. **Schedules** — You pick an MVP scan and how often to re-run it (daily / weekly / monthly; custom is a placeholder).  
2. **Engine** — The server wakes up on a timer, finds due jobs, and runs MVP scans in the background.  
3. **Drift** — After each run, the system stores counts and compares them to the **previous** scheduled run so you can see whether findings went up or down.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Navigation** | **Scheduled Scans** under Core (sidebar). |
| **Screen** | Table of schedules, create dialog, active toggle, delete. |
| **Database** | **Last-run summary** JSON on each schedule for drift. |
| **API** | Existing CRUD for `/api/scheduled-scans`; create sets **next run** ~1 minute out. |

---

## Category: 1, 2, or both?

**Both** — UI plus server engine and schema.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P3-F2-SCHEDULED-SCANS.md`](./P3-F2-SCHEDULED-SCANS.md) | Full feature doc, testing, verification. |
| [`P3-F2-OWNER-REFERENCE.md`](./P3-F2-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P3-F2 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | `/api/scheduled-scans`. |

---

## Step-by-step: test in the app (no terminal)

**Categories:** **1** = UI/navigation; **2** = server behavior you can *see* in the app (last run, drift). This feature is **Both**.

1. **Sign in** and open **Scheduled Scans** from the sidebar (`/scheduled-scans`).  
2. **Create** a schedule linked to an MVP scan; confirm **Next run** is about a minute out.  
3. **Wait** for that time and for a full MVP run to finish; confirm **Last run** updates.  
4. **Wait** for the next scheduled run; confirm **Drift** shows deltas when counts change vs the previous run.  
5. Turn **Active** off to pause; **Delete** to remove the schedule.  
6. **Optional:** Run a manual MVP scan once to confirm nothing regressed.

Schema and typecheck are handled by the agent/CI or deploy — **not** by the product owner running shell commands.
