# Work Breakdown Structure (WBS)
# Aithon Shield — Enterprise Cybersecurity Platform

**Version:** 1.0  
**Date:** March 2026  
**Project Type:** Full-Stack Web Application  
**Tech Stack:** React + TypeScript / Express.js / PostgreSQL

---

## WBS Hierarchy Key

```
1.0  Phase / Module
  1.1  Feature Area
    1.1.1  Work Package
      1.1.1.1  Task
```

---

## 1.0 Project Foundation

### 1.1 Project Setup
- 1.1.1 Initialize Node.js monorepo (client + server + shared)
- 1.1.2 Configure TypeScript across all packages
- 1.1.3 Configure Vite for frontend build
- 1.1.4 Configure Express.js backend server
- 1.1.5 Set up Tailwind CSS with custom theme variables
- 1.1.6 Install and configure shadcn/ui component library
- 1.1.7 Set up PostgreSQL database connection via Drizzle ORM
- 1.1.8 Configure environment variable management
- 1.1.9 Set up path aliases (`@/`, `@shared/`, `@assets/`)
- 1.1.10 Configure ESLint and TypeScript strict mode

### 1.2 Database Schema Design
- 1.2.1 Design `users` table with subscription fields
- 1.2.2 Design `sessions` table for server-side auth
- 1.2.3 Design `findings` table with scoring fields
- 1.2.4 Design `mvp_code_scans` table
- 1.2.5 Design `mobile_app_scans` table
- 1.2.6 Design `web_app_scans` table
- 1.2.7 Design `pipeline_scans` table
- 1.2.8 Design `container_scans` table
- 1.2.9 Design `network_scans` table
- 1.2.10 Design `linter_scans` table with `code_content` column
- 1.2.11 Design fix batch tables (linter, pipeline, network, container)
- 1.2.12 Design `scheduled_scans` table
- 1.2.13 Design `alert_settings` table
- 1.2.14 Design `sso_providers` table
- 1.2.15 Design `terms_of_service_acceptances` table
- 1.2.16 Design `scan_validations` table
- 1.2.17 Design `fix_validation_sessions` table
- 1.2.18 Design `notifications` table
- 1.2.19 Design `automated_fix_jobs` table
- 1.2.20 Design `global_fix_jobs` and `global_fix_scan_tasks` tables
- 1.2.21 Design `reports` table
- 1.2.22 Generate Zod insert schemas and TypeScript types for all tables
- 1.2.23 Run `db:push` to sync schema to PostgreSQL

### 1.3 Shared Type System
- 1.3.1 Export all table types (`$inferSelect`) from `shared/schema.ts`
- 1.3.2 Export all insert types from Zod schemas
- 1.3.3 Define validation schemas (login, signup, profile update, etc.)

---

## 2.0 Authentication & Authorization

### 2.1 Email/Password Authentication
- 2.1.1 Build `POST /api/auth/signup` endpoint
  - 2.1.1.1 Validate input with Zod signUpSchema
  - 2.1.1.2 Check email/username uniqueness
  - 2.1.1.3 Hash password with bcryptjs
  - 2.1.1.4 Create user record in database
  - 2.1.1.5 Create session and return user
- 2.1.2 Build `POST /api/auth/login` endpoint
  - 2.1.2.1 Validate credentials
  - 2.1.2.2 Compare password hash
  - 2.1.2.3 Create session record
- 2.1.3 Build `POST /api/auth/logout` endpoint
  - 2.1.3.1 Invalidate session in database
- 2.1.4 Build `GET /api/auth/me` endpoint for session hydration

### 2.2 Session Management
- 2.2.1 Implement `requireAuth` middleware
- 2.2.2 Session lookup from cookie on every request
- 2.2.3 Automatic session expiry handling
- 2.2.4 Session cleanup on logout

### 2.3 Terms of Service
- 2.3.1 Build `GET /api/terms-of-service/status` endpoint
- 2.3.2 Build `POST /api/terms-of-service/accept` endpoint
- 2.3.3 Frontend ToS acceptance gate before main app access
- 2.3.4 Version-tracked acceptance records

