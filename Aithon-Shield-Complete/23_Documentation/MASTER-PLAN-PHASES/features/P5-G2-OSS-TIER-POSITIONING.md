# P5-G2 — OSS Tier Positioning (Plans & Pricing)

## Purpose

Position Aithon Shield with a clear **free tier for open-source projects** (unlimited public-repo scans) alongside paid Pro and Enterprise tiers. This feature adds a dedicated Plans & Pricing page, wires the Settings page to the user's real subscription tier, and exposes backend APIs for plan info and tier upgrades.

## User-facing summary

| What changed | Where |
|---|---|
| New **Plans & Pricing** page with 3-tier comparison | Sidebar > Resources > Plans & Pricing |
| "Free for Open Source" callout — unlimited public-repo scans | Plans page |
| Full feature comparison table (28 features across 3 tiers) | Plans page |
| **Upgrade to Pro** / **Contact Sales** buttons | Plans page |
| Settings page tier section now shows **real** plan + status | Settings > Subscription Tier |
| "View Plans & Pricing" button in Settings | Settings > Subscription Tier |

## Technical implementation

### Shared tier configuration

**File:** `shared/tierConfig.ts`

Defines the single source of truth for:
- `TIER_PLANS` — name, tagline, price, highlights, CTA for Free/OSS, Pro, Enterprise
- `TIER_FEATURES` — 28-row feature comparison matrix (boolean or string per tier)
- `TIER_LIMITS` — numeric limits per tier (max private repos, max scans/month, AI features flag, enterprise features flag)

### Backend API

**File:** `server/routes.ts`

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/plans` | No | Returns all plans, features, and limits |
| `GET /api/plans/current` | Yes | Returns the logged-in user's current tier, plan details, and limits |
| `POST /api/plans/upgrade` | Yes | Switches the user's tier (body: `{ tier: "free" | "pro" | "enterprise" }`) |

The upgrade endpoint updates `users.subscriptionTier` via `storage.updateUser()` and logs an audit event (`subscription.upgrade`).

### Frontend

**File:** `client/src/pages/Plans.tsx`

- Header with "Plans & Pricing" title and OSS messaging
- Current plan badge showing the user's active tier
- 3-column plan cards with highlights, pricing, and action buttons
- "Current Plan" (disabled) on the active tier; "Upgrade to Pro" / "Switch to Free" dynamically
- "Free for Open Source" callout card
- Full feature comparison table with check/cross icons and string values

**File:** `client/src/pages/Settings.tsx`

- Replaced the static 3-column tier cards with a compact section showing the user's real `subscriptionTier` and `subscriptionStatus`
- Added a "View Plans & Pricing" button linking to `/plans`

**File:** `client/src/components/AppSidebar.tsx`

- Added "Plans & Pricing" with `CreditCard` icon to the Resources nav group

**File:** `client/src/App.tsx`

- Added route: `<Route path="/plans" component={PlansPage} />`

### Database

No schema changes. Uses the existing `users.subscriptionTier` (`free` | `pro` | `enterprise`) and `users.subscriptionStatus` (`active` | `canceled` | `past_due`) columns.

## Files changed / created

| File | Action |
|---|---|
| `shared/tierConfig.ts` | **Created** — tier definitions |
| `server/routes.ts` | Modified — 3 new API endpoints |
| `client/src/pages/Plans.tsx` | **Created** — Plans & Pricing page |
| `client/src/pages/Settings.tsx` | Modified — wired tier section to real data |
| `client/src/components/AppSidebar.tsx` | Modified — added Plans & Pricing nav item |
| `client/src/App.tsx` | Modified — added `/plans` route |

## Manual testing

1. Log in to Aithon Shield
2. In the sidebar, scroll to the **Resources** section and click **Plans & Pricing**
3. You should see 3 plan cards (Free/OSS, Pro, Enterprise) with your current plan highlighted
4. Click **Upgrade to Pro** — the Pro card should become "Current Plan" and Free should show "Switch to Free / OSS"
5. Go to **Settings** and scroll to **Subscription Tier** — it should show your current plan and a "View Plans & Pricing" button
6. Click "View Plans & Pricing" to navigate back to the Plans page
