# Technical Architecture
# Aithon Shield — Enterprise Cybersecurity Platform

**Version:** 1.0  
**Date:** March 2026

---

## 1. System Overview

Aithon Shield is a full-stack TypeScript monorepo with a React frontend served by a Vite dev server in development and bundled for production, an Express.js REST API backend, and a PostgreSQL database managed through Drizzle ORM.

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│   React + TypeScript + Tailwind + shadcn/ui + Wouter    │
│   TanStack Query  │  Vite (dev) / Static Build (prod)   │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP / REST API
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   Express.js Backend                     │
│   TypeScript  │  server/routes.ts  │  server/storage.ts │
│   Drizzle ORM  │  auth middleware  │  AI / Push / SSO   │
└────────────────────────────┬────────────────────────────┘
                             │ SQL
                             ▼
┌─────────────────────────────────────────────────────────┐
│                PostgreSQL Database                        │
│   25+ tables  │  UUID primary keys  │  Cascading FKs    │
└─────────────────────────────────────────────────────────┘
                             +
┌─────────────────────────────────────────────────────────┐
│              External Services                           │
│   OpenAI API  │  Stripe API  │  NIST NVD  │  CISA KEV  │
│   Slack Webhooks  │  Teams Webhooks  │  Web Push VAPID  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```
workspace/
├── client/                     # Frontend (React + TypeScript)
│   ├── public/                 # Static assets, manifest.json, sw.js
│   └── src/
│       ├── App.tsx             # Root router, auth guard, layout
│       ├── main.tsx            # React entry point
│       ├── index.css           # Global styles, CSS custom properties, theme
│       ├── pages/              # Route-level page components (23 pages)
│       ├── components/         # Reusable components
│       │   └── ui/             # shadcn/ui base components
│       ├── hooks/              # Custom React hooks
│       └── lib/
│           ├── queryClient.ts  # TanStack Query setup + apiRequest helper
│           ├── findings.ts     # Finding utility functions
│           └── utils.ts        # Shared utilities
├── server/                     # Backend (Express.js + TypeScript)
│   ├── index.ts               # Server entry point, middleware setup
│   ├── routes.ts              # All API route handlers (4500+ lines)
│   ├── storage.ts             # IStorage interface + DatabaseStorage impl
│   ├── auth.ts                # Authentication helpers
│   ├── prioritization.ts      # Auto-prioritization scoring engine
│   ├── validation-service.ts  # Fix validation logic
│   ├── alertService.ts        # Slack/Teams webhook notifications
│   ├── pushNotificationService.ts  # Web Push (VAPID) service
│   ├── threatFeedService.ts   # NIST NVD + CISA KEV feed client
│   ├── encryption.ts          # AES-256 encryption for sensitive data
│   ├── oidcService.ts         # OpenID Connect service
│   ├── samlService.ts         # SAML 2.0 service
│   ├── db.ts                  # Drizzle + PostgreSQL connection
│   └── vite.ts               # Vite dev server integration (DO NOT MODIFY)
├── shared/
│   └── schema.ts              # All Drizzle table definitions + Zod schemas
├── docs/                      # Project documentation (this folder)
├── drizzle.config.ts          # Drizzle configuration (DO NOT MODIFY)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.ts         # Tailwind + shadcn theme configuration
├── vite.config.ts             # Vite configuration (DO NOT MODIFY)
└── replit.md                  # Project memory and preferences
```

---

## 3. Frontend Architecture

### 3.1 Routing (Wouter)

```typescript
// App.tsx structure
<QueryClientProvider>
  <TooltipProvider>
    <SidebarProvider>
      <AppSidebar />
      <main>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/findings" component={Findings} />
          // ... 20+ routes
        </Switch>
      </main>
    </SidebarProvider>
    <Toaster />
  </TooltipProvider>
</QueryClientProvider>
```

### 3.2 Data Fetching (TanStack Query v5)

```typescript
// Standard query pattern
const { data, isLoading } = useQuery({
  queryKey: ['/api/findings'],
  // Default fetcher from queryClient.ts calls GET /api/findings
});

// Standard mutation pattern
const mutation = useMutation({
  mutationFn: () => apiRequest('POST', '/api/findings/:id/apply-fix', body),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/findings'] });
  },
});
```

### 3.3 Theme System

