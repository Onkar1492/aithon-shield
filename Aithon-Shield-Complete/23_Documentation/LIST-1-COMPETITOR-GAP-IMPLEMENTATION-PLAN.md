# List 1 — Competitor Gap Closure: Prioritized Implementation Plan
# Aithon Shield
**Date:** March 2026  
**Synthesized from:** Three independent model analyses (adversarial competitor research)  
**Model:** Opus 4.6 (synthesis and prioritization)

---

## How this plan was built

Three separate AI models independently analyzed Aithon Shield against 10+ competing platforms (Snyk, Semgrep, Veracode, GitHub Advanced Security, Invicti, Appknox, ArmorCode, Checkmarx, Mend.io, Aqua Security). All three converged on the same core gaps. This document deduplicates, prioritizes by business impact, and organizes them into an implementable phased roadmap.

**Prioritization criteria used:**
1. Revenue unlock (does closing this gap open enterprise sales or remove a deal-breaker?)
2. Trust gap (does the absence of this feature make users question the product's legitimacy?)
3. Build cost relative to impact (effort vs. payoff)
4. Dependency chain (some items must precede others)

---

## Executive summary

Aithon Shield has strong breadth (7 scan types, AI fixes, compliance tracking, SSO) but shallow depth in three areas that every serious buyer will probe:

1. **Remediation is simulated** — the product claims to "fix and upload" but only updates its own database. This is the single largest trust gap.
2. **No developer-workflow integration** — no Git OAuth, no PR checks, no IDE plugin, no CI gates. Developers never encounter Aithon Shield in their actual workflow.
3. **Enterprise governance is absent** — no RBAC, no audit log (the page exists but is not populated from real events), no SLA engine, no exception workflow.

Everything else (SBOM, IaC, container scanning, SIEM, Jira) matters but is secondary to these three.

---

## Tier 1 — Must close (blocks enterprise sales and user trust)

These are items where a buyer doing due diligence will disqualify the product if they are missing.

### 1.1 Real remediation pipeline (replaces simulated fix/upload)

**Gap refs:** A1 (no real PR creation), A2 (no real deploy), A3 (no post-deploy verification), A4 (no patch safety)

**What to build:**
- GitHub App / GitLab App OAuth integration (user connects their repo with least-privilege scopes)
- "Apply fixes" creates a real branch and pull request with AI-generated patches
- Job state machine: `pending` → `patching` → `pr_opened` → `ci_passing` → `merged` → `deployed` → `verified`
- Post-merge verification: trigger a re-scan of the same target to confirm finding is resolved
- Failure states are visible and actionable (merge conflict, CI failure, auth revoked)

**Why Tier 1:** This is the single largest gap. The product's core value proposition is "find and fix." Today the "fix" part is theater. Every competitor (Snyk, Semgrep, GitHub GHAS) creates real PRs. Without this, enterprise security teams will not adopt.

**Estimated scope:** Large (4–6 weeks). Already has a phased plan in `real-world-post-scan-fix-deploy-and-verify-all-scan-types.md`.

**Dependency:** None — this is the foundation.

---

### 1.2 CI/CD merge gate and policy enforcement

**Gap refs:** B2 (no PR check / merge gate), B4 (no CI policy gates)

**What to build:**
- GitHub Check Run integration: when Aithon Shield scans a PR branch, post a pass/fail status check
- Configurable policy: "fail if any Critical," "fail if new High+ findings exceed N," etc.
- CLI tool or GitHub Action that runs `aithon-shield scan` in CI and returns exit code 1 on policy violation
- Artifact output: scan summary as PR comment

**Why Tier 1:** DevOps persona (Persona 3 in PRD) explicitly needs pipeline-integrated scanning. Without merge gates, the product cannot claim "shift left" positioning. Snyk, Semgrep, and GHAS all have this as table stakes.

**Estimated scope:** Medium (2–3 weeks). Depends on 1.1 (Git integration).

**Dependency:** Requires 1.1 (GitHub/GitLab OAuth).

---

### 1.3 Project-level RBAC

**Gap refs:** E3 (no RBAC at project/scan level)

**What to build:**
- Roles: `owner`, `admin`, `developer`, `viewer`, `auditor`
- Scoping: users see only projects/scans they are assigned to
- Permission matrix: who can create scans, apply fixes, approve exceptions, export reports
- Organization/team concept in data model

**Why Tier 1:** Any company with more than one team will ask "can I restrict who sees what?" A single-user-sees-everything model is disqualifying for enterprise. Veracode, Checkmarx, and ArmorCode all have granular RBAC.

**Estimated scope:** Medium-Large (3–4 weeks). Touches auth middleware, storage layer, and all query scoping.

**Dependency:** None — can be built in parallel with 1.1.

---

### 1.4 Immutable audit log

**Gap refs:** E5 (no audit log for security decisions)

**What to build:**
- `audit_events` table: `id`, `userId`, `action`, `resourceType`, `resourceId`, `metadata` (JSON), `timestamp`
- Every security-relevant action logged: scan created, fix applied, finding status changed, exception created, report exported, user role changed
- Append-only (no UPDATE/DELETE on this table)
- Filterable UI on the existing `/audit-log` page (currently a shell)
- Export to CSV/JSON for compliance evidence

**Why Tier 1:** The audit log page already exists in the UI but is not backed by real event capture. Enterprise buyers (SOC 2, ISO 27001) require immutable audit trails. This is a compliance hygiene item — relatively low effort but high signal.

**Estimated scope:** Small-Medium (1–2 weeks). The page exists; needs backend event emission and table.

**Dependency:** None.

---

### 1.5 SBOM generation (CycloneDX / SPDX)

**Gap refs:** C8 (no SBOM output)

**What to build:**
- After SCA scan completes, generate a CycloneDX 1.5 or SPDX 2.3 document listing all dependencies, versions, licenses, and known vulnerabilities
- Downloadable as JSON and XML from scan detail page
- Optionally attach to compliance evidence packages

**Why Tier 1:** US Executive Order 14028 requires SBOM for software sold to the federal government. Many enterprise procurement processes now require it. Semgrep, Mend, and Veracode all export SBOMs. Without this, government and regulated-industry deals are blocked.

**Estimated scope:** Small-Medium (1–2 weeks). SCA already identifies dependencies; this is a serialization format task.

**Dependency:** None.

---

## Tier 2 — Should close (strengthens competitive position, expected by power users)

### 2.1 SCA reachability analysis

**Gap ref:** C2

**What to build:**
- After identifying vulnerable dependencies, perform call-graph or import-chain analysis to determine if the vulnerable code path is actually reachable from the application's entry points
- Tag findings as "Reachable" (confirmed exploitable) vs. "Potentially reachable" vs. "Not reachable"
- Allow filtering findings by reachability status

**Why Tier 2:** Mend, Semgrep Supply Chain, and Veracode VMA all do this. It directly reduces alert fatigue (PRD problem statement: "thousands of raw findings with no prioritization"). Without it, SCA findings are noisier than competitors.

**Estimated scope:** Large (3–5 weeks). Requires static analysis of import chains, which is language-dependent.

---

### 2.2 IaC scanning (Terraform, CloudFormation, Kubernetes, Dockerfile)

**Gap ref:** C5

**What to build:**
- New scan type or module within MVP scan: detect and scan `.tf`, `cloudformation.yml`, `*.yaml` (K8s), `Dockerfile`, `docker-compose.yml`, Helm charts
- Rule engine: misconfigurations, overly permissive IAM, exposed ports, missing encryption, hardcoded secrets in IaC
- Map findings to CIS Benchmarks and cloud provider best practices

**Why Tier 2:** Snyk, Checkov, Semgrep, and GHAS all have IaC scanning. The PRD mentions container/pipeline scans but not IaC explicitly. DevOps persona expects this. Adding it strengthens the "replace 5+ tools" consolidation goal (PRD G1).

**Estimated scope:** Medium-Large (3–4 weeks). Can leverage open-source rule sets (Checkov rules, tfsec).

---

### 2.3 Container image layer scanning (real engine)

**Gap ref:** C6

**What to build:**
- Accept Docker image reference (registry URL + tag) or uploaded tar
- Pull and decompose layers; scan each for vulnerabilities, secrets, malware, misconfigurations
- Compare against known-vulnerable base images
- Integrate with SBOM generation for container-level dependency listing

**Why Tier 2:** The `container_scans` table and schema already exist. The scan type is in the UI. But there is no real engine behind it. Aqua Security and Mend Container are the benchmarks.

**Estimated scope:** Medium-Large (3–4 weeks). Requires container unpacking tooling (e.g., Syft, Grype, or custom).

---

### 2.4 Jira / Linear bi-directional ticket sync

**Gap ref:** F1

**What to build:**
- OAuth integration with Jira Cloud and Linear
- "Create ticket" action on any finding → creates issue in connected tracker with severity, description, remediation steps
- Status sync: when ticket is closed in Jira/Linear, mark finding as resolved in Aithon Shield (and vice versa)
- Bulk ticket creation from findings view

**Why Tier 2:** Security engineers (Persona 2) track remediation in Jira. Without this, they manually copy findings into tickets. Snyk, Veracode, and ArmorCode all have this. It directly reduces friction in the remediation workflow.

**Estimated scope:** Medium (2–3 weeks).

---

### 2.5 SLA enforcement engine

**Gap ref:** E2

**What to build:**
- Configurable SLA policies per severity: Critical = 24 hrs, High = 7 days, Medium = 30 days, Low = 90 days
- SLA clock starts when finding is created
- Status tracking: `within_sla`, `sla_warning` (80% elapsed), `sla_breached`
- Dashboard widget showing SLA compliance rate
- Notifications on SLA warning and breach
- Owner assignment on findings (person responsible for remediation)

**Why Tier 2:** CTO/Engineering Manager persona (Persona 4) cares about SLA tracking. Enterprise AppSec programs are measured by MTTR per severity. Veracode and ArmorCode have this.

**Estimated scope:** Medium (2–3 weeks).

---

### 2.6 Exception / risk acceptance workflow

**Gap ref:** E1

**What to build:**
- "Accept risk" action on any finding with required fields: business justification, approver, expiry date
- Exception states: `pending_approval`, `approved`, `expired`, `revoked`
- Approver receives notification; must explicitly approve
- Expired exceptions automatically re-open the finding
- All exception actions logged in audit trail

**Why Tier 2:** Not every finding gets fixed. Enterprise security programs need a formal process for accepted risks. Veracode, Checkmarx, and ArmorCode all support this. Without it, teams either ignore findings or mark them as resolved (which is a lie).

**Estimated scope:** Medium (2–3 weeks). Depends on 1.4 (audit log) for proper tracking.

---

### 2.7 Structured webhook event schema + SIEM-ready output

**Gap refs:** F2 (no SIEM/SOAR), F3 (weak webhooks)

**What to build:**
- Define a structured JSON event schema for all security events (finding created, fix applied, scan completed, SLA breached, exception created)
- Webhook delivery with retry logic, HMAC signature verification
- Syslog / CEF output format option for SIEM ingestion (Splunk, Elastic)
- Optional: direct Splunk HEC and Elastic integration

**Why Tier 2:** Security Engineer persona (Persona 2) works with SIEM/SOAR. Without event streaming, Aithon Shield is an island. This is expected by any team running a SOC.

**Estimated scope:** Medium (2–3 weeks).

---

### 2.8 API rate limiting and per-key scoping

**Gap ref:** F4

**What to build:**
- Rate limiter middleware (e.g., sliding window per API key)
- Per-key scope restrictions: read-only keys, scan-only keys, admin keys
- Rate limit headers in responses (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Configurable limits per tier (Free, Pro, Enterprise)

**Why Tier 2:** The API key system exists but has no rate limits or scoping. At enterprise scale, this is a security and operational requirement.

**Estimated scope:** Small (1 week).

---

## Tier 3 — Nice to close (differentiators and long-tail)

### 3.1 IDE plugin (VS Code extension)

**Gap ref:** B3

Publish a VS Code extension that surfaces findings inline, links to the web app for full context, and allows "mark as resolved" without leaving the editor. The MCP stdio server is a partial foundation.

**Estimated scope:** Large (4–6 weeks).

---

### 3.2 Proof-based DAST exploit confirmation

**Gap ref:** C1

Implement safe read-only exploit simulation (e.g., reflected XSS with benign payload, SQL injection with `1=1` detection) to confirm true positives with evidence. Invicti's differentiator.

**Estimated scope:** Very Large (6–10 weeks). Requires significant security engineering.

---

### 3.3 Mobile real-device DAST

**Gap ref:** C4

Instrument emulators or real devices to observe runtime behavior, network calls, storage access. Appknox's differentiator.

**Estimated scope:** Very Large (8–12 weeks). Requires device farm infrastructure.

---

### 3.4 Supply-chain tampering / typosquatting detection

**Gap ref:** C7

ML or heuristic detection of dependency confusion, typosquatting, and malicious packages in SCA results.

**Estimated scope:** Large (4–6 weeks).

---

### 3.5 VEX document output

**Gap ref:** E4

Generate Vulnerability Exploitability eXchange documents alongside SBOMs. Growing requirement in enterprise procurement.

**Estimated scope:** Small (1 week). Requires SBOM (1.5) to exist first.

---

### 3.6 ML false-positive suppression

**Gap ref:** D2

Per-repo learning model that identifies likely false positives based on code context, user dismissal patterns, and codebase characteristics.

**Estimated scope:** Very Large (6–10 weeks). Requires data collection and model training.

---

### 3.7 Evidence-linked compliance packages

**Gap ref:** E6

Extend compliance reports to include scan-level evidence chains: for each control, link to the specific scan results, finding counts, remediation timestamps, and approval records that prove compliance.

**Estimated scope:** Medium (2–3 weeks). Depends on 1.4 (audit log) and 2.6 (exceptions).

---

### 3.8 Free open-source tier positioning

**Gap ref:** G2

Marketing and pricing page work: position a free tier specifically for public/open-source repositories with unlimited scans. Primary developer acquisition channel used by Snyk and Semgrep.

**Estimated scope:** Small (1 week). Mostly product marketing and pricing logic.

---

### 3.9 Fix confidence scoring

**Gap ref:** D3

Rate each AI-generated fix suggestion with a confidence percentage and side-effect risk flag. GitHub Copilot Autofix and Snyk both do this.

**Estimated scope:** Small-Medium (1–2 weeks). Requires prompt engineering and UI additions.

---

### 3.10 SAST + DAST correlation for web scans

**Gap ref:** C3

When a web scan has a linked source repo, run SAST on the repo and correlate findings with DAST results to produce unified coverage.

**Estimated scope:** Medium (2–3 weeks). Depends on 1.1 (repo linking).

---

## Recommended implementation sequence

```
Quarter 1 (Weeks 1–12)
├── 1.1 Real remediation pipeline (Git PR)         [Weeks 1–6]
├── 1.4 Immutable audit log                         [Weeks 1–2, parallel]
├── 1.5 SBOM generation                             [Weeks 2–3, parallel]
├── 1.2 CI/CD merge gate                            [Weeks 7–9, after 1.1]
├── 1.3 Project-level RBAC                          [Weeks 3–6, parallel]
└── 2.8 API rate limiting                           [Week 4, parallel]

Quarter 2 (Weeks 13–24)
├── 2.5 SLA enforcement engine                      [Weeks 13–15]
├── 2.6 Exception / risk acceptance workflow         [Weeks 14–16]
├── 2.4 Jira / Linear ticket sync                   [Weeks 15–17]
├── 2.7 Structured webhooks + SIEM output           [Weeks 17–19]
├── 2.1 SCA reachability analysis                   [Weeks 18–22]
├── 3.5 VEX document output                         [Week 19, parallel]
├── 3.8 OSS tier positioning                        [Week 20, parallel]
└── 3.9 Fix confidence scoring                      [Weeks 20–21]

Quarter 3 (Weeks 25–36)
├── 2.2 IaC scanning                                [Weeks 25–28]
├── 2.3 Container image layer scanning              [Weeks 28–31]
├── 3.7 Evidence-linked compliance packages          [Weeks 29–31]
├── 3.10 SAST + DAST correlation                    [Weeks 31–33]
├── 3.1 IDE plugin (VS Code)                        [Weeks 25–30, parallel]
└── 3.4 Supply-chain tampering detection            [Weeks 33–36]

Quarter 4+ (longer horizon)
├── 3.2 Proof-based DAST
├── 3.3 Mobile real-device DAST
└── 3.6 ML false-positive suppression
```

---

## What NOT to build (from the gap analysis)

These items appeared in competitor research but are not recommended for Aithon Shield's current stage:

- **Full pen-testing automation agent** — PRD explicitly lists this as out of scope. Maintain that boundary.
- **Bug bounty management** — PRD explicitly lists as out of scope. Different product category.
- **Custom LLM fine-tuning** — PRD constraint. Keep using OpenAI APIs; fine-tuning is premature until there is enough proprietary training data.
- **Per-seat pricing page** (G1) — This is a business/marketing task, not a product engineering gap. Important, but not in this plan's scope.

---

*This plan closes the gaps that block enterprise adoption first, then systematically builds depth in scanning and governance, then adds differentiating capabilities. Items are ordered by "what makes Aithon Shield trustworthy" before "what makes it feature-rich."*