### 2.4 Enterprise SSO
- 2.4.1 Build SAML 2.0 service provider implementation
  - 2.4.1.1 SP metadata generation endpoint
  - 2.4.1.2 SP-initiated login redirect
  - 2.4.1.3 ACS callback handler with assertion parsing
- 2.4.2 Build OIDC/OAuth 2.0 implementation
  - 2.4.2.1 Authorization URL generation
  - 2.4.2.2 Token exchange callback
  - 2.4.2.3 User info endpoint consumption
- 2.4.3 SSO provider CRUD API (list, create, update, delete, enable/disable)
- 2.4.4 Test OIDC provider for development/QA
- 2.4.5 Frontend SSO login buttons on Login page

### 2.5 Login & Signup Pages
- 2.5.1 Build Login page with form validation
- 2.5.2 Build Signup page with password confirmation
- 2.5.3 Add SSO provider login buttons
- 2.5.4 Handle authentication errors with user-friendly messages
- 2.5.5 Redirect to dashboard after successful auth

---

## 3.0 Core Application Shell

### 3.1 App Layout & Routing
- 3.1.1 Set up Wouter for client-side routing
- 3.1.2 Define all routes in `App.tsx`
- 3.1.3 Implement protected route wrapper
- 3.1.4 Configure TanStack Query with default fetcher

### 3.2 Sidebar Navigation (AppSidebar)
- 3.2.1 Implement shadcn Sidebar with SidebarProvider
- 3.2.2 Group navigation: Core, Analysis, Resources, Additional Services
- 3.2.3 Active route highlighting
- 3.2.4 Collapsible sidebar with toggle button
- 3.2.5 Display user name and subscription tier
- 3.2.6 Notification bell with unread count
- 3.2.7 Logout button
- 3.2.8 Theme toggle (dark/light)

### 3.3 Mobile Navigation
- 3.3.1 Implement MobileHeader component
- 3.3.2 Implement MobileNav bottom tab bar (≤768px)
- 3.3.3 5-tab layout: Dashboard, Scans, Findings, Reports, Settings
- 3.3.4 Mobile header with hamburger + notifications

### 3.4 Theme System
- 3.4.1 Define CSS custom properties for light and dark themes
- 3.4.2 Implement ThemeProvider with localStorage persistence
- 3.4.3 Dark mode toggle component
- 3.4.4 Severity-based color system (Critical=red, High=orange, Medium=yellow, Low=blue)

### 3.5 PWA Support
- 3.5.1 Create `manifest.json` with app metadata
- 3.5.2 Implement service worker for offline support
- 3.5.3 Configure mobile viewport meta tags

---

## 4.0 Dashboard

- 4.1 Build Security Health Score calculation and display widget
- 4.2 Build metric cards (total findings, critical count, scans this month, avg risk score)
- 4.3 Build attack surface visualization chart
- 4.4 Build industry benchmarking comparison widget
- 4.5 Build compliance summary quick-view cards (6 standards)
- 4.6 Integrate NIST NVD API for live CVE feed
- 4.7 Integrate CISA KEV API for known exploited vulnerabilities
- 4.8 Implement `threatFeedService.ts` for feed aggregation
- 4.9 Build live threat intelligence feed display component
- 4.10 Build ChooseWorkflowSection (New App / Existing App quick actions)

---

## 5.0 Security Scanning Engine

### 5.1 Shared Scan Infrastructure
- 5.1.1 Build `ScanningAnimation` component
- 5.1.2 Build `ScanProgressCard` component with module status
- 5.1.3 Build generic finding generation logic
- 5.1.4 Implement `prioritization.ts` auto-prioritization engine
  - 5.1.4.1 SEVERITY_WEIGHTS constants (Critical=100, High=75, Medium=50, Low=25)
  - 5.1.4.2 CWE-based exploitability scoring
  - 5.1.4.3 CWE-based impact scoring
  - 5.1.4.4 Asset attack surface scoring
  - 5.1.4.5 Composite priority score calculation
