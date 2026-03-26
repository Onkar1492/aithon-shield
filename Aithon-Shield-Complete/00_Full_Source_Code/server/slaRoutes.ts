import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import {
  evaluateSlaForFindings,
  slaHoursBySeveritySchema,
  type SlaHoursBySeverity,
} from "@shared/slaPolicy";
import { logAuditEvent } from "./auditEmitter";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

function normalizeStoredPolicy(raw: unknown): SlaHoursBySeverity | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: SlaHoursBySeverity = {};
  for (const k of SEVERITIES) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function mergeSlaPatch(
  prev: Record<string, unknown> | null | undefined,
  patch: z.infer<typeof slaHoursBySeveritySchema>,
): Record<string, number> | null {
  const base = { ...(prev && typeof prev === "object" ? prev : {}) } as Record<string, number>;
  for (const k of SEVERITIES) {
    if (patch[k] === undefined) continue;
    if (patch[k] === null) {
      delete base[k];
    } else {
      base[k] = patch[k] as number;
    }
  }
  const cleaned: Record<string, number> = {};
  for (const k of SEVERITIES) {
    if (typeof base[k] === "number" && base[k] > 0) cleaned[k] = base[k];
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

export function registerSlaRoutes(
  app: Express,
  deps: {
    storage: IStorage;
    requireAuth: (req: any, res: any, next: any) => void;
    requireSessionAuth: (req: any, res: any, next: any) => void;
  },
): void {
  const { storage, requireAuth, requireSessionAuth } = deps;

  app.get("/api/sla/summary", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const policy = normalizeStoredPolicy(user?.slaPolicyHours ?? null);
      const findings = await storage.getAllFindings(req.user.id, false);
      const { breaches, upcoming } = evaluateSlaForFindings(findings, policy);
      res.json({
        policyHours: policy ?? {},
        breaches,
        upcoming,
        openFindingsConsidered: findings.filter((f) => !f.isArchived).length,
      });
    } catch (e: unknown) {
      console.error("[sla/summary]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.patch("/api/user/sla-policy", requireSessionAuth, async (req: any, res) => {
    try {
      const parsed = slaHoursBySeveritySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid body", issues: parsed.error.flatten() });
      }
      const existing = await storage.getUser(req.user.id);
      if (!existing) return res.status(404).json({ message: "User not found" });
      const nextJson = mergeSlaPatch(
        existing.slaPolicyHours as Record<string, unknown> | null | undefined,
        parsed.data,
      );
      const user = await storage.updateUser(req.user.id, { slaPolicyHours: nextJson });
      if (!user) return res.status(404).json({ message: "User not found" });
      void logAuditEvent({
        userId: req.user.id,
        action: "user.sla_policy_update",
        resourceType: "user",
        resourceId: req.user.id,
        metadata: { keys: nextJson ? Object.keys(nextJson) : [] },
        req,
      });
      const { password: _, ...safe } = user;
      res.json({ user: safe });
    } catch (e: unknown) {
      console.error("[user/sla-policy]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
