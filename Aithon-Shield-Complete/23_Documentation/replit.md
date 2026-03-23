# Aithon Shield

## Overview
Aithon Shield is an enterprise cybersecurity testing and remediation platform designed to identify and fix security vulnerabilities across various development stages. It supports pre-launch MVP security scanning, ongoing security testing for live mobile applications, and comprehensive attack simulation for web applications. The platform aims to provide complete security coverage, AI-powered analysis, and robust compliance features for individual developers to large organizations. Its business vision is to provide a comprehensive, AI-enhanced security platform that simplifies vulnerability management and ensures compliance across the software development lifecycle, addressing a critical market need for integrated and intelligent cybersecurity solutions.

## User Preferences
- Default theme: Dark mode (enterprise security standard)
- Scan default: Comprehensive scanning with all security modules enabled
- Notifications: Critical findings trigger immediate alerts
- Navigation: Grouped by Core, Analysis, and Resources sections

## System Architecture
The Aithon Shield platform utilizes a React + TypeScript frontend with Wouter for routing and TanStack Query for data fetching. The backend is built with Express.js + TypeScript, and data is persisted using PostgreSQL. UI components are developed using shadcn/ui with Radix primitives, styled with Tailwind CSS, featuring a custom enterprise security theme. AI integration is provided via OpenAI.

**UI/UX Decisions:**
- **Theme**: Enterprise security aesthetic with dark mode, professional blue primary (#3B82F6), and severity-based color system.
- **Typography**: Inter for UI, SF Mono for code/technical data.
- **Layout**: Grouped sidebar navigation (Core, Analysis, Resources) with responsive design, including mobile-first bottom tab navigation for screens under 768px.
- **Components**: Material Design 3 inspired with Linear-style aesthetics.
- **PWA Support**: Web app manifest, service worker for offline support, and mobile-optimized viewport.

**Technical Implementations & Feature Specifications:**
- **App Workflow Selection**: Single-screen experiences for "New App" (code scan from repo to deployment) and "Existing App" (download deployed app, scan, re-upload) with progressive disclosure, live progress indicators, inline results, and user choice for automated fixes.
- **Security Scanning Workflows**: Comprehensive scanning for MVP Code (SAST, SCA, Secrets Detection), Mobile Apps (binary analysis, API security), Web Apps (DAST, OWASP Top 10), CI/CD Pipelines, Containers, Networks, and Code Linters.
- **Scan Management**: Full CRUD operations for scans (MVP, Mobile, Web) including inline editing with dirty field tracking and real-time validation, and delete functionality with confirmation and cascade deletion. Scan lists are sorted by creation date (latest first).
- **AI-Powered Features**: Risk scoring, vulnerability summaries, code fix suggestions, dependency upgrade recommendations, remediation steps, and re-scan validation.
- **Security Fix Validation System with File Location Guidance**: Validates fixes pre-application, providing warnings with exact file locations for manual fixes and copy-to-clipboard functionality.
- **Enhanced Fix Validation & Automated Fix Service**: Multi-step workflow for post-fix validation, offering AI-generated code snippets for manual fixes (free, language-aware, before/after display). Per-scan automated fixes (PostFixValidationDialog) are completely FREE - no payment required. Dialog state properly resets on fresh open to prevent stale state from previous sessions. Upload only triggers on explicit user action (clicking "Upload Now" or "Test & Upload" buttons in UploadWithFixesOptionsDialog).
- **Global Fix Manager ("Fix All Issues")**: One-click system to apply AI-powered security fixes across all scans with tiered pricing, detailed breakdown, real-time progress tracking, and enhanced upload decision UI after each scan. **Tiered Pricing Model**: Issues found within 30 days are FREE; issues older than 30 days cost $2.00 each (no base fee). Payment forms display test mode instructions with test card data (4242 4242 4242 4242) for development and testing.
- **Clickable Scan Notifications & Navigation**: Real-time toast notifications for scan completion with direct navigation, session-based tracking, and AI-powered fix suggestions.
- **Dashboard & Monitoring**: Security Health Score, real-time metrics, industry benchmarking, attack surface visualization, and live threat intelligence.
- **Compliance & Standards**: Tracks security posture against major standards like OWASP Top 10, NIST, SOC 2, ISO 27001, HIPAA, and GDPR.
- **Attack Simulation**: Attack chain visualization, exploit path mapping, and business impact analysis.
- **Findings Management**: Comprehensive table with filtering, search, severity, AI-powered risk scores, CWE/OWASP mapping, and status tracking.
- **Reporting**: Executive, Technical, and Compliance report generation with PDF and JSON export.
- **Enterprise SSO**: Hybrid SAML 2.0 and OAuth/OIDC authentication with multi-IdP support.
- **Web Push Notifications**: Browser-based push notifications for scan completion and fixes, with configurable preferences.

**System Design Choices:**
- **Frontend (`client/src/`)**: Organized into `pages/`, `components/` (including `ui/`), and `lib/`.
- **Backend (`server/`)**: `routes.ts` for API, `storage.ts` for data persistence, `index.ts` for server configuration.
- **Shared (`shared/`)**: `schema.ts` for shared TypeScript types and Drizzle schemas.

## External Dependencies
-   **OpenAI**: For AI-powered vulnerability analysis and remediation suggestions.
-   **PostgreSQL**: Primary database for persistent data storage.
-   **Stripe**: Payment processing for automated fix services.
-   **Web Push**: `web-push` npm package for browser push notifications.
-   **Authentication**: Custom email/password authentication using `bcryptjs` and database-backed sessions.
-   **Email Service**: Currently logs to console; future integration with SendGrid or similar.
-   **Webhook-based Alerts**: Slack and Microsoft Teams for notifications.
-   **Live Threat Feeds**: NIST NVD and CISA KEV public APIs.