- 5.1.5 Implement `recalculatePriorityScores()` storage method
- 5.1.6 Build scan CRUD operations in storage layer

### 5.2 MVP Code Scan
- 5.2.1 Build `POST /api/mvp-scans` endpoint
- 5.2.2 Build `GET /api/mvp-scans` endpoint (list)
- 5.2.3 Build `GET /api/mvp-scans/:id` endpoint
- 5.2.4 Build `PATCH /api/mvp-scans/:id` endpoint (inline edit)
- 5.2.5 Build `DELETE /api/mvp-scans/:id` endpoint (with cascade)
- 5.2.6 Build `POST /api/mvp-scans/:id/scan` endpoint (trigger scan)
- 5.2.7 Build `GET /api/mvp-scans/:id/findings` endpoint
- 5.2.8 Build `POST /api/mvp-scans/:id/upload` endpoint
- 5.2.9 Build `POST /api/mvp-scans/:id/upload-and-test` endpoint
- 5.2.10 Build `POST /api/mvp-scans/:id/validate-upload` endpoint
- 5.2.11 Build `GET /api/mvp-scans/:id/qrcode` endpoint
- 5.2.12 Build `PATCH /api/mvp-scans/:id/cancel` endpoint
- 5.2.13 Build `MvpCodeScan` page with scan list
- 5.2.14 Build `NewScanDialog` for MVP scan creation
- 5.2.15 Build `EditMvpScanDialog` for inline editing
- 5.2.16 Build scan details navigation to `ScanDetails` page
- 5.2.17 Implement SAST, SCA, and Secrets Detection modules
- 5.2.18 Build AI-powered finding generation with OpenAI

### 5.3 Mobile App Scan
- 5.3.1 Build all API endpoints (parallel to 5.2.1–5.2.12)
- 5.3.2 Build `MobileAppScan` page
- 5.3.3 Build `EditMobileAppScanDialog`
- 5.3.4 Implement binary analysis, API security, and secrets modules
- 5.3.5 Platform-specific patterns (iOS/Android)

### 5.4 Web App Scan
- 5.4.1 Build all API endpoints (parallel to 5.2.1–5.2.12, no QR)
- 5.4.2 Build `WebAppScan` page
- 5.4.3 Build `EditWebAppScanDialog`
- 5.4.4 Implement DAST modules (OWASP Top 10, SSL, headers, etc.)

### 5.5 CI/CD Pipeline Scan
- 5.5.1 Build pipeline scan API endpoints (CRUD + scan trigger + fix batches)
- 5.5.2 Integrate into AllScans page
- 5.5.3 Implement pipeline config analysis patterns

### 5.6 Container Scan
- 5.6.1 Build container scan API endpoints
- 5.6.2 Implement Dockerfile and base image analysis

### 5.7 Network Scan
- 5.7.1 Build network scan API endpoints
- 5.7.2 Implement port and service analysis patterns

### 5.8 Code Linter Scan
- 5.8.1 Build `POST /api/linter-scans` endpoint (create)
- 5.8.2 Build `GET /api/linter-scans` endpoint (list)
- 5.8.3 Build `GET /api/linter-scans/:id` endpoint
- 5.8.4 Build `POST /api/linter-scans/folder-scan` endpoint
- 5.8.5 Build `POST /api/linter-scans/code-snippet` endpoint
- 5.8.6 Build `POST /api/linter-scans/specific-files` endpoint
- 5.8.7 Build `PATCH /api/linter-scans/:id` endpoint
- 5.8.8 Build `POST /api/linter-scans/:id/fix` endpoint
- 5.8.9 Build `POST /api/linter-scans/:id/auto-fix-all` endpoint
- 5.8.10 Build `GET /api/linter-scans/:id/fix-batches` endpoint
- 5.8.11 Build `GET /api/linter-scans/:id/fixed-code` endpoint
- 5.8.12 Build `POST /api/linter-scans/:id/upload` endpoint
- 5.8.13 Build `POST /api/linter-scans/:id/upload-with-tests` endpoint
- 5.8.14 Implement security check detection engine
  - 5.8.14.1 SQL Injection patterns (multi-language)
  - 5.8.14.2 XSS vulnerability patterns
  - 5.8.14.3 Command injection patterns
  - 5.8.14.4 Hardcoded credentials / secrets
  - 5.8.14.5 CSRF vulnerability patterns
  - 5.8.14.6 Insecure randomness
  - 5.8.14.7 Missing authentication checks
  - 5.8.14.8 Dangerous function detection (eval, exec, system)
  - 5.8.14.9 Sensitive data exposure
  - 5.8.14.10 Authentication bypass patterns
  - 5.8.14.11 Path traversal patterns
