import crypto from "crypto";
import { storage } from "./storage";
import { decrypt } from "./encryption";
import type { WebhookEndpoint } from "@shared/schema";

// ── Event types ──────────────────────────────────────────────────────

export type WebhookEventType =
  | "scan.completed"
  | "finding.created"
  | "finding.resolved"
  | "sla.breached"
  | "risk.accepted"
  | "risk.revoked"
  | "secrets_rotation.created"
  | "secrets_rotation.rotated"
  | "secrets_rotation.verified"
  | "test.ping";

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

// ── Formatters ───────────────────────────────────────────────────────

function formatJson(payload: WebhookPayload): { body: string; contentType: string } {
  return { body: JSON.stringify(payload), contentType: "application/json" };
}

/**
 * Common Event Format (CEF) — ArcSight / Splunk / QRadar.
 * CEF:0|Aithon Shield|Security Platform|1.0|<event>|<event>|<severity>|<kv pairs>
 */
function formatCef(payload: WebhookPayload): { body: string; contentType: string } {
  const sev = mapSeverityToCef(payload.data.severity as string | undefined);
  const kvPairs = Object.entries(payload.data)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${cefKey(k)}=${cefVal(v)}`)
    .join(" ");
  const line = `CEF:0|Aithon Shield|Security Platform|1.0|${payload.event}|${payload.event}|${sev}|${kvPairs} eventId=${payload.id} rt=${new Date(payload.timestamp).getTime()}`;
  return { body: line, contentType: "text/plain" };
}

function cefKey(k: string): string {
  return k.replace(/[^a-zA-Z0-9]/g, "");
}

function cefVal(v: unknown): string {
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/=/g, "\\=").replace(/\n/g, "\\n");
}

function mapSeverityToCef(severity: string | undefined): number {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return 10;
    case "high": return 8;
    case "medium": return 5;
    case "low": return 3;
    default: return 1;
  }
}

/**
 * RFC 5424 syslog message (sent over HTTPS POST, not UDP).
 * <priority>1 timestamp hostname app-name procid msgid structured-data msg
 */
function formatSyslog(payload: WebhookPayload): { body: string; contentType: string } {
  const facility = 4; // security/authorization
  const sev = mapSeverityToSyslog(payload.data.severity as string | undefined);
  const pri = facility * 8 + sev;
  const ts = payload.timestamp;
  const hostname = "aithon-shield";
  const appName = "aithon-shield";
  const procid = "-";
  const msgid = payload.event;
  const sd = `[aithon@0 eventId="${payload.id}"]`;
  const msg = JSON.stringify(payload.data);
  const line = `<${pri}>1 ${ts} ${hostname} ${appName} ${procid} ${msgid} ${sd} ${msg}`;
  return { body: line, contentType: "text/plain" };
}

function mapSeverityToSyslog(severity: string | undefined): number {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return 2; // critical
    case "high": return 3; // error
    case "medium": return 4; // warning
    case "low": return 6; // informational
    default: return 6;
  }
}

function formatPayload(endpoint: WebhookEndpoint, payload: WebhookPayload): { body: string; contentType: string } {
  switch (endpoint.format) {
    case "cef": return formatCef(payload);
    case "syslog": return formatSyslog(payload);
    default: return formatJson(payload);
  }
}

// ── HMAC signing ─────────────────────────────────────────────────────

function signPayload(body: string, secretEnc: string | null): string | null {
  if (!secretEnc) return null;
  const secret = decrypt(secretEnc);
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// ── Delivery ─────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 5000, 15000];

async function deliverToEndpoint(endpoint: WebhookEndpoint, payload: WebhookPayload): Promise<void> {
  const { body, contentType } = formatPayload(endpoint, payload);
  const signature = signPayload(body, endpoint.secretEnc);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "User-Agent": "AithonShield-Webhook/1.0",
        "X-AithonShield-Event": payload.event,
        "X-AithonShield-Delivery": payload.id,
      };
      if (signature) {
        headers["X-AithonShield-Signature-256"] = `sha256=${signature}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(endpoint.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const statusText = `${res.status} ${res.statusText}`;

      await storage.insertWebhookDelivery({
        endpointId: endpoint.id,
        eventType: payload.event,
        httpStatus: res.status,
        attempt,
      });

      if (res.ok) {
        await storage.touchWebhookDelivery(endpoint.id, statusText);
        return;
      }

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 15000);
        continue;
      }

      await storage.touchWebhookDelivery(endpoint.id, `FAIL ${statusText}`);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await storage.insertWebhookDelivery({
        endpointId: endpoint.id,
        eventType: payload.event,
        errorMessage: msg,
        attempt,
      });

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 15000);
        continue;
      }

      await storage.touchWebhookDelivery(endpoint.id, `ERROR ${msg.slice(0, 200)}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fire-and-forget: dispatch an event to all matching webhook endpoints for a user.
 * Never throws — errors are logged and recorded in webhook_deliveries.
 */
export function dispatchWebhookEvent(
  userId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
): void {
  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  storage
    .getWebhookEndpointsForEvent(userId, event)
    .then((endpoints) => {
      for (const ep of endpoints) {
        deliverToEndpoint(ep, payload).catch((e) =>
          console.error(`[webhook] delivery failed for endpoint ${ep.id}:`, e),
        );
      }
    })
    .catch((e) => console.error("[webhook] getWebhookEndpointsForEvent failed:", e));
}

/**
 * Test-fire a single endpoint with a ping event. Returns the HTTP status or error.
 */
export async function testFireWebhook(endpoint: WebhookEndpoint): Promise<{ ok: boolean; status: string }> {
  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event: "test.ping",
    timestamp: new Date().toISOString(),
    data: { message: "Aithon Shield webhook test ping" },
  };

  const { body, contentType } = formatPayload(endpoint, payload);
  const signature = signPayload(body, endpoint.secretEnc);

  try {
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "User-Agent": "AithonShield-Webhook/1.0",
      "X-AithonShield-Event": "test.ping",
      "X-AithonShield-Delivery": payload.id,
    };
    if (signature) {
      headers["X-AithonShield-Signature-256"] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const statusText = `${res.status} ${res.statusText}`;
    await storage.touchWebhookDelivery(endpoint.id, res.ok ? statusText : `FAIL ${statusText}`);
    await storage.insertWebhookDelivery({ endpointId: endpoint.id, eventType: "test.ping", httpStatus: res.status });
    return { ok: res.ok, status: statusText };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await storage.touchWebhookDelivery(endpoint.id, `ERROR ${msg.slice(0, 200)}`);
    await storage.insertWebhookDelivery({ endpointId: endpoint.id, eventType: "test.ping", errorMessage: msg });
    return { ok: false, status: msg };
  }
}
