# P3-E3 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P3-E3-CVE-WATCHLIST.md`](./P3-E3-CVE-WATCHLIST.md).

---

## What is this feature?

**P3-E3** adds a **CVE watchlist** so you can name CVE IDs you care about and get **alerts** when findings mention them.

1. **Watchlist UI** — Add/remove CVEs, optional notes, per-entry on/off.  
2. **Matching** — When findings are saved (or when you click **Scan existing findings**), the app looks for those CVE strings in finding titles/descriptions.  
3. **Notifications** — In-app bell alerts, plus optional **browser push** (controlled in **Settings**).  
4. **No NVD poller** in this version — alerts are not driven by a background feed from NVD; they are driven by your finding text.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Navigation** | **CVE Watchlist** under Core (sidebar). |
| **Screen** | Add CVE, table with enable/disable, **Scan existing findings**. |
| **Settings** | Toggle **CVE watchlist (push)** under notification preferences. |
| **API** | `GET/POST/PATCH/DELETE /api/cve-watchlist`, `POST /api/cve-watchlist/rescan-findings`. |

---

## Category: 1, 2, or both?

**Both** — visible page plus APIs, DB tables, and notification plumbing.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P3-E3-CVE-WATCHLIST.md`](./P3-E3-CVE-WATCHLIST.md) | Full feature doc, testing, verification. |
| [`P3-E3-OWNER-REFERENCE.md`](./P3-E3-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P3-E3 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | CVE watchlist paths. |

---

## Step-by-step: test the UI only

1. **Database:** After deploy, ensure schema is applied (team `db:push` or migration).  
2. Sign in → **CVE Watchlist** → add a CVE you know appears in a finding (copy from **Findings** if needed).  
3. Click **Scan existing findings** and check the **bell** for a watchlist notification; click it to go to Findings.  
4. Adjust **Settings → CVE watchlist (push)** and per-row switches as needed.
