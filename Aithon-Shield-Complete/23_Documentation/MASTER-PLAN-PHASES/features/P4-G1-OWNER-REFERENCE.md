# P4-G1 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P4-G1-EVIDENCE-PACKAGES.md`](./P4-G1-EVIDENCE-PACKAGES.md).

---

## What is this feature?

**P4-G1** adds **one-click compliance evidence**: a **ZIP download** from the **Compliance** page with real data from your workspace (findings, audit trail, SLA evaluation, risk exceptions), not only the static framework cards.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Compliance** | **Evidence package (ZIP)** next to **Export All** |
| **API** | `GET /api/compliance/evidence-package` |
| **Audit** | `compliance.evidence_package_download` |
| **Onboarding** | Governance step links to **Compliance** for this flow |

---

## Category: 1, 2, or both?

**Both** — UI button plus server ZIP generation and audit.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P4-G1-EVIDENCE-PACKAGES.md`](./P4-G1-EVIDENCE-PACKAGES.md) | Full feature doc, testing, verification. |
| [`P4-G1-OWNER-REFERENCE.md`](./P4-G1-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P4-G1 status row. |