CSS custom properties defined in `index.css`:
```css
:root {
  --background: 222 84% 5%;      /* dark background */
  --foreground: 210 40% 98%;     /* text */
  --primary: 217 91% 60%;        /* #3B82F6 blue */
  --accent: 189 94% 43%;         /* #06B6D4 cyan */
  --destructive: 0 84% 60%;      /* red for Critical */
}
```

Tailwind configuration maps these to utility classes.

### 3.4 Form Validation

All forms use `react-hook-form` + `zodResolver`:
```typescript
const form = useForm<InsertMvpScan>({
  resolver: zodResolver(insertMvpScanSchema),
  defaultValues: { name: '', projectUrl: '', ... }
});
```

---

## 4. Backend Architecture

### 4.1 Server Entry Point (index.ts)

```
Express server initialization:
1. CORS configuration
2. JSON body parsing
3. Cookie parsing for sessions
4. Session middleware (PostgreSQL-backed)
5. Register all routes (routes.ts)
6. Vite dev middleware (development only)
7. Static file serving (production)
8. Listen on PORT (default: 5000)
```

### 4.2 Storage Layer Pattern (storage.ts)

The storage layer uses an interface + implementation pattern:

```typescript
interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  
  // Finding operations
  getFindings(userId: string): Promise<Finding[]>;
  createFinding(data: InsertFinding): Promise<Finding>;
  updateFinding(id: string, data: Partial<Finding>): Promise<Finding>;
  
  // ... 100+ methods
  
  recalculatePriorityScores(): Promise<void>;
}

class DatabaseStorage implements IStorage {
  // All methods use Drizzle ORM queries
  async getFindings(userId: string): Promise<Finding[]> {
    return await db.select()
      .from(findings)
      .where(and(
        eq(findings.userId, userId),
        eq(findings.archived, false)
      ))
      .orderBy(desc(findings.createdAt));
  }
}
```

### 4.3 Route Handler Pattern

All routes follow this thin controller pattern:
```typescript
app.get('/api/findings', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const results = await storage.getFindings(userId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

### 4.4 Authentication Middleware

```typescript
async function requireAuth(req, res, next) {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return res.status(401).json({ message: 'Unauthorized' });
  
  const session = await storage.getSession(sessionId);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  
  req.session = session; // Attach to request
  next();
}
```

---

## 5. Database Architecture

### 5.1 Connection (db.ts)

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

### 5.2 Table Relationships

```
users (1) ──────────── (N) sessions
users (1) ──────────── (N) findings
users (1) ──────────── (N) mvp_code_scans
users (1) ──────────── (N) mobile_app_scans
users (1) ──────────── (N) web_app_scans
users (1) ──────────── (N) pipeline_scans
users (1) ──────────── (N) container_scans
users (1) ──────────── (N) network_scans
users (1) ──────────── (N) linter_scans
users (1) ──────────── (N) reports
users (1) ──────────── (N) notifications
users (1) ──────────── (1) alert_settings

mvp_code_scans (1) ──── (N) findings (via mvpScanId)
mobile_app_scans (1) ── (N) findings (via mobileScanId)
web_app_scans (1) ───── (N) findings (via webScanId)
pipeline_scans (1) ──── (N) findings (via pipelineScanId)
container_scans (1) ─── (N) findings (via containerScanId)
linter_scans (1) ──────── (N) linter_fix_batches

global_fix_jobs (1) ─── (N) global_fix_scan_tasks
```

All foreign keys use `ON DELETE CASCADE` to maintain referential integrity.

### 5.3 Key Columns by Table

**findings**
- `severity`: text — "Critical" | "High" | "Medium" | "Low"
- `priorityScore`: integer 0–100 (computed by prioritization engine)
- `exploitabilityScore`: integer 0–100
- `impactScore`: integer 0–100
- `attackSurfaceScore`: integer 0–100
- `riskScore`: integer 0–10
- `status`: text — "open" | "in-progress" | "resolved"
- `scanType`: text — "mvp" | "mobile" | "web" | "pipeline" | "container" | "network" | "linter"
- `fixesApplied`: boolean
- `archived`: boolean

**linter_scans**
- `scanMode`: text — "folder" | "snippet" | "specific-files"
- `language`: text — programming language
- `codeContent`: text — original code for fixed-code endpoint

---

## 6. Auto-Prioritization Engine (prioritization.ts)

The engine calculates four scores for every finding:

```typescript
// 1. Severity base weight
const SEVERITY_WEIGHTS = {
  Critical: 100, High: 75, Medium: 50, Low: 25
};

