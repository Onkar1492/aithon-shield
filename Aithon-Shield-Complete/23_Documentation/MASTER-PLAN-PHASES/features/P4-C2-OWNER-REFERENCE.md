# P4-C2 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P4-C2-VEX-OUTPUT.md`](./P4-C2-VEX-OUTPUT.md).

---

## What is this feature?

**P4-C2** adds **VEX** (Vulnerability Exploitability eXchange) **document output**: a **JSON** file in **CycloneDX 1.5** shape so procurement and security partners can see **how you assess CVEs** that appear in your Aithon findings—not just a list of components (SBOM).

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **API** | `GET /api/vex/document` (whole workspace findings), `GET /api/mvp-scans/:id/vex` (one MVP scan) |
| **Compliance page** | **VEX document (JSON)** button |
| **Audit** | `vex.workspace_export`, `vex.mvp_scan_export` |

---

## Category: 1, 2, or both?

**Both** — download in UI plus server generation and audit.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P4-C2-VEX-OUTPUT.md`](./P4-C2-VEX-OUTPUT.md) | Full feature doc, testing, verification. |
| [`P4-C2-OWNER-REFERENCE.md`](./P4-C2-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P4-C2 status row. |
