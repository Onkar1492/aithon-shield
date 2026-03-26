# Feature: `<FEATURE-ID>` — <Short title>

| Field | Value |
|-------|--------|
| **Feature ID** | `<FEATURE-ID>` (e.g. `P1-B2`) |
| **Phase** | Phase `<N>` — <phase name> |
| **Category** | **Category 1** (UI) / **Category 2** (Backend) / **Both** |
| **Status** | `not started` / `in progress` / `implemented` / `user verified` |
| **Implemented in commit / session** | (optional) |

---

## User-facing summary

What the user will notice (Category 1) or what behavior changed invisibly (Category 2).

---

## Technical summary

- **Code paths / files:**  
- **Schema / migrations:**  
- **Environment variables:**  
- **API routes:**  

---

## Category breakdown (if **Both**)

- **Category 1:** …  
- **Category 2:** …  

---

## Manual testing steps

1. …  
2. …  
3. …  

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` (in `00_Full_Source_Code`) | pass / fail / not run |
| DB push | `npm run db:push` | pass / fail / not run |
| Other | … | … |

**Notes:** Record failures honestly and what blocked a full run.

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above  
- [ ] Behavior matches the user-facing summary  
- [ ] **Approved to proceed** — next feature: `<NEXT-FEATURE-ID>`

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / risks

(Optional)
