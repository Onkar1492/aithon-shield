# Phase index — all 41 features (GitHub + GitLab scope)

Order within a phase is the recommended implementation sequence. **Implement one feature → document → test → user verifies → next.**

---

## Phase 1 — Trust and foundation

| ID | Feature | Typical category |
|----|---------|------------------|
| P1-PREREQ | Database schema for master plan tables (orgs, audit, git, remediation, Shield Advisor, API key scopes) | **2** |
| P1-B2 | Immutable audit log — append-only events, API, Audit Log UI | **Both** |
| P1-B1 | Project-level RBAC — orgs, roles, query scoping | **Both** |
| P1-A1 | Real remediation pipeline — GitHub + GitLab OAuth, PR job lifecycle | **Both** |
| P1-C1 | SBOM generation (CycloneDX / SPDX) for MVP/SCA | **Both** |
| P1-D3 | API rate limiting + per-key scopes | **2** (headers may be **Both**) |

---

## Phase 2 — Shield Advisor and AI confidence

| ID | Feature | Typical category |
|----|---------|------------------|
| P2-E1 | Shield Advisor — multi-model chat, scan context | **Both** |
| P2-E2 | Fix confidence + explainability scores | **Both** |

---

## Phase 3 — Analytics and continuous monitoring

| ID | Feature | Typical category |
|----|---------|------------------|
| P3-F1 | Security health timeline + MTTR + regressions | **Both** |
| P3-F2 | Scheduled scans engine + drift detection | **Both** |
| P3-A2 | CI/CD merge gate — Check Run, CLI, PR comment | **Both** |
| P3-A3 | `.aithonshield.yml` parser + enforcement | **2** + **1** (settings) |
| P3-E3 | CVE watchlist + proactive alerts | **Both** |
| P3-H1 | Security onboarding wizard | **1** |

---

## Phase 4 — Enterprise governance and integrations

| ID | Feature | Typical category |
|----|---------|------------------|
| P4-B3 | SLA enforcement engine | **Both** |
| P4-B4 | Exception / risk acceptance workflow | **Both** |
| P4-G1 | One-click compliance evidence packages | **Both** |
| P4-C2 | VEX document output | **2** |
| P4-D1 | Jira / Linear sync | **Both** |
| P4-D2 | Structured webhooks + SIEM (CEF/syslog) | **2** |
| P4-F3 | Developer security score cards | **Both** |
| P4-E4 | Interactive attack path graph | **1** |

---

## Phase 5 — Scan engine depth and scale

| ID | Feature | Typical category |
|----|---------|------------------|
| P5-C3 | SCA reachability analysis | **2** |
| P5-C4 | IaC scanning | **Both** |
| P5-C5 | Container image layer scanning | **Both** |
| P5-C10 | API security testing module | **Both** |
| P5-C7 | SAST + DAST correlation (web + repo) | **2** |
| P5-D4 | VS Code extension | **1** |
| P5-E5 | Findings deduplication / clusters | **Both** |
| P5-F4 | Multi-env / multi-repo dashboard | **1** |
| P5-H2 | Dependency upgrade path planner | **Both** |
| P5-H3 | Secrets rotation workflow | **Both** |
| P5-G2 | OSS tier positioning (pricing / plans) | **1** |
| P5-H4 | In-app learning center | **1** |

---

## Phase 6 — Longer horizon

| ID | Feature | Typical category |
|----|---------|------------------|
| P6-C6 | Supply-chain tampering / typosquatting | **2** |
| P6-C8 | Proof-based DAST | **2** |
| P6-C9 | Mobile real-device DAST | **2** |
| P6-D5 | ML false-positive suppression | **2** |
| P6-I1 | Mobile runtime monitoring | **Both** |
| P6-I2 | White-label / agencies | **Both** |
| P6-I3 | Air-gap self-hosted packaging | **2** |

---

## Deferred (not in the 41 count for Scenario 1)

Bitbucket + Azure DevOps Git — see `../deferred-bitbucket-azure-devops/README.md`.
