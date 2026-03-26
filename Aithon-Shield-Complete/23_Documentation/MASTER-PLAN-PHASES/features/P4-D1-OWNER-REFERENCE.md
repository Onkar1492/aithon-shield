# P4-D1 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P4-D1-JIRA-LINEAR-SYNC.md`](./P4-D1-JIRA-LINEAR-SYNC.md).

---

## What is this feature?

**P4-D1** lets you **push a finding into Jira Cloud or Linear** as a new issue, so remediation work lives in the tools your team already uses.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Settings** | Connect **Jira Cloud** (URL, email, API token, default project + issue type) or **Linear** (API key, default team id). |
| **Findings** | **Create Jira issue** / **Create Linear issue** from the row menu; ticket **link** appears on the finding after success. |
| **Security** | Tokens encrypted in the database; credential endpoints require a **browser session** (not API keys). |

---

## Category: 1, 2, or both?

**Both** — UI plus server, storage, and external APIs.

---

## What is intentionally not in this version?

- **OAuth** for Jira (uses API token flow).  
- **Automatic status sync** when someone closes the ticket in Jira/Linear (would need webhooks or polling later).

---

## Documentation list

| Document | Role |
|----------|------|
| [`P4-D1-JIRA-LINEAR-SYNC.md`](./P4-D1-JIRA-LINEAR-SYNC.md) | Full feature doc, testing, verification. |
| [`P4-D1-OWNER-REFERENCE.md`](./P4-D1-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P4-D1 status row. |
