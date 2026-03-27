# Pre-launch Feature 1 — Consumer tiers (Free / Starter / Pro) + MVP2-Final archive

## Plain-language summary

The app is now positioned for **individual developers and small teams**, not enterprise IT buyers. The pricing page shows **three plans**: Free, Starter ($19.99/seat/month), and Pro ($49.99/seat/month). Features that belonged to the old “Enterprise” product (SSO, compliance ZIP exports, webhooks to SIEM, self-hosted status card, attack path / audit / compliance pages in the nav) are **removed from the live UI and main API surface** where noted; reference material is consolidated under **MVP2-Final** for a future enterprise release.

## Cat 1 — UI (what you see)

- **Plans (`/plans`)**: Three columns — Free, Starter, Pro — with updated copy and comparison table (Free / Starter / Pro).
- **Sidebar**: “Attack path graph”, “Compliance”, and “Audit Log” links removed.
- **Settings**: “Webhooks & SIEM”, “SSO configuration”, and “Self-hosted deployment” sections removed.
- **Login**: Enterprise SSO buttons section removed.

## Cat 2 — Backend (what changed under the hood)

- **`shared/tierConfig.ts`**: New tier model `free | starter | pro`; feature matrix and `TIER_LIMITS` updated (`hasStarterFeatures`, `hasProFeatures` replace enterprise flags).
- **`server/routes.ts`**: Removed routes for self-hosted status, compliance evidence ZIP, VEX JSON, webhooks, and all SAML/OIDC SSO provider flows; `/api/plans/upgrade` accepts `free`, `starter`, `pro`; `normalizeSubscriptionTier()` maps legacy DB value `enterprise` → `pro` for `/api/plans/current` and `/api/auth/me`.
- **`server/validation-service.ts`**: Tier union updated to `free | starter | pro`; only non-free tiers get full validation list (same as before for paid Pro).
- **`MVP2-Final/`** (parent folder): Copy of prior `MVP2` assets + `README.md` describing what to restore for enterprise later.

## Testing performed

- `npm run check` (TypeScript) — **passed** after changes.

## How to validate (no terminal)

1. Start the app the way you usually do in Cursor (or ask the agent to run `npm run dev` with approval).
2. Open **Plans & Pricing** (`/plans`). Confirm you see **three** plans: Free, Starter, Pro — with prices **$0**, **$19.99**, **$49.99** (no “Enterprise” column).
3. Click **Upgrade to Starter** or **Upgrade to Pro** on a test account; confirm the toast says the plan updated and the badge shows the new plan name.
4. Open the **sidebar** and confirm there is **no** link to Attack path, Compliance, or Audit Log.
5. Open **Settings** and confirm there are **no** cards for Webhooks, SSO, or Self-hosted deployment.
6. Open **Login** and confirm there is **no** SSO provider section.
7. (Optional) Open `MVP2-Final/README.md` in the repo parent folder and confirm it lists archived enterprise areas.

