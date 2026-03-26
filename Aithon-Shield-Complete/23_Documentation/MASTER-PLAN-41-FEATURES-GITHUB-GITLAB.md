# Master implementation plan — 41 features (Scenario 1)

**Scope:** Full product roadmap with **GitHub + GitLab only** for Git integration and remediation (Phase 1–3).  
**Deferred:** Bitbucket and Azure DevOps — see [`deferred-bitbucket-azure-devops/`](./deferred-bitbucket-azure-devops/README.md).

**Source code root:** [`00_Full_Source_Code/`](../00_Full_Source_Code/)

---

## Feature inventory (41 unique items)

### Group A — Remediation & developer workflow
| ID | Feature |
|----|---------|
| A1 | Real remediation pipeline (GitHub + GitLab OAuth, branch/PR, job state machine, re-scan verify) |
| A2 | CI/CD merge gate + policy (Check Run, CLI, PR comment) |
| A3 | `.aithonshield.yml` security-as-code |

### Group B — Enterprise governance
| ID | Feature |
|----|---------|
| B1 | Project-level RBAC (orgs, roles) |
| B2 | Immutable audit log |
| B3 | SLA enforcement engine |
| B4 | Exception / risk acceptance workflow |

### Group C — Scan engine depth
| ID | Feature |
|----|---------|
| C1 | SBOM (CycloneDX / SPDX) |
| C2 | VEX output |
| C3 | SCA reachability |
| C4 | IaC scanning |
| C5 | Container layer scanning (real engine) |
| C6 | Supply-chain tampering / typosquatting |
| C7 | SAST + DAST correlation (web + linked repo) |
| C8 | Proof-based DAST |
| C9 | Mobile real-device DAST |
| C10 | API security testing module |

### Group D — Integrations
| ID | Feature |
|----|---------|
| D1 | Jira / Linear sync |
| D2 | Structured webhooks + SIEM (CEF/syslog) |
| D3 | API rate limits + per-key scopes |
| D4 | VS Code extension |
| D5 | ML false-positive suppression |

### Group E — AI / Shield Advisor
| ID | Feature |
|----|---------|
| E1 | **Shield Advisor** — conversational assistant, multi-model |
| E2 | Fix confidence + explainability |
| E3 | CVE watchlist + proactive alerts |
| E4 | Interactive attack path graph |
| E5 | Findings deduplication / clusters |

### Group F — Dashboards & analytics
| ID | Feature |
|----|---------|
| F1 | Security health timeline + MTTR |
| F2 | Scheduled scans + drift detection |
| F3 | Developer score cards |
| F4 | Multi-env / multi-repo dashboard |

### Group G — Compliance & GTM
| ID | Feature |
|----|---------|
| G1 | One-click compliance evidence packages |
| G2 | OSS tier positioning |

### Group H — Developer experience
| ID | Feature |
|----|---------|
| H1 | Onboarding wizard |
| H2 | Dependency upgrade path planner |
| H3 | Secrets rotation workflow |
| H4 | Learning center |

### Group I — Market expansion
| ID | Feature |
|----|---------|
| I1 | Mobile runtime monitoring |
| I2 | White-label / agencies |
| I3 | Air-gap self-hosted |

---

## Shield Advisor — supported models (6)

1. OpenAI  
2. Anthropic Claude  
3. Google Gemini  
4. Mistral AI  
5. Meta Llama 4 (OpenAI-compatible / Ollama / vLLM base URL)  
6. AWS Bedrock (multi-model gateway)

Provider selection is per-user (Settings); server uses configured env API keys unless user-supplied encrypted keys are added later.

---

## Phased delivery (reference)

| Phase | Focus |
|-------|--------|
| 1 | Audit log, RBAC foundations, remediation + Git (GitHub/GitLab), SBOM, API rate limits |
| 2 | Shield Advisor + fix confidence |
| 3 | Timeline, scheduled scans, CI gates, `.aithonshield.yml`, CVE watchlist, onboarding |
| 4 | SLA, exceptions, compliance export, VEX, Jira/Linear, webhooks, score cards, attack graph |
| 5 | Reachability, IaC, container engine, API scan, IDE ext, dedup, multi-env, upgrades, secrets rotation, OSS tier, learning |
| 6 | Supply-chain heuristics, proof DAST, mobile DAST, ML FP, runtime mobile, white-label, air-gap |

---

## Implementation status

Phased delivery, per-feature docs, Category 1/2 labels, testing logs, and **user verification gates** live in:

**[`23_Documentation/MASTER-PLAN-PHASES/`](./MASTER-PLAN-PHASES/README.md)**

Cursor rule: **[`.cursor/rules/aithon-master-plan-delivery.mdc`](../.cursor/rules/aithon-master-plan-delivery.mdc)**

This document is updated as work lands in `00_Full_Source_Code`. **P1-PREREQ** (schema + storage): see [`features/P1-PREREQ-SCHEMA.md`](./MASTER-PLAN-PHASES/features/P1-PREREQ-SCHEMA.md).
