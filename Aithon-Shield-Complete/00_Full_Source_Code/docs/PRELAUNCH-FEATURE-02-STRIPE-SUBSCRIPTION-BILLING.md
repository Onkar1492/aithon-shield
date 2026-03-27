# Pre-launch Feature 2 — Stripe subscription billing

## Plain-language summary

Paid plans (**Starter** and **Pro**) can be purchased with **Stripe Checkout** when Stripe environment variables are set. After checkout, webhooks keep subscription state in sync. Users can open the **Stripe Customer Portal** to manage billing. If Stripe is **not** configured, the Plans page still supports the existing **demo upgrade** path so you can test tiers without payments.

## Cat 1 — UI (what you see)

- **Plans (`/plans`)**: Upgrade buttons start Stripe Checkout when billing is enabled; otherwise they use the demo upgrade API.
- **Manage subscription**: When the account has a Stripe customer and a paid tier, a control appears to open the billing portal (when Stripe is configured).
- **Return messages**: After Checkout, `?checkout=success` or `?checkout=canceled` shows a short confirmation or cancel note.

## Cat 2 — Backend (what runs on the server)

- **`server/stripeSubscriptionService.ts`**: Creates Checkout and Portal sessions; applies webhook subscription events to the user record (`stripeCustomerId`, `stripeSubscriptionId`, tier, status).
- **`server/stripeWebhook.ts`**: Verifies `Stripe-Signature` on raw JSON bodies.
- **`server/index.ts`**: Registers `POST /api/webhooks/stripe` **before** `express.json()` with `express.raw({ type: "application/json" })`.
- **`server/routes.ts`**: `GET /api/billing/status`, `POST /api/billing/checkout-session`, `POST /api/billing/portal-session` (session-authenticated where applicable).

## Testing performed

- `npm run check` (TypeScript) — **passed** after billing and Plans wiring.
- Manual Stripe flows require Stripe keys and a configured webhook endpoint (documented via `.env.example` / deployment notes).

## How to validate (no terminal)

1. Open **Plans** (`/plans`) with **no** Stripe keys: confirm upgrades still work via the **demo** path and no server errors in the UI.
2. Configure Stripe test keys and price IDs in the server environment, restart the app, open **Plans**, and run a **test card** checkout in Stripe’s test mode.
3. Confirm the account shows the expected tier after successful payment and that **Manage subscription** opens the portal when offered.
4. In Stripe’s dashboard, trigger or replay webhook events and confirm the user’s tier/status updates accordingly.

