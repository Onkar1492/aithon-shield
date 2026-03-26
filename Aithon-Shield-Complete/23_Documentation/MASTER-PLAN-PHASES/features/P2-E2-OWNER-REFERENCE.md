# P2-E2 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P2-E2-FIX-CONFIDENCE.md`](./P2-E2-FIX-CONFIDENCE.md).

---

## What is this feature?

**P2-E2** adds **fix confidence** information to findings: a **percentage**, a short **plain-language explanation** of why that number was chosen, and a **side-effect risk** level (low, medium, or high). The goal is to help you decide **how much to trust** the suggested remediation path before you apply or merge a fix.

**Important:** These scores are produced by **deterministic rules** in the product (severity, CWE/category, how much remediation text exists, sensitive areas like auth or payments). They are **not** machine-learning predictions.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Server** | Every finding returned by the main finding APIs includes a `fixConfidence` object when responses are enriched. |
| **Findings list** | A **Fix confidence** column shows the score; hover for explanation and side-effect risk. |
| **Remediation dialog** | When you open AI remediation or view details, a **Fix confidence** card summarizes score, risk, and rationale. |
| **Dashboard** | Recent findings pass confidence into the same remediation dialog when you open a fix from there. |

---

## Category: 1, 2, or both?

**Both.**

- **Category 1 (frontend):** New column, remediation card, dashboard wiring.  
- **Category 2 (backend):** Shared `computeFixConfidence` helper and enrichment on API responses.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P2-E2-FIX-CONFIDENCE.md`](./P2-E2-FIX-CONFIDENCE.md) | Full feature doc, categories, testing, verification. |
| [`P2-E2-OWNER-REFERENCE.md`](./P2-E2-OWNER-REFERENCE.md) | This file (overview + UI test steps). |
| [`_STATUS.md`](./_STATUS.md) | P2-E2 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | Findings endpoints mention `fixConfidence`. |

---

## Step-by-step: test the frontend only

1. **Sign in** and open **Findings**.  
2. Confirm a **Fix confidence** column with percentages.  
3. **Hover** a score — tooltip should show **side-effect risk** and a short **explanation**.  
4. Open **Fix → AI Remediation** on an open finding — confirm the **Fix confidence** card at the top of the dialog.  
5. Go to **Dashboard**, use **Recent Findings** → remediation — confirm the same card appears when the list loads from the API.
