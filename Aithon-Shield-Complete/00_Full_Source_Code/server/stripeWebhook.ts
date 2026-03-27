import type { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage";
import { getStripe, applyStripeSubscriptionEvent } from "./stripeSubscriptionService";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    res.status(503).json({ message: "Stripe webhooks are not configured (STRIPE_WEBHOOK_SECRET)" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ message: "Missing Stripe-Signature header" });
    return;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ message: "Expected raw body for webhook" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ message: `Webhook signature verification failed: ${msg}` });
    return;
  }

  try {
    await applyStripeSubscriptionEvent(storage, event);
    res.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe webhook]", msg, e);
    const safe = process.env.NODE_ENV === "production" ? "Webhook handler failed" : msg;
    res.status(500).json({ message: safe });
  }
}
