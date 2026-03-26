import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import { encrypt } from "./encryption";
import { testFireWebhook } from "./webhookDispatchService";
import { logAuditEvent } from "./auditEmitter";

const VALID_FORMATS = ["json", "cef", "syslog"] as const;

const KNOWN_EVENT_TYPES = [
  "scan.completed",
  "finding.created",
  "finding.resolved",
  "sla.breached",
  "risk.accepted",
  "risk.revoked",
  "test.ping",
];

const createEndpointSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  format: z.enum(VALID_FORMATS).default("json"),
  secret: z.string().max(256).optional(),
  eventFilter: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

const updateEndpointSchema = createEndpointSchema.partial();

export function registerWebhookRoutes(
  app: Express,
  deps: { storage: IStorage; requireSessionAuth: RequestHandler },
): void {
  const { storage, requireSessionAuth } = deps;

  /** List all webhook endpoints for the logged-in user. */
  app.get("/api/webhook-endpoints", requireSessionAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const endpoints = await storage.listWebhookEndpoints(userId);
      const safe = endpoints.map(({ secretEnc, ...rest }) => ({
        ...rest,
        hasSecret: !!secretEnc,
      }));
      res.json(safe);
    } catch (e) {
      console.error("[webhookRoutes] GET /api/webhook-endpoints error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /** Create a new webhook endpoint. */
  app.post("/api/webhook-endpoints", requireSessionAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsed = createEndpointSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });

      const { secret, ...rest } = parsed.data;
      const secretEnc = secret ? encrypt(secret) : null;

      const ep = await storage.createWebhookEndpoint({ userId, ...rest, secretEnc });

      await logAuditEvent({ userId, action: "webhook_endpoint.created", resourceType: "webhook_endpoint", resourceId: ep.id, req });

      const { secretEnc: _s, ...safe } = ep;
      res.status(201).json({ ...safe, hasSecret: !!_s });
    } catch (e) {
      console.error("[webhookRoutes] POST /api/webhook-endpoints error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /** Update an existing webhook endpoint. */
  app.patch("/api/webhook-endpoints/:id", requireSessionAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsed = updateEndpointSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten().fieldErrors });

      const { secret, ...rest } = parsed.data;
      const updates: Record<string, unknown> = { ...rest };
      if (secret !== undefined) {
        updates.secretEnc = secret ? encrypt(secret) : null;
      }

      const ep = await storage.updateWebhookEndpoint(req.params.id, userId, updates as any);
      if (!ep) return res.status(404).json({ message: "Webhook endpoint not found" });

      await logAuditEvent({ userId, action: "webhook_endpoint.updated", resourceType: "webhook_endpoint", resourceId: ep.id, req });

      const { secretEnc: _s, ...safe } = ep;
      res.json({ ...safe, hasSecret: !!_s });
    } catch (e) {
      console.error("[webhookRoutes] PATCH /api/webhook-endpoints/:id error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /** Delete a webhook endpoint. */
  app.delete("/api/webhook-endpoints/:id", requireSessionAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const deleted = await storage.deleteWebhookEndpoint(req.params.id, userId);
      if (!deleted) return res.status(404).json({ message: "Webhook endpoint not found" });

      await logAuditEvent({ userId, action: "webhook_endpoint.deleted", resourceType: "webhook_endpoint", resourceId: req.params.id, req });

      res.json({ deleted: true });
    } catch (e) {
      console.error("[webhookRoutes] DELETE /api/webhook-endpoints/:id error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /** Test-fire a ping to a specific endpoint. */
  app.post("/api/webhook-endpoints/:id/test", requireSessionAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const ep = await storage.getWebhookEndpoint(req.params.id, userId);
      if (!ep) return res.status(404).json({ message: "Webhook endpoint not found" });

      const result = await testFireWebhook(ep);
      res.json(result);
    } catch (e) {
      console.error("[webhookRoutes] POST /api/webhook-endpoints/:id/test error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /** List known event types (for UI dropdowns). */
  app.get("/api/webhook-event-types", requireSessionAuth, (_req, res) => {
    res.json(KNOWN_EVENT_TYPES);
  });
}
