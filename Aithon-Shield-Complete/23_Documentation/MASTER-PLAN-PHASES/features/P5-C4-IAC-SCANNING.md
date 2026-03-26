# Feature: `P5-C4` — IaC scanning (MVP module)

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-C4` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **Both** (MVP scan module + findings in existing UI) |
| **Status** | `user verified` |

---

## User-facing summary

**MVP code scans** include an **IaC** security module by default (toggle under Advanced in new/existing app workflows). When enabled, the scanner walks the cloned repo for:

- Terraform (`.tf`, `.tf.json`)
- Dockerfiles
- `docker-compose` / `compose.yaml`
- Kubernetes / Helm–style YAML under common paths (`k8s/`, `helm/`, `charts/`, `infra/`, etc.), CloudFormation-style template names, and `values.yaml`

Findings use category **Infrastructure as Code** with human-readable titles (e.g. `0.0.0.0/0`, `privileged: true`, `USER root`, remote `ADD` in Dockerfile). This is a **heuristic rule set**, not a full Checkov/tfsec engine.

---

## Technical summary

- **Code paths / files:**  
  - [`server/services/iacScanner.ts`](../../../00_Full_Source_Code/server/services/iacScanner.ts) — `performIaCScan`  
  - [`server/services/mvpScanService.ts`](../../../00_Full_Source_Code/server/services/mvpScanService.ts) — module `IaC`, progress bands 66–76%  
  - [`server/executeMvpScanBackground.ts`](../../../00_Full_Source_Code/server/executeMvpScanBackground.ts) — default `securityModules` includes `IaC`  
  - [`client/src/components/NewAppWorkflowDialog.tsx`](../../../00_Full_Source_Code/client/src/components/NewAppWorkflowDialog.tsx) · [`ExistingAppWorkflowDialog.tsx`](../../../00_Full_Source_Code/client/src/components/ExistingAppWorkflowDialog.tsx) — MVP module checkbox  
  - [`shared/attackPathGraphModel.ts`](../../../00_Full_Source_Code/shared/attackPathGraphModel.ts) — IaC findings → **Initial access** phase heuristic  
- **Schema:** No new columns (reuses `findings`).  
- **API / OpenAPI:** [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — MVP create note for `securityModules` + IaC.  

---

## Manual testing steps

1. Create or use an MVP scan with repo containing a `Dockerfile` with `USER root` or a K8s manifest with `privileged: true`.  
2. Ensure **IaC** is checked in Advanced (or rely on defaults).  
3. Run scan; confirm findings appear with category **Infrastructure as Code** and sensible `location` (`path:line`).  
4. Uncheck **IaC** and re-run (new scan) — confirm no IaC findings from this engine.  

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| Attack path model | `npx tsx cli/verifyAttackPathGraphModel.ts` | **pass** |

---

## User verification (required before next feature)

- [x] I followed the manual testing steps above  
- [x] Behavior matches the user-facing summary  
- [x] **Approved to proceed** — next feature: `P5-C5`

**Verified by:** product owner (proceed to P5-C5) — 2026-03-24  
**Comments:**  

---

## Rollback / risks

- False positives on valid use of `0.0.0.0/0` or root containers; tune rules or paths if noisy.  
- YAML discovery is path/name heuristic; files outside conventions may be skipped.
