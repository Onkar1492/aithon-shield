# Feature: Findings deduplication / clusters

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-E5` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **Both** (server API + web UI) |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

When the same vulnerability is detected across multiple scans (e.g. two MVP scans on the same repo, or a container scan run twice), the **Findings** page now has a **Duplicates** tab that groups identical or near-identical findings into **clusters**.

Each cluster shows:
- The **canonical** finding (highest priority score, most recent) that is kept
- The **duplicate** findings that can be dismissed (archived) in one click
- Severity badges, scan types, CWE, category, and date range

Users can **expand** a cluster to see all findings in it, and click **"Dismiss N duplicates"** to archive the extras while keeping the canonical one.

---

## Technical summary

| Piece | Location |
|-------|----------|
| Dedup engine | `server/services/findingsDeduplicationService.ts` |
| API — all clusters | `GET /api/findings/clusters` |
| API — duplicates only | `GET /api/findings/duplicates` |
| API — dismiss | `POST /api/findings/clusters/:fingerprint/dismiss-duplicates` |
| UI | `client/src/pages/Findings.tsx` — "Duplicates" tab |

### Fingerprinting

Each finding is hashed into a 16-character fingerprint from:
- **Normalized CWE** (digits only)
- **Normalized category** (lowercase, alphanumeric)
- **Title stem** (lowercase, scan-type prefixes like "Demo:" stripped)
- **Location stem** (lowercase, line/column numbers stripped)

Findings with the same fingerprint are grouped. The canonical finding is the one with the highest `priorityScore`, breaking ties by most recent `detected` date.

### Dismiss action

`POST /api/findings/clusters/:fingerprint/dismiss-duplicates` archives all non-canonical findings in the cluster. They move to the archived findings list and no longer appear in the main findings table.

---

## Category breakdown

- **Category 1 (Frontend):** `Findings.tsx` — Duplicates tab with cluster list, expandable rows showing canonical and duplicate findings, "Dismiss N duplicates" action button.
- **Category 2 (Backend):** `findingsDeduplicationService.ts` — fingerprint computation (normalized CWE + category + title stem + location stem), cluster grouping, canonical selection (highest priority score); `routes.ts` — cluster listing, duplicate listing, and dismiss endpoints.

---

## Manual testing

1. Open the web app and go to **Findings** in the sidebar.
2. Click the **Duplicates** tab — you should see clusters with 2+ findings.
3. Expand a cluster to see the canonical finding and its duplicates.
4. Click **"Dismiss N duplicates"** on a cluster — duplicates are archived.
5. Switch back to **All Findings** — the archived duplicates are gone from the list.
6. Check **Findings → Archived** to confirm the dismissed duplicates are there.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| DB push | Not required (no schema change) | N/A |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above
- [ ] Behavior matches the user-facing summary
- [ ] **Approved to proceed** — next feature in plan

**Verified by:** _name / date_
**Comments:**

---

## Rollback / limits

- Fingerprinting is heuristic (CWE + category + title + location). Two findings with different CWEs but describing the same issue will not be clustered.
- Dismissing duplicates archives them; they can be restored from the archived findings view.
- No schema migration required — clustering is computed on the fly from existing finding fields.