- 5.8.15 Implement Python-specific syntax error detection
  - 5.8.15.1 Missing colon on all control structures (all occurrences)
  - 5.8.15.2 Incomplete `def` statement (missing `)`)
  - 5.8.15.3 Unclosed list comprehensions (missing `]`)
  - 5.8.15.4 Unclosed dict literals (brace balance check)
  - 5.8.15.5 Adjacent string + variable without operator
- 5.8.16 Implement language auto-detection from PYTHON_SIGNALS
- 5.8.17 Build `LinterScan` page with three scan mode tabs
- 5.8.18 Build `FolderScanDialog` component
- 5.8.19 Build interactive fix dialog with BEFORE/AFTER code blocks
- 5.8.20 Build `LinterFixScopeDialog` for fix batch management
- 5.8.21 Build fix payment flow with `MockStripeForm`

### 5.9 Scan Details Page
- 5.9.1 Build `ScanDetails` page with finding list
- 5.9.2 Build finding cards with severity badges
- 5.9.3 Implement fix workflow from scan details
- 5.9.4 Build upload flow with fix options

---

## 6.0 Findings Management

### 6.1 Findings API
- 6.1.1 Build `GET /api/findings` endpoint with user scoping
- 6.1.2 Build `POST /api/findings` endpoint
- 6.1.3 Build `PATCH /api/findings/:id` endpoint (status update)
- 6.1.4 Build `POST /api/findings/:id/validate-fix` endpoint
- 6.1.5 Build `POST /api/findings/:id/apply-fix` endpoint
- 6.1.6 Build `POST /api/findings/:id/rescan` endpoint
- 6.1.7 Build `POST /api/findings/:id/archive` endpoint
- 6.1.8 Build `POST /api/findings/:id/restore` endpoint
- 6.1.9 Build `GET /api/findings/archived` endpoint
- 6.1.10 Build `POST /api/findings/cleanup` endpoint
- 6.1.11 Build `POST /api/findings/recalculate-priorities` endpoint

### 6.2 Priority System
- 6.2.1 Implement `getPriorityTier(severity)` function (P1–P5 from severity)
- 6.2.2 Implement `getPriorityLabel()` for human-readable labels
- 6.2.3 Implement `getPriorityColor()` for color-coded badges
- 6.2.4 Implement `isFixThisFirst()` logic for critical findings

### 6.3 FindingsTable Component
- 6.3.1 Build sortable/filterable table with all columns
- 6.3.2 Build P1–P5 priority badge with color coding
- 6.3.3 Build "Fix This First" indicator badge
- 6.3.4 Build action dropdown (remediate, archive, rescan, fix, upload)
- 6.3.5 Build status update via dropdown

### 6.4 Findings Page
- 6.4.1 Build filter bar (severity, status, priority, search)
- 6.4.2 Implement default status = "All Statuses"
- 6.4.3 Implement URL-synchronized filter state
- 6.4.4 Build "Fix All Issues" button trigger
- 6.4.5 Integrate GlobalFixDialog and GlobalFixProgressDialog

### 6.5 Archive Page
- 6.5.1 Build Archive page with same filtering as Findings
- 6.5.2 Implement restore action

---

## 7.0 AI-Powered Fix System