// 2. CWE exploitability (15+ CWEs mapped)
const CWE_EXPLOITABILITY = {
  'CWE-89': 95,  // SQL Injection
  'CWE-78': 95,  // OS Command Injection
  'CWE-79': 90,  // XSS
  // ...
};

// 3. CWE impact (15+ CWEs mapped)
const CWE_IMPACT = {
  'CWE-78': 100, // OS Command Injection — full system compromise
  // ...
};

// 4. Asset attack surface
const ASSET_ATTACK_SURFACE = {
  'API Endpoint': 90,
  'Authentication': 95,
  // ...
};

// Composite score formula
function calculatePriorityScores(finding) {
  const severityWeight = SEVERITY_WEIGHTS[finding.severity] ?? 25;
  const exploitability = CWE_EXPLOITABILITY[`CWE-${finding.cwe}`] ?? 50;
  const impact = CWE_IMPACT[`CWE-${finding.cwe}`] ?? 50;
  const attackSurface = ASSET_ATTACK_SURFACE[finding.asset] ?? 50;
  
  const priorityScore = Math.round(
    (severityWeight * 0.4) +
    (exploitability * 0.25) +
    (impact * 0.25) +
    (attackSurface * 0.10)
  );
  
  return { exploitabilityScore, impactScore, attackSurfaceScore, priorityScore };
}
```

**P1–P5 Display Mapping (Frontend)**
```typescript
function getPriorityTier(severity: string): string {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical') return 'P1';
  if (s === 'high')     return 'P2';
  if (s === 'medium')   return 'P3';
  if (s === 'low')      return 'P4';
  return 'P5';
}
```

---

## 7. Security Architecture

### 7.1 Password Security
- Algorithm: bcryptjs with salt rounds = 10 minimum
- Storage: hash only, never plaintext
- Comparison: `bcrypt.compare()` (timing-safe)

### 7.2 Session Security
- Sessions stored in PostgreSQL (not in-memory)
- Session ID transmitted via HttpOnly cookie
- Session invalidated on logout (hard delete from DB)
- Sessions have configurable TTL

### 7.3 API Security
- All non-public endpoints protected by `requireAuth` middleware
- Input validated with Zod schemas before processing
- User scoping on all data queries (`WHERE user_id = :userId`)
- No direct object reference vulnerabilities (user ownership checked)

### 7.4 Data Encryption
- SSO provider client secrets encrypted with AES-256 (`encryption.ts`)
- Encryption key from `ENCRYPTION_KEY` environment variable

### 7.5 CORS Configuration
- Configured for Replit dev domain in development
- Restricted to production domain in production

---

## 8. AI Integration Architecture

### 8.1 OpenAI Usage Pattern

```
Scan trigger received
      ↓
For each vulnerability category:
  1. Build prompt with: category, language, codeContext
  2. Call OpenAI completions API
  3. Parse response into Finding structure
  4. Save to database with scores
      ↓
Recalculate all priority scores
```

### 8.2 Fix Generation Pattern

```
User requests fix for Finding
      ↓
Build prompt with:
  - finding.title, finding.description
  - finding.aiSuggestion (existing hint)
  - finding.severity, finding.cwe
  - user code context (if available)
  - target language
      ↓
OpenAI generates:
  - BEFORE code block (vulnerable)
  - AFTER code block (fixed)
  - Explanation of change
      ↓
Return to frontend as structured response
```

### 8.3 Graceful Degradation
- If OpenAI unavailable: use pre-built finding templates
- Static BEFORE/AFTER templates available for all 11 security categories
- No scan failure due to AI service outage

---

## 9. Payment Architecture (Stripe)

### 9.1 Payment Flow

```
Frontend: GlobalFixDialog calculates cost
      ↓
Backend: POST /api/global-fix-jobs (creates job)
      ↓
If cost > 0:
  Frontend: MockStripeForm collects card info
  Backend: POST .../confirm-payment
  Stripe: Creates/confirms PaymentIntent
  Backend: Marks job as paid, proceeds with fixes
      ↓
If cost = 0:
  Backend: Immediately proceeds with fixes
```

### 9.2 Pricing Logic
```typescript
const DAYS_FREE_THRESHOLD = 30;
const COST_PER_OLD_ISSUE = 2.00; // USD

