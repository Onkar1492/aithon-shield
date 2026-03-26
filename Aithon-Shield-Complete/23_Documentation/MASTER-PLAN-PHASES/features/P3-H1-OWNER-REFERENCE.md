# P3-H1 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P3-H1-SECURITY-ONBOARDING-WIZARD.md`](./P3-H1-SECURITY-ONBOARDING-WIZARD.md).

---

## What is this feature?

**P3-H1** adds a **security onboarding wizard** — a 6-step guided tour that appears the first time a user logs in.

1. **Welcome** — introduces the platform  
2. **Scans** — links to MVP, Mobile, Web, Linter scans  
3. **Findings** — remediation, Shield Advisor, archive  
4. **Monitoring** — Security Health, Scheduled Scans, CVE Watchlist  
5. **Governance** — .aithonshield.yml, Merge Gate, Audit Log, Compliance  
6. **Ready** — closes wizard, lands on dashboard  

Each step has **clickable cards** that jump directly to the feature. Users can **Skip tour** at any point. Once completed, the wizard never appears again.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Wizard** | 6-step blocking dialog with progress bar, feature cards, Skip/Next/Back |
| **Persistence** | `users.onboarding_completed_at` column — `null` = show wizard, timestamp = done |
| **API** | `POST /api/onboarding/complete` |
| **Sequencing** | Appears after Terms of Service acceptance |

---

## Category: 1, 2, or both?

**Both** — primarily **Category 1** (visible wizard), with a small schema + API addition (Category 2).

---

## Documentation list

| Document | Role |
|----------|------|
| [`P3-H1-SECURITY-ONBOARDING-WIZARD.md`](./P3-H1-SECURITY-ONBOARDING-WIZARD.md) | Full feature doc, testing, verification. |
| [`P3-H1-OWNER-REFERENCE.md`](./P3-H1-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P3-H1 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | `POST /api/onboarding/complete`. |

---

## Step-by-step: test the UI only

1. **Log in** (existing or new user). Wizard appears as a blocking dialog.  
2. Walk through all 6 steps with **Next**. Click a feature card to jump to that page.  
3. Log out and back in — wizard should **not** reappear.  
4. For a new user: accept ToS first, then wizard appears.