### 7.1 Remediation Dialog
- 7.1.1 Build `RemediationDialog` with AI suggestion display
- 7.1.2 Format BEFORE/AFTER code blocks with syntax highlighting
- 7.1.3 Copy-to-clipboard for fix suggestions
- 7.1.4 File location guidance for manual fixes

### 7.2 Fix Validation System
- 7.2.1 Build `POST /api/findings/:id/validate-fix` handler
- 7.2.2 Build pre-fix validation with risk warnings
- 7.2.3 Build `FixScopeDialog` for selecting fix scope
- 7.2.4 Build `validation-service.ts` for fix risk assessment

### 7.3 Post-Fix Validation (Per-Scan)
- 7.3.1 Build `POST /api/scans/:scanType/:id/validate-post-fix` endpoint
- 7.3.2 Build `POST /api/scans/:scanType/:id/manual-fix-snippets` endpoint
- 7.3.3 Build `PostFixValidationDialog` (always FREE)
  - 7.3.3.1 Multi-step workflow UI
  - 7.3.3.2 Dialog state reset on fresh open
  - 7.3.3.3 Language-aware snippet generation
  - 7.3.3.4 Before/after code display

### 7.4 Auto-Fix (Per-Scan)
- 7.4.1 Build `POST /api/scans/:scanType/:id/auto-fix-all` endpoint
- 7.4.2 Build `POST /api/linter-scans/:id/auto-fix-all` endpoint
- 7.4.3 Build `POST /api/pipeline-scans/:id/auto-fix-all` endpoint
- 7.4.4 Implement fix batch creation and Stripe payment gate

### 7.5 Global Fix Manager
- 7.5.1 Build `POST /api/global-fix-jobs` endpoint
- 7.5.2 Build `GET /api/global-fix-jobs/:id` endpoint
- 7.5.3 Build `GET /api/global-fix-jobs/:id/tasks` endpoint
- 7.5.4 Build `POST /api/global-fix-jobs/:id/confirm-payment` endpoint
- 7.5.5 Build `PATCH /api/global-fix-jobs/:jobId/tasks/:taskId/upload-decision` endpoint
- 7.5.6 Build `GlobalFixDialog` with tiered pricing breakdown
- 7.5.7 Build `GlobalFixProgressDialog` with real-time task tracking
- 7.5.8 Implement tiered pricing: ≤30 days FREE, >30 days $2.00/issue

### 7.6 Upload Decision UI
- 7.6.1 Build `UploadWithFixesOptionsDialog`
  - 7.6.1.1 "Upload Now" action
  - 7.6.1.2 "Test & Upload" action
  - 7.6.1.3 "Download Only" action
  - 7.6.1.4 "Skip Upload" action
- 7.6.2 Build `UploadWithoutFixesWarningDialog`
- 7.6.3 Build `UploadProgress` component with progress bar
- 7.6.4 Build `ReuploadReminder` notification component

---

## 8.0 Compliance Module

- 8.1 Build `Compliance` page
- 8.2 Implement OWASP Top 10 control mapping
- 8.3 Implement NIST CSF control mapping
- 8.4 Implement SOC 2 Type II control mapping
- 8.5 Implement ISO 27001:2022 control mapping
- 8.6 Implement HIPAA Security Rule mapping
- 8.7 Implement GDPR Article 32 mapping
- 8.8 Build compliance score calculation per standard
- 8.9 Build control-level pass/fail display
- 8.10 Build compliance gap analysis view

---

## 9.0 Reports Module

### 9.1 Report Generation API
- 9.1.1 Build `POST /api/reports` endpoint
- 9.1.2 Build `GET /api/reports` endpoint (list)
- 9.1.3 Build `GET /api/reports/:id` endpoint
- 9.1.4 Build `GET /api/reports/:id/download/html` endpoint
- 9.1.5 Build `GET /api/reports/:id/download/json` endpoint
- 9.1.6 Build `GET /api/reports/:id/download/pdf` endpoint

### 9.2 Report Types
- 9.2.1 Implement Executive Summary report template
- 9.2.2 Implement Technical Deep-Dive report template
- 9.2.3 Implement Compliance Audit report template

