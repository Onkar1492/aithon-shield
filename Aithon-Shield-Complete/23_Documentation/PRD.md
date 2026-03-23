# Product Requirements Document (PRD)
# Aithon Shield — Enterprise Cybersecurity Testing & Remediation Platform

**Version:** 1.0  
**Date:** March 2026  
**Status:** Production  
**Document Owner:** Aithon Shield Product Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Target Users & Personas](#3-target-users--personas)
4. [Market Context](#4-market-context)
5. [Feature Requirements](#5-feature-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [User Interface Requirements](#7-user-interface-requirements)
8. [Integration Requirements](#8-integration-requirements)
9. [Security & Compliance Requirements](#9-security--compliance-requirements)
10. [Data Model Overview](#10-data-model-overview)
11. [Pricing Model](#11-pricing-model)
12. [Success Metrics (KPIs)](#12-success-metrics-kpis)
13. [Constraints & Assumptions](#13-constraints--assumptions)
14. [Out of Scope](#14-out-of-scope)

---

## 1. Executive Summary

Aithon Shield is a comprehensive, AI-enhanced enterprise cybersecurity testing and remediation platform. It scans source code, mobile applications, web applications, CI/CD pipelines, container images, and network infrastructure for security vulnerabilities. Upon discovery, it provides AI-powered remediation suggestions, automated code fixes, and compliance tracking against major security standards (OWASP, NIST, SOC 2, ISO 27001, HIPAA, GDPR).

The platform is designed for individual developers through to large enterprise engineering teams and eliminates the fragmentation of using separate tools for SAST, DAST, SCA, secrets detection, and compliance monitoring by providing a single unified security platform.

---

## 2. Product Vision & Goals

### Vision Statement
"Make enterprise-grade security testing accessible, automated, and actionable for every development team — from solo founders to Fortune 500 engineering organizations."

### Strategic Goals
| Goal | Description |
|------|-------------|
| G1 — Consolidation | Replace 5+ separate security tools with one integrated platform |
| G2 — Automation | Reduce manual remediation effort by 80% through AI-powered fixes |
| G3 — Compliance | Enable one-click compliance reporting against OWASP, NIST, SOC 2, ISO 27001, HIPAA, GDPR |
| G4 — Speed | Complete a full-stack security scan in under 5 minutes for average-sized applications |
| G5 — Accessibility | Provide ADA/WCAG 2.1 AA compliant UI with mobile-responsive design |

---

## 3. Target Users & Personas

### Persona 1: Solo Developer / Indie Hacker
- Builds MVPs and launches apps quickly
- Needs fast, automated scanning before launch
- Has limited security expertise
- Values: speed, simplicity, automated fixes

### Persona 2: Security Engineer (Enterprise)
- Responsible for security posture across multiple products
- Needs detailed compliance reports and audit trails
- Works with SIEM/SOAR tools, Slack, Teams
- Values: depth, integrations, enterprise SSO, detailed findings

### Persona 3: DevOps / Platform Engineer
- Manages CI/CD pipelines and container infrastructure
- Needs pipeline-integrated scanning and container hardening
- Values: automation, API access, scheduled scans

### Persona 4: CTO / Engineering Manager
- Needs executive-level risk visibility
- Cares about security health score and compliance status
- Values: dashboards, reports, SLA tracking

---

## 4. Market Context

### Problem Statement
Modern development teams face:
- **Fragmentation**: 5-8 separate security tools (Snyk, SonarQube, Burp Suite, etc.) that don't share data
- **Alert fatigue**: Thousands of raw findings with no prioritization or context
- **Remediation gap**: Tools find problems but don't fix them
- **Compliance complexity**: Manual effort to map findings to OWASP, NIST, SOC 2, etc.
- **Late detection**: Security issues found after deployment when they are most costly

### Competitive Landscape
| Competitor | Gap Addressed by Aithon Shield |
|------------|-------------------------------|
| Snyk | No DAST, no web app scanning, no compliance module |
| SonarQube | No mobile scanning, no AI fixes, no attack simulation |
| Burp Suite | No SAST, no code fixes, no CI/CD integration |
| Veracode | High cost, complex setup, no real-time fixes |

---

## 5. Feature Requirements

### 5.1 Authentication & User Management

**FR-AUTH-001: Email/Password Registration**
- Users register with first name, last name, email, username, password
- Passwords hashed with bcryptjs
- Email uniqueness enforced

**FR-AUTH-002: Session-Based Authentication**
- Server-side sessions stored in PostgreSQL
- Automatic session cleanup
- Protected routes require authenticated session

**FR-AUTH-003: Enterprise SSO (SAML 2.0 + OIDC)**
- Support for multiple Identity Providers simultaneously
- SAML 2.0 SP-initiated login with metadata exchange
- OpenID Connect / OAuth 2.0 support
- Test OIDC provider included for development

**FR-AUTH-004: Terms of Service Acceptance**
- Users must accept ToS before accessing the platform
- Version-tracked acceptance records

---

### 5.2 Dashboard

**FR-DASH-001: Security Health Score**
- Aggregate score (0–100) calculated from finding severity distribution
- Color-coded status (Critical / High / Moderate / Good)

**FR-DASH-002: Real-Time Metrics**
- Total active findings count
- Critical findings count
- Scans run this month
- Average risk score

**FR-DASH-003: Attack Surface Visualization**
- Bar or area chart showing vulnerability exposure by category

**FR-DASH-004: Industry Benchmarking**
- Compare security posture against industry average

**FR-DASH-005: Live Threat Intelligence Feed**
- Pulls from NIST NVD and CISA KEV public APIs
- Displays recent CVEs and known exploited vulnerabilities

**FR-DASH-006: Compliance Summary Widgets**
- Quick-view cards for OWASP Top 10, NIST, SOC 2, ISO 27001, HIPAA, GDPR

---

### 5.3 MVP Code Scan (SAST)

**FR-MVP-001: Scan Creation**
- Fields: name, project URL, target URL, framework, language, environment
- Supports GitHub, GitLab, Bitbucket repositories

**FR-MVP-002: Comprehensive Scanning Modules**
- Static Application Security Testing (SAST)
- Software Composition Analysis (SCA) — dependency vulnerabilities
- Secrets Detection — API keys, passwords, tokens in code
- All three modules run simultaneously

**FR-MVP-003: Scan Progress Tracking**
- Real-time progress bar with module-level status
- Cancel in-progress scan

**FR-MVP-004: Findings Generation**
- AI-generated vulnerability descriptions
- Severity levels: Critical, High, Medium, Low
- CWE mapping, risk scoring, exploitability scoring
- Remediation suggestions per finding

**FR-MVP-005: CRUD Operations**
- Create, read, update (inline editing), delete scans
- Delete cascades to associated findings
- List sorted by creation date (newest first)

**FR-MVP-006: Scan Details Page**
- Per-scan findings list
- Fix validation workflow per finding
- Upload to store / re-upload with fixes

**FR-MVP-007: QR Code Preview**
- Generate QR code for mobile app preview link

---

### 5.4 Mobile App Scan

**FR-MOB-001: Scan Creation**
- Fields: app name, package name, platform (iOS/Android), version, store URL, download URL

**FR-MOB-002: Scanning Modules**
- Binary analysis (static inspection of compiled app)
- API security testing (network calls from app)
- Hardcoded secrets detection

**FR-MOB-003: Platform-Specific Analysis**
- iOS: Swift/Objective-C patterns, Info.plist checks
- Android: AndroidManifest.xml, Java/Kotlin patterns

**FR-MOB-004: All MVP features (FR-MVP-003 through FR-MVP-007) apply**

---

### 5.5 Web App Scan (DAST)

**FR-WEB-001: Scan Creation**
- Fields: name, target URL, authentication type, username/password for authenticated scanning

**FR-WEB-002: DAST Modules**
- OWASP Top 10 scanning (injection, broken auth, XSS, etc.)
- SSL/TLS configuration analysis
- Security headers check
- Directory traversal testing
- API endpoint enumeration

**FR-WEB-003: All MVP features (FR-MVP-003 through FR-MVP-006) apply**

---

### 5.6 CI/CD Pipeline Scan

**FR-PIPE-001: Pipeline Configuration Scanning**
- Scans GitHub Actions, GitLab CI, Jenkins, CircleCI configuration files
- Detects insecure pipeline patterns

**FR-PIPE-002: Auto-Fix Batches**
- AI-generated fixes for pipeline misconfigurations
- Stripe-based payment for fixes on older issues

---

### 5.7 Container Scan

**FR-CONT-001: Container Image Scanning**
- Scans Docker images and Dockerfile configurations
- Base image vulnerability analysis
- Layer-by-layer inspection

**FR-CONT-002: Auto-Fix Batches**
- Recommendations for base image upgrades, package updates

---

### 5.8 Network Scan

**FR-NET-001: Network Infrastructure Scanning**
- Open port detection
- Service version fingerprinting
- CVE matching for detected services

**FR-NET-002: Auto-Fix Batches**
- Remediation recommendations for exposed services

---

### 5.9 Code Linter Scan

**FR-LINT-001: Three Scan Modes**
- **Folder Scan**: Upload a ZIP containing multiple source files
- **Code Snippet**: Paste code directly with language auto-detection
- **Specific Files**: Upload individual files by name

**FR-LINT-002: Multi-Language Support**
- Python, JavaScript, TypeScript, Java, Go, Ruby, PHP, C/C++, C#, Swift, Kotlin, Rust
- Auto-detection from code signatures

**FR-LINT-003: Security Check Categories**
- SQL Injection, XSS, Command Injection
- Hardcoded credentials and secrets
- CSRF vulnerabilities
- Insecure randomness
- Missing authentication
- Dangerous function usage (eval, exec, system)
- Sensitive data exposure
- Authentication bypass patterns
- Path traversal vulnerabilities
- Python-specific syntax errors

**FR-LINT-004: Python Syntax Error Detection**
- Missing colons on control structures and class/function definitions
- Unclosed parentheses in function definitions
- Unclosed list comprehensions
- Unmatched dictionary braces
- Adjacent string + variable without operator
- All occurrences reported (not just first)

**FR-LINT-005: AI-Powered Fix Workflow**
- Expandable findings with BEFORE/AFTER code blocks (color-coded red/green)
- Copy Fix button per finding
- Per-issue "Auto-Fix This Issue" button
- Post-fix output view with complete corrected code
- Copy All and Download options

**FR-LINT-006: Fix Batches with Pricing**
- Issues within 30 days: FREE
- Issues older than 30 days: $2.00 each
- Stripe payment integration for paid fixes

---

### 5.10 Findings Management

**FR-FIND-001: Findings Table**
- Columns: Priority (P1–P5), Title, Scan/Project, Severity, Risk Score, Asset, CWE, Detected date, Status
- Priority derived from severity: Critical=P1, High=P2, Medium=P3, Low=P4, Info=P5
- Color-coded priority badges (P1=red, P2=orange, P3=yellow, P4=blue, P5=gray)
- "Fix This First" indicator for highest-risk findings

**FR-FIND-002: Filtering & Search**
- Filter by severity (All, Critical, High, Medium, Low)
- Filter by status (All Statuses, Open, In Progress, Resolved) — default: All Statuses
- Filter by priority (All, P1–P5)
- Full-text search across title, asset, scan name
- URL-synchronized filter state for shareable links

**FR-FIND-003: Finding Actions**
- View AI-powered remediation dialog
- Apply fix / validate fix
- Mark as in-progress / resolved
- Archive finding
- Re-scan to verify fix

**FR-FIND-004: Archive & Restore**
- Archive resolved or false-positive findings
- Restore archived findings
- Archive page with same filtering capabilities

**FR-FIND-005: Fix This First Priority System**
- Auto-flagged for findings with priorityScore ≥ 85 or Critical severity with exploitability ≥ 80

---

### 5.11 Fix Validation System

**FR-FIX-001: Pre-Fix Validation**
- Validates proposed fix before application
- Warns on risky changes with exact file locations
- Copy-to-clipboard for manual fix paths

**FR-FIX-002: Post-Fix Validation (Per-Scan)**
- Multi-step workflow after fix application
- FREE for all users (no payment required)
- AI-generated code snippets showing before/after
- Language-aware fix suggestions

**FR-FIX-003: Global Fix Manager ("Fix All Issues")**
- One-click fixes across all scans simultaneously
- Progress dialog with real-time task tracking
- Per-scan upload decision after each fix batch
- Tiered pricing: ≤30 days old = FREE, >30 days = $2.00/issue

**FR-FIX-004: Upload Decision UI**
- "Upload Now" — immediate upload with fixes
- "Test & Upload" — run tests first, then upload
- "Download Only" — download fixed files without uploading
- "Skip Upload" — apply fixes without uploading

---

### 5.12 Compliance Module

**FR-COMP-001: Standards Coverage**
- OWASP Top 10 (2021)
- NIST Cybersecurity Framework
- SOC 2 Type II controls
- ISO 27001:2022
- HIPAA Security Rule
- GDPR (Article 32)

**FR-COMP-002: Compliance Scoring**
- Per-standard compliance percentage
- Control-level pass/fail status
- Gap analysis with remediation priority

**FR-COMP-003: Compliance Reports**
- Exportable compliance evidence packages

---

### 5.13 Attack Simulator

**FR-ATK-001: Attack Chain Visualization**
- Interactive diagram of potential attack paths
- Entry point → lateral movement → target visualization

**FR-ATK-002: Exploit Path Mapping**
- Maps discovered vulnerabilities to real-world attack techniques (MITRE ATT&CK)

**FR-ATK-003: Business Impact Analysis**
- Estimates financial and operational impact of successful attacks

---

### 5.14 Reports

**FR-REP-001: Report Types**
- Executive Summary Report (C-suite audience)
- Technical Deep-Dive Report (engineering audience)
- Compliance Audit Report (auditor audience)

**FR-REP-002: Export Formats**
- HTML (view in browser)
- JSON (programmatic processing)
- PDF (formal submission)

**FR-REP-003: Report Contents**
- Finding summary by severity
- Risk trend analysis
- Top vulnerabilities with remediation status
- Compliance posture snapshot

---

### 5.15 Notifications

**FR-NOTIF-001: In-App Notifications**
- Bell icon with unread count badge
- Notification center drawer
- Mark individual / all notifications as read

**FR-NOTIF-002: Web Push Notifications**
- Browser push notifications for scan completion, fixes applied, uploads
- Per-event toggle controls in Settings

**FR-NOTIF-003: Toast Notifications**
- Clickable toasts for scan completion navigating directly to scan results

**FR-NOTIF-004: Webhook Alerts**
- Slack integration for security alerts
- Microsoft Teams integration

---

### 5.16 Scheduled Scans

**FR-SCHED-001: Scan Scheduling**
- Schedule recurring scans (daily, weekly, monthly, custom cron)
- Manage scheduled scan list (create, edit, delete)
- Supports all scan types: MVP, Mobile, Web, Pipeline, Container, Network

---

### 5.17 Settings

**FR-SET-001: Profile Management**
- Update first/last name, username, email

**FR-SET-002: Notification Preferences**
- Toggle push notifications per event type

**FR-SET-003: Alert Configuration**
- Configure Slack webhook URL
- Configure Teams webhook URL
- Set severity thresholds for alerts

**FR-SET-004: SSO Provider Management**
- Add/edit/delete SAML and OIDC providers
- Enable/disable individual providers

---

### 5.18 Learn / Resources

**FR-LEARN-001: Security Knowledge Base**
- Curated security learning resources
- Best practices for each vulnerability type

---

### 5.19 Audit Log

**FR-AUDIT-001: Activity Tracking**
- Log user actions: scans, fixes, uploads, settings changes
- Filterable audit trail

---

### 5.20 All Scans View

**FR-ALLSCANS-001: Unified Scan List**
- Consolidated view of all scan types in one table
- Filter by scan type, status, date

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Performance | Dashboard loads in < 2 seconds on standard connection |
| NFR-002 | Performance | API responses complete in < 500ms for non-AI endpoints |
| NFR-003 | Scalability | Architecture supports horizontal scaling via stateless Express servers |
| NFR-004 | Availability | 99.9% uptime SLA for production deployments |
| NFR-005 | Security | All passwords hashed with bcryptjs (salt rounds: 10+) |
| NFR-006 | Security | Sessions stored server-side; no sensitive data in localStorage |
| NFR-007 | Security | All API endpoints protected with authentication middleware |
| NFR-008 | Accessibility | WCAG 2.1 AA compliance across all pages |
| NFR-009 | Accessibility | Full keyboard navigation support |
| NFR-010 | Accessibility | Screen reader compatible (ARIA labels, roles) |
| NFR-011 | Responsiveness | Mobile-optimized below 768px with bottom tab navigation |
| NFR-012 | PWA | Web app manifest + service worker for offline support |
| NFR-013 | Data Integrity | Cascade deletes maintain referential integrity |
| NFR-014 | Encryption | Sensitive configuration data encrypted at rest |

---

## 7. User Interface Requirements

### Design System
- **Framework**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS with custom enterprise security theme
- **Primary Color**: #3B82F6 (professional blue)
- **Accent Color**: #06B6D4 (cyan)
- **Default Theme**: Dark mode (user-toggleable to light)
- **Typography**: Inter (UI text), SF Mono / JetBrains Mono (code)
- **Aesthetic**: Glassmorphic enterprise security with Material Design 3 inspiration

### Navigation Structure
```
Core
  ├── Dashboard
  ├── All Scans
  ├── MVP Code Scan
  ├── Mobile App Scan
  └── Web App Scan

Analysis
  ├── Compliance
  ├── Settings
  └── [Additional pages]

Resources
  ├── Accessibility
  ├── Privacy Policy
  └── Cookie Policy

Additional Services
  └── Code Linter Scan

Analysis (continued)
  ├── Compliance
  └── Settings
```

### Responsive Breakpoints
- Desktop (≥768px): Full sidebar navigation
- Mobile (<768px): Bottom tab navigation with 5 primary tabs

---

## 8. Integration Requirements

### 8.1 OpenAI
- Model: GPT-4 series
- Use cases: Vulnerability analysis, fix suggestions, remediation steps, risk scoring
- Rate limiting: Graceful degradation if API unavailable

### 8.2 Stripe
- Payment processing for automated fix services
- Test mode supported (card: 4242 4242 4242 4242)
- Webhook handling for payment confirmation

### 8.3 NIST NVD API
- Live CVE feed ingestion
- Refresh interval: configurable

### 8.4 CISA KEV API
- Known Exploited Vulnerabilities feed
- Cross-referenced with discovered findings

### 8.5 Slack / Microsoft Teams
- Webhook-based alert notifications
- Configurable severity thresholds

### 8.6 Web Push (VAPID)
- Browser push notification delivery
- VAPID key pair generated and stored in environment variables

---

## 9. Security & Compliance Requirements

### Authentication Security
- bcryptjs password hashing (minimum 10 salt rounds)
- Session tokens are server-side; cookie-based with HttpOnly flag
- CSRF protection on all mutating endpoints

### Data Protection
- Sensitive configuration values encrypted (AES-256)
- No PII stored beyond user registration data
- Database credentials managed via environment variables

### Compliance Coverage
The platform itself implements security controls aligned with:
- OWASP Application Security Verification Standard (ASVS)
- NIST SP 800-53 controls relevant to SaaS applications

---

## 10. Data Model Overview

| Table | Description |
|-------|-------------|
| `users` | User accounts, subscription tiers, push notification preferences |
| `sessions` | Server-side session management |
| `findings` | Security vulnerabilities discovered across all scan types |
| `mobile_app_scans` | Mobile application scan records |
| `mvp_code_scans` | MVP/source code scan records |
| `web_app_scans` | Web application scan records |
| `pipeline_scans` | CI/CD pipeline scan records |
| `container_scans` | Container image scan records |
| `network_scans` | Network infrastructure scan records |
| `linter_scans` | Code linter scan records |
| `linter_fix_batches` | Linter automated fix batch jobs |
| `pipeline_fix_batches` | Pipeline automated fix batch jobs |
| `network_fix_batches` | Network automated fix batch jobs |
| `container_fix_batches` | Container automated fix batch jobs |
| `scheduled_scans` | Recurring scan configurations |
| `alert_settings` | Per-user Slack/Teams webhook configuration |
| `sso_providers` | SAML/OIDC identity provider configurations |
| `terms_of_service_acceptances` | ToS acceptance records |
| `scan_validations` | Pre/post fix validation results |
| `fix_validation_sessions` | Payment-gated fix validation sessions |
| `notifications` | In-app notification records |
| `automated_fix_jobs` | Per-scan automated fix job tracking |
| `global_fix_jobs` | Cross-scan global fix manager jobs |
| `global_fix_scan_tasks` | Individual scan tasks within global fix jobs |
| `reports` | Generated security report records |

---

## 11. Pricing Model

### Automated Fix Pricing
| Scenario | Price |
|----------|-------|
| Finding discovered within last 30 days | FREE |
| Finding older than 30 days | $2.00 per issue |
| Per-scan post-fix validation | FREE (always) |
| Global Fix Manager (recent issues) | FREE |
| Global Fix Manager (older issues) | $2.00 per issue, no base fee |

### Subscription Tiers (Future)
| Tier | Target User |
|------|-------------|
| Free | Solo developers, up to 3 scans/month |
| Pro | Small teams, unlimited scans, advanced AI features |
| Enterprise | Large organizations, SSO, custom compliance, SLA |

---

## 12. Success Metrics (KPIs)

| Metric | Target |
|--------|--------|
| Time-to-first-scan | < 3 minutes from registration to first completed scan |
| Finding resolution rate | 70% of findings resolved within 30 days via AI fixes |
| False positive rate | < 10% across all scan types |
| User retention (30-day) | > 60% |
| API response time (P95) | < 500ms for standard endpoints |
| Scan completion rate | > 95% of initiated scans complete successfully |
| Compliance report generation | < 30 seconds |
| Payment success rate | > 98% for Stripe-processed fix payments |

---

## 13. Constraints & Assumptions

### Constraints
- Platform runs on Node.js / Express backend
- Database: PostgreSQL only (Drizzle ORM)
- Frontend: React + TypeScript (no framework swap)
- AI provider: OpenAI (no local LLM)
- Payment provider: Stripe only

### Assumptions
- Users have modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Repository access for MVP scans is via public URLs or authenticated tokens
- Mobile app scans receive binary files via URL download
- Network scans operate on networks the user has authorization to test

---

## 14. Out of Scope

- Native mobile application (iOS/Android app)
- Real-time collaborative editing of findings
- Direct IDE plugin integration (VS Code, IntelliJ)
- On-premises / self-hosted deployment packaging
- Custom LLM fine-tuning
- Automated penetration testing agent
- Bug bounty program management
