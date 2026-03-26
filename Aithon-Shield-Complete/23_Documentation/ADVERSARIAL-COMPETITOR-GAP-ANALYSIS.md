# Adversarial Competitor Gap Analysis
# Aithon Shield vs. Leading AppSec Platforms
**Date:** March 2026  
**Scope:** All features Aithon Shield is currently missing or where competing platforms have measurably stronger capability

---

## Competitor Reference Set

| Platform | Category |
|----------|----------|
| Snyk | SAST + SCA + Secrets + PR automation |
| Semgrep | SAST + SCA + Secrets + CI triage |
| Veracode | Enterprise SAST + DAST + SCA + Policy |
| Mend.io (WhiteSource) | SCA + Container + Reachability |
| GitHub Advanced Security | Native SCM scanning + Copilot fixes |
| Invicti | Enterprise DAST + Proof-based verification |
| Appknox | Mobile security (SAST + DAST + real device) |
| ArmorCode | ASPM (Application Security Posture Management) |
| Checkmarx | SAST + DAST + SCA + IaC enterprise |
| Aqua Security | Container + Kubernetes + Runtime |

---

## Gap List

### A. Remediation & Fix Execution

**A1. No real PR / branch creation to source repos**  
Snyk, GitHub Advanced Security, Semgrep, and Veracode all create automated fix pull requests into the actual customer repo. Aithon Shield's "Apply fixes" only marks findings as resolved in its own database (`applyFixesForScan` → `markFindingsAsFixed`). No code is changed in any customer repository.

**A2. No real upload / deployment pipeline**  
Competitors trigger real CI/CD pipelines (GitHub Actions dispatch, Vercel deploy hooks, Netlify triggers). Aithon Shield's upload is simulated `setTimeout` stages that update `uploadStatus` in Postgres — no external system is contacted.

**A3. No post-deploy re-scan or verification loop**  
Invicti and Semgrep support rescan after fix application to confirm vulnerability is actually resolved in the live environment. Aithon Shield has no such verification loop.

**A4. No merge conflict handling or patch safety checks**  
When Snyk creates a fix PR, it validates it compiles and passes basic tests before opening. Aithon Shield has no sandbox or test execution prior to flagging a fix as applied.

---

### B. SCM & CI/CD Integration

**B1. No OAuth App or GitHub App / GitLab integration**  
There is no OAuth connection to any Git provider. `repositoryUrl` is stored as a plain string. Competitors tie into SCM webhooks for real-time PR checks and merge status.

**B2. No PR check / merge gate capability**  
Snyk, GitHub GHAS, and Semgrep can block a PR merge at the platform level if new critical vulnerabilities are introduced. Aithon Shield has no hook into this workflow.

**B3. No native IDE plugin**  
Snyk, Semgrep, Checkmarx, and GitHub GHAS ship IDE extensions (VS Code, IntelliJ, etc.) to surface findings inline during development. Aithon Shield is web-only; findings are only visible after uploading or logging into the app. The MCP stdio server is an early step toward this but is not yet IDE-native.

**B4. No CI/CD pipeline enforcement (policy gates)**  
Competitors can be configured to fail a build if scan results exceed a severity threshold. Aithon Shield has pipeline scanning but no gate enforcement outputs (exit codes, artifact signing, etc.).

---

### C. Scan Engine Depth

**C1. Web scan has no proof-based exploit confirmation**  
Invicti's proof-based scanning executes safe read-only exploit simulations to confirm a vulnerability exists before reporting it, achieving confirmed true positives for over 94% of direct-impact flaws. Aithon Shield's DAST is pattern-matching and header-based with no exploit proof.

**C2. No reachability analysis for SCA**  
Mend, Semgrep Supply Chain, and Veracode VMA determine whether vulnerable dependency code paths are actually reachable from your application's entry points. Aithon Shield reports all SCA findings without reachability filtering, which generates more noise.

**C3. SAST is not available for web scan type (URL only)**  
The `webScanService.ts` explicitly notes SAST and SCA are unavailable for the web scan engine. Competitors combine SAST + DAST correlation across the same project.

**C4. Mobile has no real-device DAST**  
Appknox performs dynamic analysis on physical devices and emulators to catch runtime behavior issues. Aithon Shield's mobile scan is binary and manifest analysis only (static).