### 9.3 Reports UI
- 9.3.1 Build `Reports` page with report list
- 9.3.2 Build `GenerateReportDialog` for report creation
- 9.3.3 Build `ViewReportDialog` for in-app report viewing
- 9.3.4 Implement download action buttons (HTML, JSON, PDF)

---

## 10.0 Notifications System

### 10.1 In-App Notifications
- 10.1.1 Build `GET /api/notifications` endpoint
- 10.1.2 Build `GET /api/notifications/unread` endpoint
- 10.1.3 Build `PATCH /api/notifications/:id/read` endpoint
- 10.1.4 Build `PATCH /api/notifications/mark-all-read` endpoint
- 10.1.5 Build `NotificationCenter` drawer component
- 10.1.6 Build notification bell with animated unread badge

### 10.2 Web Push Notifications
- 10.2.1 Implement `pushNotificationService.ts` with VAPID
- 10.2.2 Build `GET /api/push/vapid-public-key` endpoint
- 10.2.3 Build `POST /api/push/subscribe` endpoint
- 10.2.4 Build `POST /api/push/unsubscribe` endpoint
- 10.2.5 Implement push triggers for: scan complete, fix applied, upload
- 10.2.6 Build push permission request UI

### 10.3 Toast Notifications
- 10.3.1 Implement scan completion toasts
- 10.3.2 Make toasts clickable to navigate to scan results
- 10.3.3 Session-based tracking to prevent duplicate notifications

### 10.4 Webhook Alerts
- 10.4.1 Implement `alertService.ts`
- 10.4.2 Build `POST /api/test-alert` endpoint
- 10.4.3 Slack webhook integration
- 10.4.4 Microsoft Teams webhook integration
- 10.4.5 Configurable severity threshold for alert triggering

---

## 11.0 Scheduled Scans

- 11.1 Build `GET /api/scheduled-scans` endpoint
- 11.2 Build `POST /api/scheduled-scans` endpoint
- 11.3 Build `PATCH /api/scheduled-scans/:id` endpoint
- 11.4 Build `DELETE /api/scheduled-scans/:id` endpoint
- 11.5 Build scheduled scans management UI
- 11.6 Implement cron expression builder/selector
- 11.7 Implement scan type selector for scheduled scans

---

## 12.0 Settings Module

- 12.1 Build `GET /api/alert-settings` endpoint
- 12.2 Build `PATCH /api/alert-settings` endpoint
- 12.3 Build `PATCH /api/user/profile` endpoint
- 12.4 Build `PATCH /api/user/notifications` endpoint
- 12.5 Build `Settings` page with tabbed layout
- 12.6 Profile tab: name, username, email update form
- 12.7 Notifications tab: push notification toggles per event
- 12.8 Alerts tab: Slack/Teams webhook URL configuration + test button
- 12.9 SSO tab: provider list with add/edit/delete/enable actions
- 12.10 Implement alert threshold selector

---

## 13.0 Additional Pages

### 13.1 All Scans
- 13.1.1 Build `AllScans` page with unified scan list
- 13.1.2 Filter by scan type, status, date range
- 13.1.3 Navigate to individual scan detail pages

### 13.2 Attack Simulator
- 13.2.1 Build `AttackSimulator` page
- 13.2.2 Build attack chain visualization component
- 13.2.3 Build exploit path mapping display
- 13.2.4 Build business impact analysis panel

### 13.3 Audit Log
- 13.3.1 Build `AuditLog` page with activity feed
- 13.3.2 Implement activity filtering and search

### 13.4 Learn
- 13.4.1 Build `Learn` page with security resource library
- 13.4.2 Categorized content by vulnerability type

### 13.5 Legal Pages
- 13.5.1 Build `AccessibilityStatement` page (WCAG 2.1 AA)
- 13.5.2 Build `PrivacyPolicy` page
- 13.5.3 Build `CookiePolicy` page

### 13.6 MVP Preview
- 13.6.1 Build `MvpPreview` page for app preview with QR code

