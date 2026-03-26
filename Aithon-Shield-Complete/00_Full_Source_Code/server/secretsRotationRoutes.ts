import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import { logAuditEvent } from "./auditEmitter";
import { dispatchWebhookEvent } from "./webhookDispatchService";

const createBodySchema = z.object({
  secretName: z.string().min(1).max(500),
  secretType: z.string().min(1).max(100),
  location: z.string().max(1000).nullable().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  findingId: z.string().nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  secretsManager: z.string().max(100).nullable().optional(),
});

const updateBodySchema = z.object({
  status: z.enum(["open", "in_progress", "rotated", "verified", "dismissed"]).optional(),
  stepRemovedFromCode: z.boolean().optional(),
  stepNewSecretGenerated: z.boolean().optional(),
  stepStoredInManager: z.boolean().optional(),
  stepAppConfigUpdated: z.boolean().optional(),
  stepOldSecretRevoked: z.boolean().optional(),
  stepVerified: z.boolean().optional(),
  notes: z.string().max(8000).nullable().optional(),
  secretsManager: z.string().max(100).nullable().optional(),
});

export function registerSecretsRotationRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireAuth } = deps;

  app.get("/api/secrets-rotation", requireAuth, async (req: any, res) => {
    try {
      const tickets = await storage.listSecretsRotationTickets(req.user.id);
      res.json({ tickets });
    } catch (e: unknown) {
      console.error("[secrets-rotation GET]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/secrets-rotation/:id", requireAuth, async (req: any, res) => {
    try {
      const ticket = await storage.getSecretsRotationTicket(req.params.id, req.user.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      res.json(ticket);
    } catch (e: unknown) {
      console.error("[secrets-rotation GET/:id]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/secrets-rotation", requireAuth, async (req: any, res) => {
    try {
      const body = createBodySchema.parse(req.body);
      const ticket = await storage.createSecretsRotationTicket(req.user.id, body);
      void logAuditEvent({
        userId: req.user.id,
        action: "secrets_rotation.create",
        resourceType: "secrets_rotation_ticket",
        resourceId: ticket.id,
        metadata: { secretName: ticket.secretName, secretType: ticket.secretType },
        req,
      });
      dispatchWebhookEvent(req.user.id, "secrets_rotation.created", {
        ticketId: ticket.id,
        secretName: ticket.secretName,
      });
      res.status(201).json(ticket);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      console.error("[secrets-rotation POST]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.patch("/api/secrets-rotation/:id", requireAuth, async (req: any, res) => {
    try {
      const body = updateBodySchema.parse(req.body);
      const ticket = await storage.updateSecretsRotationTicket(req.params.id, req.user.id, body);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      void logAuditEvent({
        userId: req.user.id,
        action: "secrets_rotation.update",
        resourceType: "secrets_rotation_ticket",
        resourceId: ticket.id,
        metadata: { status: ticket.status },
        req,
      });
      if (body.status === "rotated" || body.status === "verified") {
        dispatchWebhookEvent(req.user.id, `secrets_rotation.${body.status}`, {
          ticketId: ticket.id,
          secretName: ticket.secretName,
        });
      }
      res.json(ticket);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      console.error("[secrets-rotation PATCH]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.delete("/api/secrets-rotation/:id", requireAuth, async (req: any, res) => {
    try {
      const deleted = await storage.deleteSecretsRotationTicket(req.params.id, req.user.id);
      if (!deleted) return res.status(404).json({ message: "Ticket not found" });
      void logAuditEvent({
        userId: req.user.id,
        action: "secrets_rotation.delete",
        resourceType: "secrets_rotation_ticket",
        resourceId: req.params.id,
        req,
      });
      res.json({ ok: true });
    } catch (e: unknown) {
      console.error("[secrets-rotation DELETE]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/secrets-rotation/auto-create", requireAuth, async (req: any, res) => {
    try {
      const result = await storage.autoCreateSecretsRotationTickets(req.user.id);
      void logAuditEvent({
        userId: req.user.id,
        action: "secrets_rotation.auto_create",
        resourceType: "secrets_rotation_ticket",
        metadata: { created: result.created, skipped: result.skipped },
        req,
      });
      res.json(result);
    } catch (e: unknown) {
      console.error("[secrets-rotation auto-create]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
