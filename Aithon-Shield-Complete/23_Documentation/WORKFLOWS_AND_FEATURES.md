# Workflows & Features Reference
# Aithon Shield — Enterprise Cybersecurity Platform

**Version:** 1.0  
**Date:** March 2026

---

## Table of Contents

1. [Application Workflows](#1-application-workflows)
2. [Feature Catalogue](#2-feature-catalogue)
3. [Page Reference](#3-page-reference)
4. [Component Reference](#4-component-reference)
5. [API Endpoint Reference](#5-api-endpoint-reference)
6. [Data Flow Diagrams](#6-data-flow-diagrams)

---

## 1. Application Workflows

### 1.1 User Registration & Onboarding Workflow

```
1. User visits /signup
2. Completes registration form (firstName, lastName, email, username, password, confirmPassword)
3. Server validates uniqueness of email + username
4. Password hashed with bcryptjs, user record created
5. Session created, user redirected to /dashboard
6. Terms of Service acceptance gate appears
7. User accepts ToS → acceptance recorded with version + timestamp
8. User lands on Dashboard
```

### 1.2 Login Workflow

```
Standard Login:
1. User visits /login
2. Enters email + password
3. Server validates credentials, creates session
4. Redirected to /dashboard

SSO Login (SAML 2.0):
1. User clicks IdP button on /login
2. Browser redirected to IdP login URL with SAMLRequest
3. IdP authenticates user, posts SAMLResponse to /api/sso/saml/callback/:providerId
4. Server validates assertion, finds/creates user
5. Session created, redirected to /dashboard

SSO Login (OIDC):
1. User clicks OIDC provider on /login
2. Browser redirected to authorization URL
3. User authenticates at IdP
4. Browser redirected to /api/sso/oidc/callback/:providerId with code
5. Server exchanges code for tokens, gets user info
6. Session created, redirected to /dashboard
```

### 1.3 New App Scan Workflow (MVP Code)

```
1. User navigates to MVP Code Scan page
2. Clicks "New Scan" → NewScanDialog opens
3. Fills: scan name, project URL, target URL, framework, language, environment
4. Submits → POST /api/mvp-scans creates record (status: "pending")
5. User clicks "Start Scan" → POST /api/mvp-scans/:id/scan
6. Scan progress dialog opens with 3 modules:
   a. SAST (Static Analysis)
   b. SCA (Software Composition Analysis)
   c. Secrets Detection
7. Each module simulates scanning with progress bar
8. AI (OpenAI) generates findings per module
9. Findings saved to database with priority scores
10. Scan status updated to "completed"
11. Toast notification appears: "Scan complete — [name]. Click to view."
12. Web push notification sent (if enabled)
13. Slack/Teams alert sent (if severity threshold met)
14. User navigates to Scan Details → sees findings list
15. User can: apply fixes, validate fixes, upload to store
```

### 1.4 Existing App Scan Workflow (Mobile/Web)

```
1. User selects "Existing App" workflow or navigates to Mobile/Web scan
2. Creates scan record with app download URL
3. System downloads app binary / crawls web URL
4. Scan modules run:
   Mobile: Binary Analysis, API Security, Secrets Detection
   Web: OWASP Top 10, SSL/TLS, Security Headers, Directory Traversal
5. Findings generated and prioritized
6. User reviews findings in Scan Details
7. User triggers Fix Validation workflow (see 1.6)
8. User uploads fixed app (see 1.7)
```

### 1.5 Code Linter Scan Workflow

```
Mode A: Code Snippet
1. User navigates to Code Linter Scan
2. Pastes code into snippet textarea
3. Selects or auto-detects language (Python signals detection)
4. Clicks "Scan Code"
5. POST /api/linter-scans/code-snippet runs security checks:
   - 11 security check categories
   - Python-specific syntax error detection (if Python detected)
6. Findings displayed in scan results
7. User expands finding → sees BEFORE/AFTER code block
8. User clicks "Copy Fix" or "Auto-Fix This Issue"
9. If fix requested → Fix Batch created with pricing calculation
10. User reviews and confirms payment (if applicable)
11. Post-fix output shown with corrected code
12. User copies all or downloads fixed file

Mode B: Folder Scan
1. User uploads ZIP file containing source files
2. POST /api/linter-scans/folder-scan extracts and scans all files
3. Results aggregated across all files in ZIP
4. Same fix workflow as Mode A

Mode C: Specific Files
1. User uploads specific named files
2. POST /api/linter-scans/specific-files scans each file
3. Results shown per-file
4. Same fix workflow as Mode A
```

### 1.6 Fix Validation Workflow (Per-Scan)

```
1. User views finding in Scan Details
2. Clicks "Validate Fix" → FixScopeDialog opens
3. User selects scope (this issue only / all issues in scan / all issues)
4. System runs pre-validation: POST /api/findings/:id/validate-fix
5. Validation result shown:
   a. SAFE: proceed to apply
   b. WARNING: shows file locations for manual fix, copy-to-clipboard
6. User confirms → fix applied
7. PostFixValidationDialog opens (FREE, no payment)
8. Multi-step workflow:
   a. AI generates code snippet (before/after, language-aware)
   b. User reviews fix
   c. User confirms or requests alternative
9. Dialog state resets on close for fresh next session
10. Upload decision dialog appears (see 1.7)
```

### 1.7 Upload with Fixes Workflow

```
1. After fix validation, UploadWithFixesOptionsDialog opens
2. User selects upload strategy:
   a. "Upload Now" → immediately trigger POST /api/:scanType/:id/upload
   b. "Test & Upload" → run tests first, then POST /api/:scanType/:id/upload-and-test
   c. "Download Only" → download fixed files, no upload
   d. "Skip Upload" → close dialog without uploading
3. If uploading:
   - UploadProgress component shows progress bar
   - POST /api/:scanType/:id/validate-upload confirms upload integrity
   - Success notification shown
   - Finding status updated
4. ReuploadReminder component stays visible if upload deferred
```

### 1.8 Global Fix Manager Workflow

```
1. User navigates to Findings page
2. Clicks "Fix All (N)" button
3. GlobalFixDialog opens showing:
   - Issues ≤30 days old: FREE
   - Issues >30 days old: $2.00 each
   - Total cost breakdown
4. User reviews and confirms
5. POST /api/global-fix-jobs creates job
6. If payment required:
   a. Stripe payment form shown (test card: 4242 4242 4242 4242)
   b. POST /api/global-fix-jobs/:id/confirm-payment
7. GlobalFixProgressDialog opens
8. Real-time progress tracking per scan task
9. For each scan task completed:
   a. Upload decision UI appears for that scan
   b. User selects: Upload Now / Test & Upload / Download / Skip
   c. PATCH /api/global-fix-jobs/:jobId/tasks/:taskId/upload-decision records decision
10. All tasks complete → success summary shown
```

### 1.9 Compliance Review Workflow

```
1. User navigates to Compliance page
2. System maps all active findings to compliance controls
3. Per-standard compliance score calculated:
   - OWASP Top 10: maps findings to A01-A10
   - NIST CSF: maps to Identify/Protect/Detect/Respond/Recover
   - SOC 2: maps to Trust Service Criteria
   - ISO 27001: maps to Annex A controls
   - HIPAA: maps to Security Rule safeguards
   - GDPR: maps to Article 32 requirements
4. User views per-standard compliance percentage
5. User drills into failing controls
6. Compliance report generated on demand
```

### 1.10 Report Generation Workflow

```
1. User navigates to Reports page
2. Clicks "Generate Report"
3. GenerateReportDialog opens
4. User selects:
   - Report type: Executive / Technical / Compliance
   - Date range
   - Scan(s) to include
5. POST /api/reports generates report
6. Report record saved to database
7. Report appears in list
8. User can: View in-app (ViewReportDialog) or Download (HTML/JSON/PDF)
```

### 1.11 Scheduled Scan Workflow

```
1. User navigates to Settings → Scheduled Scans
2. Clicks "Add Schedule"
3. Configures:
   - Scan type (MVP/Mobile/Web/Pipeline/Container/Network)
   - Scan target/name
   - Schedule: daily / weekly / monthly / custom cron
4. POST /api/scheduled-scans creates schedule
5. At scheduled time:
   a. System triggers appropriate scan endpoint
   b. Scan runs automatically
   c. Findings generated
   d. Notifications sent per user preferences
6. Results visible in respective scan type page
```

### 1.12 Notification Workflow

```
In-App:
1. Event occurs (scan complete, fix applied, etc.)
2. Notification record created in database
3. Bell icon badge increments
4. User opens NotificationCenter drawer
5. Reads notification → PATCH /api/notifications/:id/read
6. Or "Mark all read" → PATCH /api/notifications/mark-all-read

Web Push:
1. User enables push in Settings
2. Browser requests push permission
3. Push subscription registered: POST /api/push/subscribe
4. On events: pushNotificationService sends push to subscribed browser
5. Browser shows native OS notification even when app is closed

Toast:
1. Scan completes
2. Toast notification appears in bottom-right
3. Toast is clickable → navigates to scan results
4. Session-based tracking prevents duplicate toasts

Webhook (Slack/Teams):
1. Finding generated with severity ≥ threshold
2. alertService formats webhook payload
3. HTTP POST to configured Slack/Teams webhook URL
4. Message appears in configured channel
```

---

## 2. Feature Catalogue

### 2.1 Security Scanning Features

| Feature | Type | Description | Status |
|---------|------|-------------|--------|
| MVP SAST Scanning | Core | Static analysis of source code for vulnerabilities | Active |
| SCA (Dependency Scanning) | Core | Identifies vulnerable third-party packages | Active |
| Secrets Detection | Core | Detects hardcoded API keys, passwords, tokens | Active |
| Mobile Binary Analysis | Core | Static analysis of compiled iOS/Android apps | Active |
| Mobile API Security | Core | Tests API calls made by mobile apps | Active |
| DAST Web Scanning | Core | Dynamic scanning of live web applications | Active |
| OWASP Top 10 Testing | Core | Tests for all 10 OWASP vulnerability categories | Active |
| SSL/TLS Analysis | Core | Checks certificate and protocol configuration | Active |
| Security Headers Check | Core | Verifies HTTP security headers presence | Active |
| CI/CD Pipeline Scanning | Extended | Scans pipeline configuration files | Active |
| Container Image Scanning | Extended | Analyzes Docker images and Dockerfiles | Active |
| Network Infrastructure Scan | Extended | Port and service vulnerability assessment | Active |
| Code Linter Security Scan | Extended | Multi-language code security linting | Active |
| Python Syntax Detection | Linter | Detects 5 categories of Python syntax errors | Active |
| Attack Simulation | Advanced | Visualizes potential attack chains | Active |
| Scheduled Scanning | Automation | Recurring scans on configurable schedule | Active |

### 2.2 AI-Powered Features

| Feature | Description | Cost |
|---------|-------------|------|
| AI Risk Scoring | Calculates exploitability, impact, attack surface scores | Included |
| Vulnerability Summaries | Natural language descriptions of each finding | Included |
| Code Fix Suggestions | BEFORE/AFTER code snippets for each vulnerability | Included |
| Dependency Upgrade Recs | Recommends safe version upgrades | Included |
| Remediation Steps | Step-by-step fix instructions | Included |
| Re-scan Validation | AI validates that applied fix resolves the issue | Included |
| Post-Fix Code Generation | Language-aware complete fixed file generation | Included |

### 2.3 Compliance Features

| Standard | Coverage | Report Export |
|----------|----------|---------------|
| OWASP Top 10 (2021) | A01–A10 control mapping | Yes |
| NIST Cybersecurity Framework | All 5 functions | Yes |
| SOC 2 Type II | Trust Service Criteria | Yes |
| ISO 27001:2022 | Annex A controls | Yes |
| HIPAA Security Rule | Administrative/Physical/Technical safeguards | Yes |
| GDPR Article 32 | Security measures requirements | Yes |

### 2.4 Prioritization Features

| Level | Severity | Score Range | Badge Color |
|-------|----------|-------------|-------------|
| P1 | Critical | 85–100 | Red |
| P2 | High | 70–84 | Orange |
| P3 | Medium | 50–69 | Yellow |
| P4 | Low | 25–49 | Blue |
| P5 | Minimal/Info | 0–24 | Gray |

Additional: "Fix This First" badge for P1 findings or Critical+exploitability≥80

### 2.5 Authentication Features

| Feature | Implementation |
|---------|---------------|
| Email/Password Auth | bcryptjs, server-side sessions |
| Session Management | PostgreSQL-backed sessions |
| SAML 2.0 SSO | SP-initiated, metadata exchange, ACS |
| OIDC/OAuth 2.0 SSO | Authorization code flow |
| Multi-IdP Support | Multiple providers simultaneously |
| Terms of Service Gate | Version-tracked mandatory acceptance |

### 2.6 Notification Features

| Channel | Trigger Events | Configurable |
|---------|---------------|--------------|
| In-App Bell | All events | Read/unread |
| Web Push | Scan complete, fixes applied, upload | Per-event toggle |
| Toast | Scan complete | Always on |
| Slack Webhook | Findings above threshold | Severity threshold |
| Teams Webhook | Findings above threshold | Severity threshold |

---

## 3. Page Reference

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | Redirects to `/dashboard` | Root redirect |
| `/login` | `Login.tsx` | Email/password + SSO login |
| `/signup` | `Signup.tsx` | User registration |
| `/dashboard` | `Dashboard.tsx` | Security overview, metrics, threat feed |
| `/scans` | `Scans.tsx` | Scan type selection hub |
| `/scans/all` | `AllScans.tsx` | Unified list of all scans |
| `/mvp-scan` | `MvpCodeScan.tsx` | MVP code scan management |
| `/mobile-scan` | `MobileAppScan.tsx` | Mobile app scan management |
| `/web-scan` | `WebAppScan.tsx` | Web app scan management |
| `/scans/:type/:id` | `ScanDetails.tsx` | Individual scan findings + actions |
| `/linter` | `LinterScan.tsx` | Code linter scan (3 modes) |
| `/findings` | `Findings.tsx` | All findings with filters |
| `/findings?status=all` | `Findings.tsx` | Default view: all statuses |
| `/archive` | `Archive.tsx` | Archived findings |
| `/compliance` | `Compliance.tsx` | Compliance posture by standard |
| `/reports` | `Reports.tsx` | Report generation and downloads |
| `/attack-simulator` | `AttackSimulator.tsx` | Attack chain visualization |
| `/audit-log` | `AuditLog.tsx` | User activity audit trail |
| `/learn` | `Learn.tsx` | Security knowledge base |
| `/settings` | `Settings.tsx` | Profile, notifications, alerts, SSO |
| `/mvp-preview/:id` | `MvpPreview.tsx` | App preview with QR code |
| `/accessibility` | `AccessibilityStatement.tsx` | WCAG accessibility statement |
| `/privacy` | `PrivacyPolicy.tsx` | Privacy policy |
| `/cookies` | `CookiePolicy.tsx` | Cookie policy |

---

## 4. Component Reference

### Core Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| `AppSidebar` | `components/AppSidebar.tsx` | Main sidebar navigation |
| `MobileHeader` | `components/MobileHeader.tsx` | Mobile top header |
| `MobileNav` | `components/MobileNav.tsx` | Bottom tab navigation (mobile) |
| `NotificationCenter` | `components/NotificationCenter.tsx` | Notification drawer |

### Scan Components

| Component | File | Purpose |
|-----------|------|---------|
| `NewScanDialog` | `components/NewScanDialog.tsx` | Create new scan modal |
| `EditMvpScanDialog` | `components/EditMvpScanDialog.tsx` | Edit MVP scan inline |
| `EditMobileAppScanDialog` | `components/EditMobileAppScanDialog.tsx` | Edit mobile scan inline |
| `EditWebAppScanDialog` | `components/EditWebAppScanDialog.tsx` | Edit web scan inline |
| `ScanProgressCard` | `components/ScanProgressCard.tsx` | Scan module progress display |
| `ScanningAnimation` | `components/ScanningAnimation.tsx` | Animated scanning visual |
| `ProjectCard` | `components/ProjectCard.tsx` | Scan summary card |
| `ChooseWorkflowSection` | `components/ChooseWorkflowSection.tsx` | New/Existing app workflow selector |
| `NewAppWorkflowDialog` | `components/NewAppWorkflowDialog.tsx` | New app full workflow dialog |
| `ExistingAppWorkflowDialog` | `components/ExistingAppWorkflowDialog.tsx` | Existing app workflow dialog |

### Finding Components

| Component | File | Purpose |
|-----------|------|---------|
| `FindingsTable` | `components/FindingsTable.tsx` | Main findings table with P1-P5 priority |
| `FindingCard` | `components/FindingCard.tsx` | Individual finding card |
| `RemediationDialog` | `components/RemediationDialog.tsx` | AI-powered fix suggestion dialog |
| `PriorityWidget` | `components/PriorityWidget.tsx` | Priority score display widget |
| `RiskMapVisualization` | `components/RiskMapVisualization.tsx` | Risk distribution chart |

### Fix Workflow Components

| Component | File | Purpose |
|-----------|------|---------|
| `FixScopeDialog` | `components/FixScopeDialog.tsx` | Select fix scope (one/scan/all) |
| `PostFixValidationDialog` | `components/PostFixValidationDialog.tsx` | Post-fix validation (FREE) |
| `GlobalFixDialog` | `components/GlobalFixDialog.tsx` | Global fix manager with pricing |
| `GlobalFixProgressDialog` | `components/GlobalFixProgressDialog.tsx` | Fix progress tracker |
| `UploadWithFixesOptionsDialog` | `components/UploadWithFixesOptionsDialog.tsx` | Upload strategy selection |
| `UploadWithoutFixesWarningDialog` | `components/UploadWithoutFixesWarningDialog.tsx` | Upload warning without fixes |
| `UploadProgress` | `components/UploadProgress.tsx` | Upload progress indicator |
| `ReuploadReminder` | `components/ReuploadReminder.tsx` | Reminder to re-upload after fix |
| `LinterFixScopeDialog` | `components/LinterFixScopeDialog.tsx` | Linter-specific fix scope |
| `MinimizedDialogBar` | `components/MinimizedDialogBar.tsx` | Minimized dialog status bar |

### Reports & Compliance Components

| Component | File | Purpose |
|-----------|------|---------|
| `GenerateReportDialog` | `components/GenerateReportDialog.tsx` | Report creation modal |
| `ViewReportDialog` | `components/ViewReportDialog.tsx` | In-app report viewer |

### Payment Components

| Component | File | Purpose |
|-----------|------|---------|
| `MockStripeForm` | `components/MockStripeForm.tsx` | Stripe payment form (test mode UI) |

### Utility Components

| Component | File | Purpose |
|-----------|------|---------|
| `MetricCard` | `components/MetricCard.tsx` | Dashboard metric display card |
| `SeverityBadge` | `components/SeverityBadge.tsx` | Color-coded severity indicator |
| `InfoTooltip` | `components/InfoTooltip.tsx` | Help tooltip with info icon |

---

## 5. API Endpoint Reference

### Authentication

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/auth/signup` | No | Register new user |
| POST | `/api/auth/login` | No | Login with email/password |
| POST | `/api/auth/logout` | Yes | Invalidate session |
| GET | `/api/auth/me` | Yes | Get current user |

### User Management

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| PATCH | `/api/user/profile` | Yes | Update profile |
| PATCH | `/api/user/notifications` | Yes | Update notification preferences |

### MVP Code Scans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mvp-scans` | List user's MVP scans |
| POST | `/api/mvp-scans` | Create MVP scan |
| GET | `/api/mvp-scans/:id` | Get scan details |
| PATCH | `/api/mvp-scans/:id` | Update scan |
| DELETE | `/api/mvp-scans/:id` | Delete scan + cascade |
| POST | `/api/mvp-scans/:id/scan` | Trigger scan |
| GET | `/api/mvp-scans/:id/findings` | Get scan findings |
| POST | `/api/mvp-scans/:id/upload` | Upload scan artifacts |
| POST | `/api/mvp-scans/:id/upload-and-test` | Upload + run tests |
| POST | `/api/mvp-scans/:id/validate-upload` | Validate upload |
| GET | `/api/mvp-scans/:id/qrcode` | Get QR code |
| PATCH | `/api/mvp-scans/:id/cancel` | Cancel scan |

### Mobile App Scans (same pattern as MVP)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/mobile-scans` | List / Create |
| GET/PATCH/DELETE | `/api/mobile-scans/:id` | Read / Update / Delete |
| POST | `/api/mobile-scans/:id/scan` | Trigger |
| GET | `/api/mobile-scans/:id/findings` | Findings |
| POST | `/api/mobile-scans/:id/upload` | Upload |
| POST | `/api/mobile-scans/:id/upload-and-test` | Upload + Test |
| POST | `/api/mobile-scans/:id/validate-upload` | Validate |
| PATCH | `/api/mobile-scans/:id/cancel` | Cancel |

### Web App Scans (same pattern as MVP)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/web-scans` | List / Create |
| GET/PATCH/DELETE | `/api/web-scans/:id` | Read / Update / Delete |
| POST | `/api/web-scans/:id/scan` | Trigger |
| GET | `/api/web-scans/:id/findings` | Findings |
| POST | `/api/web-scans/:id/upload` | Upload |
| POST | `/api/web-scans/:id/upload-and-test` | Upload + Test |
| POST | `/api/web-scans/:id/validate-upload` | Validate |
| PATCH | `/api/web-scans/:id/cancel` | Cancel |

### Pipeline, Container, Network Scans (same base pattern)

Each has: `GET/POST /api/{type}-scans`, `GET/PATCH /api/{type}-scans/:id`

### Code Linter Scans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/linter-scans` | List linter scans |
| POST | `/api/linter-scans` | Create linter scan |
| POST | `/api/linter-scans/folder-scan` | Scan uploaded folder |
| POST | `/api/linter-scans/code-snippet` | Scan pasted code |
| POST | `/api/linter-scans/specific-files` | Scan specific files |
| GET | `/api/linter-scans/:id` | Get scan |
| PATCH | `/api/linter-scans/:id` | Update scan |
| POST | `/api/linter-scans/:id/fix` | Apply fix |
| POST | `/api/linter-scans/:id/auto-fix-all` | Auto-fix all findings |
| GET | `/api/linter-scans/:id/fix-batches` | List fix batches |
| GET | `/api/linter-scans/:id/fixed-code` | Get original + fixed code |
| POST | `/api/linter-scans/:id/upload` | Upload |
| POST | `/api/linter-scans/:id/upload-with-tests` | Upload + tests |

### Findings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/findings` | List all user findings |
| POST | `/api/findings` | Create finding |
| GET | `/api/findings/archived` | List archived findings |
| POST | `/api/findings/cleanup` | Clean up stale findings |
| POST | `/api/findings/recalculate-priorities` | Recalculate all priority scores |
| PATCH | `/api/findings/:id` | Update finding status |
| POST | `/api/findings/:id/validate-fix` | Pre-validate fix |
| POST | `/api/findings/:id/apply-fix` | Apply fix |
| POST | `/api/findings/:id/rescan` | Re-scan after fix |
| POST | `/api/findings/:id/archive` | Archive finding |
| POST | `/api/findings/:id/restore` | Restore archived finding |

### Fix System

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scans/:scanType/:id/validate-post-fix` | Post-fix validation |
| POST | `/api/scans/:scanType/:id/manual-fix-snippets` | Get AI fix snippets |
| POST | `/api/scans/:scanType/:id/auto-fix-all` | Auto-fix all scan findings |
| GET | `/api/fix-validation-sessions/:id` | Get validation session |
| POST | `/api/fix-validation-sessions/:id/confirm-payment` | Confirm payment |
| POST | `/api/global-fix-jobs` | Create global fix job |
| GET | `/api/global-fix-jobs/:id` | Get job status |
| GET | `/api/global-fix-jobs/:id/tasks` | List job tasks |
| POST | `/api/global-fix-jobs/:id/confirm-payment` | Confirm payment |
| POST | `/api/global-fix-jobs/:jobId/tasks/:taskId/upload` | Upload task result |
| PATCH | `/api/global-fix-jobs/:jobId/tasks/:taskId/upload-decision` | Record upload decision |

### Fix Batches (per scan type)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/linter-fix-batches/:id` | Get linter fix batch |
| POST | `/api/linter-fix-batches/:id/confirm-payment` | Confirm payment |
| GET | `/api/pipeline-fix-batches/:id` | Get pipeline fix batch |
| POST | `/api/pipeline-fix-batches/:id/confirm-payment` | Confirm payment |

### Automated Fix Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automated-fix-jobs/:id` | Get automated fix job status |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | List reports |
| POST | `/api/reports` | Generate report |
| GET | `/api/reports/:id` | Get report |
| GET | `/api/reports/:id/download/html` | Download HTML |
| GET | `/api/reports/:id/download/json` | Download JSON |
| GET | `/api/reports/:id/download/pdf` | Download PDF |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/unread` | Unread notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/mark-all-read` | Mark all read |

### Push Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/push/vapid-public-key` | Get VAPID public key |
| POST | `/api/push/subscribe` | Register push subscription |
| POST | `/api/push/unsubscribe` | Remove push subscription |

### Alert Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alert-settings` | Get Slack/Teams settings |
| PATCH | `/api/alert-settings` | Update settings |
| POST | `/api/test-alert` | Send test alert |

### Scheduled Scans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduled-scans` | List schedules |
| POST | `/api/scheduled-scans` | Create schedule |
| PATCH | `/api/scheduled-scans/:id` | Update schedule |
| DELETE | `/api/scheduled-scans/:id` | Delete schedule |

### SSO Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sso/providers` | List all providers |
| GET | `/api/sso/providers/enabled` | List enabled providers |
| POST | `/api/sso/providers` | Create provider |
| PATCH | `/api/sso/providers/:id` | Update provider |
| DELETE | `/api/sso/providers/:id` | Delete provider |
| GET | `/api/sso/saml/login/:providerId` | SAML login redirect |
| POST | `/api/sso/saml/callback/:providerId` | SAML ACS |
| GET | `/api/sso/saml/metadata/:providerId` | SAML metadata |
| GET | `/api/sso/oidc/login/:providerId` | OIDC login redirect |
| GET | `/api/sso/oidc/callback/:providerId` | OIDC callback |

### Terms of Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/terms-of-service/status` | Check acceptance status |
| POST | `/api/terms-of-service/accept` | Accept ToS |

### Threat Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threat-feed` | Get live CVE/KEV feed |

### Code Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/validate-code` | Validate code snippet |

---

## 6. Data Flow Diagrams

### 6.1 Scan → Findings → Priority Flow

```
User Creates Scan
      ↓
POST /api/:type-scans
      ↓
Scan Record Created (status: pending)
      ↓
User Triggers Scan
      ↓
POST /api/:type-scans/:id/scan
      ↓
OpenAI generates vulnerability findings
      ↓
calculatePriorityScores() for each finding:
  - exploitabilityScore = f(CWE)
  - impactScore = f(CWE)
  - attackSurfaceScore = f(asset type)
  - priorityScore = weighted composite
      ↓
Findings saved to database
      ↓
recalculatePriorityScores() bulk update
      ↓
Frontend displays findings with P1-P5:
  - P1 = Critical severity
  - P2 = High severity
  - P3 = Medium severity
  - P4 = Low severity
  - P5 = Info/Unknown severity
```

### 6.2 Fix Validation → Payment → Upload Flow

```
User clicks "Fix Issue"
      ↓
FixScopeDialog → select scope
      ↓
POST /api/findings/:id/validate-fix
      ↓
  [SAFE?] → Apply fix directly
  [RISKY?] → Show file location warning + clipboard
      ↓
PostFixValidationDialog (FREE)
      ↓
AI generates BEFORE/AFTER code snippet
      ↓
User reviews and confirms
      ↓
UploadWithFixesOptionsDialog
  ├── Upload Now → POST /api/:type-scans/:id/upload
  ├── Test & Upload → POST /api/:type-scans/:id/upload-and-test
  ├── Download Only → client-side file download
  └── Skip Upload → close dialog
```

### 6.3 Global Fix Pricing Flow

```
User clicks "Fix All"
      ↓
GlobalFixDialog opens
      ↓
System queries all unresolved findings:
  - findings.createdAt ≤ 30 days: FREE
  - findings.createdAt > 30 days: $2.00 each
      ↓
Display cost breakdown
      ↓
  [Free total?] → Skip payment
  [Cost > $0?] → MockStripeForm
      ↓
POST /api/global-fix-jobs (creates job)
      ↓
[If payment] POST /api/global-fix-jobs/:id/confirm-payment
      ↓
GlobalFixProgressDialog tracks tasks
      ↓
Per task: UploadDecision UI
      ↓
All tasks complete → Summary
```

### 6.4 Compliance Score Calculation Flow

```
GET /api/findings (all active)
      ↓
Map each finding.cwe to compliance controls:
  OWASP A01 → broken-access-control CWEs
  OWASP A02 → cryptographic-failure CWEs
  OWASP A03 → injection CWEs
  ... (A04-A10)
      ↓
Count: passing controls / total controls
      ↓
Score = (passing / total) × 100
      ↓
Display per-standard gauge/percentage
      ↓
Failing controls → remediation priority list
```