---

## 14.0 Payment Processing (Stripe)

- 14.1 Integrate Stripe SDK on backend
- 14.2 Build `MockStripeForm` component (test mode UI)
- 14.3 Implement payment confirmation endpoints for all fix types:
  - Linter fix batches
  - Pipeline fix batches
  - Network fix batches
  - Container fix batches
  - Global fix jobs
  - Fix validation sessions
- 14.4 Display test card data in payment forms (dev/test mode)
- 14.5 Build tiered pricing calculation logic (30-day threshold)

---

## 15.0 Supporting Infrastructure

### 15.1 AI Integration
- 15.1.1 Configure OpenAI client in backend
- 15.1.2 Build finding description generation prompts
- 15.1.3 Build fix suggestion generation prompts
- 15.1.4 Build risk score explanation prompts
- 15.1.5 Implement graceful degradation if OpenAI unavailable

### 15.2 Encryption Service
- 15.2.1 Build `encryption.ts` for AES-256 encryption
- 15.2.2 Apply encryption to sensitive SSO configuration data

### 15.3 Threat Feed Service
- 15.3.1 Build `threatFeedService.ts`
- 15.3.2 NIST NVD API client
- 15.3.3 CISA KEV API client
- 15.3.4 Data normalization for display

### 15.4 Auto-Prioritization Engine
- 15.4.1 CWE exploitability weight table (15+ CWEs)
- 15.4.2 CWE impact weight table
- 15.4.3 Asset attack surface table
- 15.4.4 Composite score formula implementation
- 15.4.5 Bulk recalculation on scan completion

---

## 16.0 Quality Assurance

### 16.1 Frontend QA
- 16.1.1 Verify all interactive elements have `data-testid` attributes
- 16.1.2 WCAG 2.1 AA color contrast verification
- 16.1.3 Keyboard navigation testing
- 16.1.4 Mobile responsive layout testing (375px, 768px, 1440px)
- 16.1.5 Dark/light mode visual regression testing

### 16.2 Backend QA
- 16.2.1 API endpoint authorization testing
- 16.2.2 Input validation boundary testing
- 16.2.3 Session security testing
- 16.2.4 Database cascade delete verification

### 16.3 Integration QA
- 16.3.1 End-to-end scan workflow testing
- 16.3.2 Fix validation workflow testing
- 16.3.3 SSO login flow testing
- 16.3.4 Push notification delivery testing
- 16.3.5 Stripe payment flow testing (test mode)

---

## 17.0 Deployment & DevOps

- 17.1 Configure production environment variables
- 17.2 Set Stripe production keys (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY)
- 17.3 Configure VAPID keys for production push notifications
- 17.4 Set SESSION_SECRET for production
- 17.5 Configure production DATABASE_URL
- 17.6 Deploy to Replit hosting with .replit.app domain
- 17.7 Verify all health checks pass post-deployment

---

## WBS Summary Table

| Phase | Work Packages | Status |
|-------|--------------|--------|
| 1.0 Foundation | 33 tasks | Complete |
| 2.0 Authentication | 23 tasks | Complete |
| 3.0 App Shell | 22 tasks | Complete |
| 4.0 Dashboard | 10 tasks | Complete |
| 5.0 Scanning Engine | 85 tasks | Complete |
| 6.0 Findings Management | 27 tasks | Complete |
| 7.0 Fix System | 31 tasks | Complete |
| 8.0 Compliance | 10 tasks | Complete |
| 9.0 Reports | 11 tasks | Complete |
| 10.0 Notifications | 18 tasks | Complete |
| 11.0 Scheduled Scans | 7 tasks | Complete |
| 12.0 Settings | 10 tasks | Complete |
| 13.0 Additional Pages | 13 tasks | Complete |
| 14.0 Payments | 8 tasks | Complete |
| 15.0 Infrastructure | 14 tasks | Complete |
| 16.0 QA | 14 tasks | Ongoing |
| 17.0 Deployment | 7 tasks | In Progress |
| **Total** | **~343 tasks** | |
