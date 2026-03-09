# Aithon Shield — Documentation Package

**Export Date:** March 2026  
**Version:** 1.0  
**Platform:** Aithon Shield Enterprise Cybersecurity Platform

---

## Contents of This Package

| File | Description |
|------|-------------|
| `PRD.md` | Product Requirements Document — detailed feature requirements, personas, pricing, KPIs |
| `WBS.md` | Work Breakdown Structure — all 343+ development tasks organized by phase |
| `WORKFLOWS_AND_FEATURES.md` | Complete workflow documentation, feature catalogue, API reference, data flows |
| `TECHNICAL_ARCHITECTURE.md` | System architecture, database schema, security design, AI/payment/SSO integration |
| `README.md` | This file — documentation index |

---

## Quick Reference

### Application URL
- Development: `http://localhost:5000`
- Production: `https://*.replit.app`

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Routing | Wouter |
| State/Data | TanStack Query v5 |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI GPT-4 |
| Payments | Stripe |
| Auth | bcryptjs sessions + SAML 2.0 + OIDC |
| Push | Web Push API (VAPID) |

### Key Pages
| Page | URL |
|------|-----|
| Dashboard | `/dashboard` |
| MVP Code Scan | `/mvp-scan` |
| Mobile App Scan | `/mobile-scan` |
| Web App Scan | `/web-scan` |
| Code Linter | `/linter` |
| Findings | `/findings` |
| Compliance | `/compliance` |
| Reports | `/reports` |
| Settings | `/settings` |

### Test Credentials
- Email: `Milan@yahoo.com` / Password: `987654321`
- Email: `samuel@yahoo.com` / Password: `password`

### Test Payment Card (Stripe Test Mode)
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### Pricing Model
| Scenario | Cost |
|----------|------|
| Issues ≤ 30 days old | FREE |
| Issues > 30 days old | $2.00 per issue |
| Per-scan post-fix validation | Always FREE |

### Priority System
| Priority | Severity | Color |
|----------|----------|-------|
| P1 | Critical | Red |
| P2 | High | Orange |
| P3 | Medium | Yellow |
| P4 | Low | Blue |
| P5 | Info/Unknown | Gray |

---

## How to Run Locally

```bash
# Install dependencies
npm install

# Start development server (frontend + backend on port 5000)
npm run dev

# Push database schema changes
npm run db:push

# Build for production
npm run build

# Start production server
npm run start
```

---

## Environment Variables Required

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_... (production)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... (production)
TESTING_STRIPE_SECRET_KEY=sk_test_... (development)
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_... (development)
VAPID_PUBLIC_KEY=... (auto-generated if not set)
VAPID_PRIVATE_KEY=... (auto-generated if not set)
```

---

## Scan Types Supported

1. **MVP Code Scan** — SAST + SCA + Secrets Detection for source code
2. **Mobile App Scan** — Binary analysis + API security for iOS/Android apps
3. **Web App Scan** — DAST + OWASP Top 10 for live web applications
4. **CI/CD Pipeline Scan** — Security analysis of pipeline configuration files
5. **Container Scan** — Docker image and Dockerfile security analysis
6. **Network Scan** — Port, service, and CVE assessment
7. **Code Linter Scan** — Multi-language security linting (11 categories + Python syntax)

---

## Compliance Standards Covered

- OWASP Top 10 (2021)
- NIST Cybersecurity Framework
- SOC 2 Type II
- ISO 27001:2022
- HIPAA Security Rule
- GDPR Article 32