**C5. No IaC (Infrastructure as Code) scanning**  
Snyk, Checkov, Semgrep, and GitHub GHAS support Terraform, CloudFormation, Kubernetes YAML, Helm, and Dockerfile scanning. Aithon Shield does not have an IaC engine.

**C6. No container image layer scanning**  
Aqua Security and Mend Container scan individual container image layers for vulnerabilities, malware, secrets, and misconfigurations at rest before deployment. Aithon Shield has container scan as a type in schema but no engine for it.

**C7. No malicious package / supply-chain tampering detection**  
Mend and Veracode use machine learning and threat intel to detect dependency confusion attacks and typosquatting packages. Aithon Shield SCA does not include this.

**C8. No SBOM (Software Bill of Materials) generation**  
Semgrep, Mend, and Veracode export CycloneDX or SPDX SBOMs. This is now a compliance requirement in many regulated environments (US EO 14028). Aithon Shield has no SBOM output.

---

### D. Triage and Prioritization

**D1. No exploitability / threat intel enrichment on individual findings**  
Competitors correlate findings against EPSS scores, CISA KEV, CVE exploit databases, and dark-web telemetry to rank findings by active exploitation likelihood. Aithon Shield has a priority score and threat feed, but it is not finding-level enrichment from live exploit intelligence.

**D2. No false-positive suppression / ML noise reduction**  
Semgrep reports 80% fewer false positives vs. standalone tools by learning your codebase context. Aithon Shield does not have a learning/feedback loop that improves accuracy over time on a per-repo basis.

**D3. No "fix confidence" scoring**  
GitHub Copilot Autofix and Snyk rate auto-generated fixes with a confidence level. Aithon Shield presents AI-generated fix suggestions without a confidence or safety signal.

---

### E. Governance, Compliance, and Enterprise Controls

**E1. No formal exception / risk acceptance workflow**  
Veracode, Checkmarx, and ArmorCode support structured exception requests with business justification, approver assignment, expiry dates, and audit trails. Aithon Shield has no exception management system.

**E2. No SLA enforcement engine**  
Enterprise AppSec platforms set remediation SLAs by severity (Critical: 24 hrs, High: 7 days, etc.) and track SLA breach/breach-pending status. Aithon Shield tracks findings but has no SLA clock, owner assignment, or breach alerting.

**E3. No RBAC at the project/scan level**  
Aithon Shield has one tier of authenticated user. Competitors support role-based access where certain users can only view results for specific projects or cannot initiate fixes.

**E4. No VEX (Vulnerability Exploitability eXchange) document output**  
VEX is a companion to SBOM that communicates the exploitability status of known vulnerabilities in a product. Large enterprise procurement now commonly requests this.

**E5. No audit log for security decisions**  
Competitors maintain immutable audit trails showing who marked a finding as fixed, who approved an exception, and when a scan was run. Aithon Shield has no audit log table or export.

**E6. Compliance reporting is limited in depth**  
Aithon Shield tracks posture against OWASP, NIST, SOC 2, ISO 27001, HIPAA, GDPR, but actual compliance report generation is not tied to scan findings with evidence chains. Enterprise platforms produce evidence-linked compliance packages.

---

### F. Integrations

**F1. No Jira / Linear bi-directional ticket sync**  
Snyk, Veracode, and ArmorCode bi-directionally sync findings to issue trackers and close tickets when vulnerabilities are resolved. Aithon Shield has no ticketing integration.

**F2. No SIEM / SOAR integration**  
Security teams use Splunk, Elastic SIEM, or SOAR platforms (Palo Alto XSOAR, Splunk SOAR) to correlate security findings from all tools. Aithon Shield has no SIEM-ready event stream or integration.

**F3. Webhook alert system is limited**  
Aithon Shield has Slack/Teams webhooks noted in documentation but no structured webhook event schema that integrations can reliably parse.

**F4. No API rate-limit or tenant isolation**  
Public-facing API keys currently lack rate limits or per-key scope restrictions, which matters at enterprise scale.

---

### G. Pricing and Business Model

**G1. No per-seat or per-project pricing model visible to market**  
Competitors have clear, self-serve pricing pages with per-committer and per-project tiers. Aithon Shield has per-issue pricing for older issues but no clear plan-comparison marketing presentation.

**G2. No free open-source tier**  
Snyk, Semgrep, and GitHub GHAS offer free tiers for public/open-source repos. This is a primary developer acquisition channel. Aithon Shield has a free tier but it is not positioned as an open-source tool tier.
