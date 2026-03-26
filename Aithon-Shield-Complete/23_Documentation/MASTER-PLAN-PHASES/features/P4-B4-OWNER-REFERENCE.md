# P4-B4 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P4-B4-RISK-ACCEPTANCE.md`](./P4-B4-RISK-ACCEPTANCE.md).

---

## What is this feature?

**P4-B4** adds a **risk acceptance** workflow:

1. **Accept risk** — From **Findings**, document why a finding is not being fixed now (justification), optionally when that decision expires.  
2. **Status** — The finding becomes **`accepted-risk`** so it is not treated as an open SLA breach for that window.  
3. **Revoke** — Return the finding to **open** from the Findings row or **Risk exceptions**.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Findings** | **Accept risk** (more menu), **Revoke acceptance** when applicable |
| **Navigation** | **Risk exceptions** under Core |
| **Screen** | `/risk-exceptions` — active and history tables |
| **API** | `GET/POST /api/risk-exceptions`, `POST .../revoke-by-finding`, `POST .../:id/revoke` |

---

## Category: 1, 2, or both?

**Both** — UI plus database table, APIs, and SLA alignment.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P4-B4-RISK-ACCEPTANCE.md`](./P4-B4-RISK-ACCEPTANCE.md) | Full feature doc, testing, verification. |
| [`P4-B4-OWNER-REFERENCE.md`](./P4-B4-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P4-B4 status row. |
