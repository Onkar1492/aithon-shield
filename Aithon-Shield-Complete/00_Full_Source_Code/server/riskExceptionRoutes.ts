import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import { logAuditEvent } from "./auditEmitter";
import { dispatchWebhookEvent } from "./webhookDispatchService";

const createBodySchema = z.object({
  findingId: z.string().min(1),
  justification: z.string().min(1).max(8000),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
});

const revokeByFindingBodySchema = z.object({
  findingId: z.string().min(1),
});

export function registerRiskExceptionRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireAuth } = deps;

  app.get("/api/risk-exceptions", requireAuth, async (req: any, res) => {
    try {
      const rows = await storage.listRiskExceptionsForUser(req.user.id);
      res.json({ exceptions: rows });
    } catch (e: unknown) {
      console.error("[risk-exceptions GET]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/risk-exceptions", requireAuth, async (req: any, res) => {
    try {
      const body = createBodySchema.parse(req.body);
      const expiresAt = body.expiresAt == null ? null : new Date(body.expiresAt);
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ message: "Invalid expiresAt" });
      }
      const row = await storage.createRiskException(req.user.id, {
        findingId: body.findingId,
        justification: body.justification,
        expiresAt,
      });
      void logAuditEvent({
        userId: req.user.id,
        action: "risk_exception.create",
        resourceType: "risk_exception",
        resourceId: row.id,
        metadata: { findingId: row.findingId },
        req,
      });
      dispatchWebhookEvent(req.user.id, "risk.accepted", { exceptionId: row.id, findingId: row.findingId, justification: row.justification });
      res.status(201).json(row);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "RISK_EXCEPTION_FINDING_NOT_FOUND") {
        return res.status(404).json({ message: "Finding not found" });
      }
      if (msg === "RISK_EXCEPTION_FINDING_ARCHIVED" || msg === "RISK_EXCEPTION_FINDING_RESOLVED") {
        return res.status(400).json({ message: "Finding cannot accept risk in its current state" });
      }
      if (msg === "RISK_EXCEPTION_ALREADY_ACTIVE") {
        return res.status(409).json({ message: "An active risk exception already exists for this finding" });
      }
      if (msg === "RISK_EXCEPTION_JUSTIFICATION_REQUIRED") {
        return res.status(400).json({ message: "Justification is required" });
      }
      console.error("[risk-exceptions POST]", e);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/risk-exceptions/revoke-by-finding", requireAuth, async (req: any, res) => {
    try {
      const body = revokeByFindingBodySchema.parse(req.body);
      const row = await storage.revokeActiveRiskExceptionForFinding(req.user.id, body.findingId);
      if (!row) {
        return res.status(404).json({ message: "No active exception for this finding" });
      }
      void logAuditEvent({
        userId: req.user.id,
        action: "risk_exception.revoke",
        resourceType: "risk_exception",
        resourceId: row.id,
        metadata: { findingId: row.findingId, via: "finding" },
        req,
      });
      dispatchWebhookEvent(req.user.id, "risk.revoked", { exceptionId: row.id, findingId: row.findingId });
      res.json(row);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      console.error("[risk-exceptions revoke-by-finding]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/risk-exceptions/:id/revoke", requireAuth, async (req: any, res) => {
    try {
      const row = await storage.revokeRiskException(req.params.id, req.user.id);
      if (!row) {
        return res.status(404).json({ message: "Active exception not found" });
      }
      void logAuditEvent({
        userId: req.user.id,
        action: "risk_exception.revoke",
        resourceType: "risk_exception",
        resourceId: row.id,
        metadata: { findingId: row.findingId },
        req,
      });
      dispatchWebhookEvent(req.user.id, "risk.revoked", { exceptionId: row.id, findingId: row.findingId });
      res.json(row);
    } catch (e: unknown) {
      console.error("[risk-exceptions revoke]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
