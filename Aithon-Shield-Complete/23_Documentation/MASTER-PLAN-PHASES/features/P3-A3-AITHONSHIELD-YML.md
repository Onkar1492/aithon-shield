# Feature: `P3-A3` — `.aithonshield.yml` parser + enforcement

**Short overview:** [`P3-A3-OWNER-REFERENCE.md`](./P3-A3-OWNER-REFERENCE.md)

## Categories (required every feature)

| Category | Meaning | P3-A3 |
|----------|---------|--------|
| **1** | User-visible UI / navigation | **Settings** — Security as code editor, validate, test **fail_on** gate |
| **2** | Backend, shared logic, APIs | Shared parser + `evaluatePolicyFailOn`, `POST /api/policy/aithonshield/validate` & `/evaluate`, audit events |
| **Both** | This feature | **Both** |

---

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md) **Categories**. Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Product-only testing** | **Product owner test guide** below (browser only). |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P3-A3` |
| **Phase** | Phase 3 — Analytics and continuous monitoring |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx) — **Security as code** card: YAML textarea (default example), **Validate YAML**, **Reset to example**, **Test policy gate** with severity counts and **Evaluate gate**.
- **Category 2 — Backend / shared:** [`shared/aithonShieldConfig.ts`](../../../00_Full_Source_Code/shared/aithonShieldConfig.ts) — YAML parse (`yaml` package), Zod schema, `evaluatePolicyFailOn`, `AITHON_SHIELD_YML_EXAMPLE`. [`aithonShieldPolicyRoutes.ts`](../../../00_Full_Source_Code/server/aithonShieldPolicyRoutes.ts) — validate + evaluate routes. [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) registration. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json).

---

## User-facing summary

Teams can define **security-as-code** in a repo-root **`.aithonshield.yml`**: scan hints, **`policy.fail_on`** ceilings per severity, suppressions, and compliance tags. In the app, **Settings** lets you **validate** the YAML and **simulate** whether a set of finding counts would pass or fail those ceilings—before or without wiring a live repo scanner.

---

## Technical summary

| Area | Detail |
|------|--------|
| **fail_on semantics** | For each configured severity, **actual count &gt; configured max** ⇒ violation (e.g. `critical: 0` allows zero critical findings). |
| **Dependency** | npm package `yaml` (^2.x). |
| **Audit** | `policy.aithonshield_validated`, `policy.aithonshield_evaluated`. |

---

## Product owner test guide (browser only — no Terminal)

**Prerequisites:** Signed in; open **Settings** (any non-demo or demo URL you use for the app).

### Step-by-step

1. Scroll to **Security as code (`.aithonshield.yml`)**. Confirm the example YAML loads in the editor.

2. Click **Validate YAML**. Confirm a success toast and a **Parsed configuration** panel with JSON.

3. Under **Test policy gate**, leave counts at **0 critical / 6 high** (defaults). Click **Evaluate gate**. Confirm the UI shows **fail** (example allows max **5** high).

4. Set **High** to **3** and **Evaluate gate** again. Confirm **pass**.

5. Click **Reset to example**, introduce a YAML syntax error (e.g. remove a colon), **Validate YAML**. Confirm an error toast or message explaining the problem.

6. Fix YAML and validate again to confirm recovery.

**Demo mode:** These API routes are **not** blocked by demo mode (unlike Git merge gate).

---

## Automated / agent testing (not run by the product owner)

| Check | Who runs it | Result |
|-------|-------------|--------|
| Typecheck `npm run check` | Agent / CI in `00_Full_Source_Code` | **pass** (last agent run) |

---

## User verification (required before next feature)

- [ ] **Category 1:** Settings card validates and evaluates as above  
- [ ] **Category 2:** APIs match OpenAPI descriptions if you use API keys in automation  
- [ ] **Approved to proceed** — next feature per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md) (**P3-E3**)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Remove `registerAithonShieldPolicyRoutes` and delete `aithonShieldPolicyRoutes.ts` / `shared/aithonShieldConfig.ts` if reverting.  
- Future: read `.aithonshield.yml` from cloned repos in MVP/CI and apply to real scan summaries automatically.
