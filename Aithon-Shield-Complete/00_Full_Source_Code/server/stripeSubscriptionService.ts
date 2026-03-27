import Stripe from "stripe";
import type { TierName } from "@shared/tierConfig";
import type { User } from "@shared/schema";
import type { IStorage } from "./storage";

function getSecretKey(): string | undefined {
  return process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe | null {
  const key = getSecretKey();
  if (!key) return null;
  return new Stripe(key);
}

export function isStripeSubscriptionConfigured(): boolean {
  return Boolean(
    getSecretKey() &&
      process.env.STRIPE_PRICE_STARTER &&
      process.env.STRIPE_PRICE_PRO,
  );
}

export function priceIdForPaidTier(tier: "starter" | "pro"): string | null {
  if (tier === "starter") return process.env.STRIPE_PRICE_STARTER || null;
  if (tier === "pro") return process.env.STRIPE_PRICE_PRO || null;
  return null;
}

export function tierForStripePriceId(priceId: string): TierName | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

export function getPublicBaseUrl(req: { get: (name: string) => string | undefined }): string {
  const env = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.get("host") || "127.0.0.1:5001";
  const xfProto = req.get("x-forwarded-proto");
  const proto = xfProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export async function createSubscriptionCheckoutSession(params: {
  storage: IStorage;
  user: User;
  tier: "starter" | "pro";
  baseUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const priceId = priceIdForPaidTier(params.tier);
  if (!stripe || !priceId) {
    throw new Error("Stripe subscription billing is not configured");
  }

  const successUrl = `${params.baseUrl}/plans?checkout=success`;
  const cancelUrl = `${params.baseUrl}/plans?checkout=canceled`;

  const customerId = params.user.stripeCustomerId ?? undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: params.user.id,
    metadata: {
      userId: params.user.id,
      tier: params.tier,
    },
    subscription_data: {
      metadata: {
        userId: params.user.id,
        tier: params.tier,
      },
    },
    ...(customerId
      ? { customer: customerId }
      : { customer_email: params.user.email }),
  });

  if (!session.url) {
    throw new Error("Stripe Checkout did not return a URL");
  }
  return { url: session.url };
}

export async function createBillingPortalSession(params: {
  user: User;
  baseUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const customerId = params.user.stripeCustomerId;
  if (!stripe || !customerId) {
    throw new Error("No Stripe customer on file. Subscribe via Checkout first.");
  }
  const returnUrl = `${params.baseUrl}/plans`;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

export async function applyStripeSubscriptionEvent(
  storage: IStorage,
  event: Stripe.Event,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId || session.client_reference_id;
      const tierMeta = session.metadata?.tier as TierName | undefined;
      if (!userId || (tierMeta !== "starter" && tierMeta !== "pro")) {
        console.warn("[stripe] checkout.session.completed missing userId/tier metadata");
        return;
      }
      const customer =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;

      await storage.updateUser(userId, {
        subscriptionTier: tierMeta,
        subscriptionStatus: "active",
        stripeCustomerId: customer ?? undefined,
        stripeSubscriptionId: subscriptionId ?? undefined,
        subscriptionExpiresAt: null,
      });
      return;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) return;
      const status = sub.status;
      let subscriptionStatus: User["subscriptionStatus"] = "active";
      if (status === "canceled" || status === "unpaid") subscriptionStatus = "canceled";
      else if (status === "past_due") subscriptionStatus = "past_due";

      const priceId = sub.items.data[0]?.price?.id;
      const tierFromPrice = priceId ? tierForStripePriceId(priceId) : null;
      const tierFromMeta = sub.metadata?.tier as TierName | undefined;
      const nextTier =
        tierFromPrice ||
        (tierFromMeta === "starter" || tierFromMeta === "pro" ? tierFromMeta : null);

      await storage.updateUser(userId, {
        stripeSubscriptionId: sub.id,
        subscriptionStatus,
        ...(nextTier ? { subscriptionTier: nextTier } : {}),
      });
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) return;
      await storage.updateUser(userId, {
        subscriptionTier: "free",
        subscriptionStatus: "canceled",
        stripeSubscriptionId: null,
        subscriptionExpiresAt: null,
      });
      return;
    }
    default:
      return;
  }
}


/**
 * Poll Stripe for the user's most recent completed checkout session and apply
 * the subscription to the local DB. This covers the gap when webhooks are not
 * configured or arrive late.
 */
export async function syncStripeSubscriptionForUser(
  storage: IStorage,
  user: User,
): Promise<{ synced: boolean; tier?: TierName }> {
  const stripe = getStripe();
  if (!stripe) return { synced: false };

  const email = user.email?.trim().toLowerCase();
  if (!email) return { synced: false };

  // If we already have a stripeCustomerId, look up the subscription directly
  if (user.stripeCustomerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
        expand: ["data.items.data.price"],
      });
      const sub = subs.data[0];
      if (sub) {
        const priceId = sub.items.data[0]?.price?.id;
        const tier = priceId ? tierForStripePriceId(priceId) : null;
        const tierMeta = sub.metadata?.tier as TierName | undefined;
        const resolvedTier =
          tier || (tierMeta === "starter" || tierMeta === "pro" ? tierMeta : null);
        if (resolvedTier) {
          await storage.updateUser(user.id, {
            subscriptionTier: resolvedTier,
            subscriptionStatus: "active",
            stripeSubscriptionId: sub.id,
            subscriptionExpiresAt: null,
          });
          return { synced: true, tier: resolvedTier };
        }
      }
    } catch (e) {
      console.error("[stripe sync] subscription lookup failed", e);
    }
  }

  // Fallback: search recent checkout sessions by client_reference_id
  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 5,
    });
    for (const session of sessions.data) {
      if (
        session.client_reference_id === user.id &&
        session.payment_status === "paid" &&
        session.status === "complete"
      ) {
        const tierMeta = session.metadata?.tier as TierName | undefined;
        if (tierMeta !== "starter" && tierMeta !== "pro") continue;
        const customer =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as any)?.id ?? null;

        await storage.updateUser(user.id, {
          subscriptionTier: tierMeta,
          subscriptionStatus: "active",
          stripeCustomerId: customer ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          subscriptionExpiresAt: null,
        });
        return { synced: true, tier: tierMeta };
      }
    }
  } catch (e) {
    console.error("[stripe sync] checkout session search failed", e);
  }

  return { synced: false };
}