function calculateFixCost(findings: Finding[]): { free: number; paid: number; total: number } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  const freeCount = findings.filter(f => new Date(f.detected) >= thirtyDaysAgo).length;
  const paidCount = findings.filter(f => new Date(f.detected) < thirtyDaysAgo).length;
  
  return {
    free: freeCount,
    paid: paidCount,
    total: paidCount * COST_PER_OLD_ISSUE
  };
}
```

### 9.3 Test Mode
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC
- Displayed prominently in payment UI during development
- Controlled by `TESTING_STRIPE_SECRET_KEY` vs `STRIPE_SECRET_KEY`

---

## 10. Web Push Architecture

### 10.1 VAPID Key Management
```
First start (no env keys):
  → Generate new VAPID key pair
  → Log to console: "Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY"
  → Use generated keys for this session

Production:
  → Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment
  → Consistent key pair across restarts
```

### 10.2 Push Subscription Flow
```
User enables push in Settings
      ↓
Browser requests notification permission
      ↓
GET /api/push/vapid-public-key → applicationServerKey
      ↓
navigator.serviceWorker.ready.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey
})
      ↓
POST /api/push/subscribe { subscription: PushSubscription }
      ↓
Subscription stored in users.pushSubscription (JSON)
```

### 10.3 Push Delivery
```
Event occurs (scan complete, fix applied, etc.)
      ↓
pushNotificationService.sendNotification(userId, payload)
      ↓
Load user's push subscription from database
      ↓
webpush.sendNotification(subscription, JSON.stringify(payload))
      ↓
Browser receives push → service worker shows notification
```

---

## 11. SSO Architecture

### 11.1 SAML 2.0 Flow
```
Configuration stored in sso_providers table (encrypted secrets)
      ↓
SP metadata: GET /api/sso/saml/metadata/:providerId
      ↓
IdP login: GET /api/sso/saml/login/:providerId
  → Generate SAMLRequest
  → Redirect to IdP SSO URL with SAMLRequest
      ↓
IdP authenticates user
      ↓
ACS: POST /api/sso/saml/callback/:providerId
  → Parse and validate SAMLResponse
  → Extract nameID and attributes
  → Find or create user account
  → Create session
  → Redirect to /dashboard
```

### 11.2 OIDC Flow
```
Auth URL: GET /api/sso/oidc/login/:providerId
  → Build authorization URL with state + nonce
  → Redirect to IdP
      ↓
Callback: GET /api/sso/oidc/callback/:providerId
  → Exchange code for tokens
  → Validate ID token (JWT)
  → Call userinfo endpoint
  → Find or create user
  → Create session
  → Redirect to /dashboard
```

---

## 12. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PGDATABASE` | Yes | Database name |
| `PGHOST` | Yes | Database host |
| `PGPORT` | Yes | Database port |
| `PGUSER` | Yes | Database user |
| `PGPASSWORD` | Yes | Database password |
| `SESSION_SECRET` | Yes | Express session signing secret |
| `STRIPE_SECRET_KEY` | Production | Stripe live secret key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Production | Stripe live publishable key |
| `TESTING_STRIPE_SECRET_KEY` | Development | Stripe test secret key |
| `TESTING_VITE_STRIPE_PUBLIC_KEY` | Development | Stripe test publishable key |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `VAPID_PUBLIC_KEY` | Production | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Production | Web Push VAPID private key |
| `ENCRYPTION_KEY` | Yes | AES-256 key for SSO secret encryption |

---

## 13. Performance Considerations

| Area | Optimization |
|------|-------------|
| Database queries | User-scoped queries prevent cross-tenant data leakage and improve index usage |
| Priority recalculation | Bulk update after scan completion, not per-finding |
| Finding filtering | Client-side filtering for fast UX without additional API calls |
| TanStack Query caching | 5-minute stale time for scan lists; immediate invalidation on mutations |
| Static assets | Vite build with code splitting and tree shaking |
| Images | SVG icons via lucide-react (no raster image loading) |

---

## 14. Deployment Architecture

```
Production (Replit Hosting):
  ├── Build: npm run build (Vite bundles frontend)
  ├── Serve: npm run start (Express serves static + API)
  ├── Domain: *.replit.app (or custom domain)
  ├── TLS: Automatic via Replit
  ├── Health checks: Express responds on /
  └── Database: Replit PostgreSQL (persistent)

Development:
  ├── npm run dev
  ├── tsx server/index.ts (backend with hot reload)
  ├── Vite dev server (HMR for frontend)
  └── Both served on port 5000 via Vite middleware
```
