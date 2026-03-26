# Feature: `P4-B4` — Exception / risk acceptance workflow

**Short overview:** [`P4-B4-OWNER-REFERENCE.md`](./P4-B4-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P4-B4 |
|----------|---------|--------|
| **1** | User-visible UI | **Findings** actions (Accept risk, Revoke), **`/risk-exceptions`** page, sidebar, onboarding link |
| **2** | Backend / shared | `risk_exceptions` table, `GET/POST /api/risk-exceptions`, revoke endpoints, `shared/slaPolicy.ts` treats `accepted-risk` as out of SLA scope |
| **Both** | This feature | **Both** |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md). Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Product-only testing** | **Product owner test guide** below. |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-B4` |
| **Phase** | Phase 4 — Enterprise governance and integrations |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`FindingsTable.tsx`](../../../00_Full_Source_Code/client/src/components/FindingsTable.tsx), [`AcceptRiskDialog.tsx`](../../../00_Full_Source_Code/client/src/components/AcceptRiskDialog.tsx), [`RiskExceptions.tsx`](../../../00_Full_Source_Code/client/src/pages/RiskExceptions.tsx), [`App.tsx`](../../../00_Full_Source_Code/client/src/App.tsx) route `/risk-exceptions`, [`AppSidebar.tsx`](../../../00_Full_Source_Code/client/src/components/AppSidebar.tsx), [`SecurityOnboardingWizard.tsx`](../../../00_Full_Source_Code/client/src/components/SecurityOnboardingWizard.tsx).
- **Category 2 — Backend / shared:** [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) (`risk_exceptions`), [`server/storage.ts`](../../../00_Full_Source_Code/server/storage.ts), [`server/riskExceptionRoutes.ts`](../../../00_Full_Source_Code/server/riskExceptionRoutes.ts), [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts), [`shared/slaPolicy.ts`](../../../00_Full_Source_Code/shared/slaPolicy.ts), [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json).

---

## User-facing summary

Security teams can **accept risk** on a finding with a **written justification** and optional **expiry**. The finding’s status becomes **`accepted-risk`**. It is **not** counted as an open SLA breach while the exception is active. Users can **revoke** from the Findings row or the **Risk exceptions** page. Expired exceptions (when an expiry date is set) are reconciled on list/read and the finding returns to **open**.

---

## Technical summary

| Area | Detail |
|------|--------|
| **Storage** | `risk_exceptions`: `userId`, `findingId`, `justification`, `expiresAt`, `status` (active/revoked), `revokedAt`. |
| **Finding status** | `accepted-risk` on create; `open` on revoke or expiry. |
| **SLA** | `isUnresolvedOpen` excludes `accepted-risk` (and non-open statuses). |
| **Audit** | `risk_exception.create`, `risk_exception.revoke` |

---

## Manual testing steps (product owner — browser / app)

Per [`.cursor/rules/aithon-master-plan-delivery.mdc`](../../../.cursor/rules/aithon-master-plan-delivery.mdc), the product owner validates in the UI without running terminal commands. Use a build that includes P4-B4 and a database where the agent has already applied the `risk_exceptions` table.

1. **Accept risk from Findings** — Go to **Findings**. On an open, non-archived finding that is not already **accepted-risk**, open **More** (⋮) → **Accept risk**. Enter **justification** (required). Optionally set **Optional expiry**. Submit. Confirm **Status** reflects accepted risk and that the **Fix** / AI remediation shortcut for that row is hidden while risk is accepted.

2. **Risk exceptions page** — Open **Risk exceptions** from the sidebar. Confirm the exception appears under **Active** with correct justification (and expiry if set). Use **Revoke**. Confirm the finding shows **open** on **Findings** and the exception appears under **History** here.

3. **Revoke from Findings** — Create another active exception, then on **Findings** use **Revoke acceptance**. Confirm status returns to **open**.

4. **SLA (optional)** — If you use **SLA** targets, confirm an **accepted-risk** finding does not appear as an open SLA breach while the exception is active; after revoke, SLA lists behave as before.

5. **Onboarding link** — If you open the **Security onboarding** wizard, confirm **Governance** includes **Risk exceptions** linking to `/risk-exceptions`.

---

## Automated / agent testing performed

| Command / check | Result |
|-----------------|--------|
| `npm run check` (from `00_Full_Source_Code`) | **pass** |
| `npm run db:push` (from `00_Full_Source_Code`) | **pass** — `risk_exceptions` applied |
| `npm run verify:risk-exceptions-route` | **pass** — minimal Express app returns **401** for unauthenticated `GET /api/risk-exceptions` (proves route handler is registered) |
| Full stack: `NODE_ENV=development` dev server + `curl http://127.0.0.1:<port>/api/risk-exceptions` | **pass** — **401** + `{"message":"Unauthorized"}` (not `API route not found` from Vite catch-all) |

**If the UI shows `API route not found`:** the browser is talking to a Node process that does not include the new routes (stale server, or code not saved/applied). Restart the dev server from current `00_Full_Source_Code`, keep the page port aligned with `PORT`, reload.

---

## User verification (required before next feature)

- [ ] **Category 1:** Accept risk, list page, revoke, sidebar behave as expected  
- [ ] **Category 2:** OpenAPI paths match behavior  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P4-G1**)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove `registerRiskExceptionRoutes`, drop table `risk_exceptions`, revert UI and `slaPolicy` line if needed.  
- Future: multi-step approval, org-level policy, export for auditors.
