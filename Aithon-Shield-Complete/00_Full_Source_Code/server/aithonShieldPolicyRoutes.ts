import type { Express } from "express";
import { z } from "zod";
import {
  parseAithonShieldYaml,
  evaluatePolicyFailOn,
  type SeverityCounts,
} from "@shared/aithonShieldConfig";
import { logAuditEvent } from "./auditEmitter";

const validateBodySchema = z.object({
  yaml: z.string(),
});

const evaluateBodySchema = z.object({
  yaml: z.string(),
  counts: z.object({
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
});

export function registerAithonShieldPolicyRoutes(
  app: Express,
  deps: { requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { requireAuth } = deps;

  app.post("/api/policy/aithonshield/validate", requireAuth, async (req: any, res) => {
    try {
      const { yaml } = validateBodySchema.parse(req.body);
      const result = parseAithonShieldYaml(yaml);
      if (!result.ok) {
        return res.status(400).json({
          ok: false,
          error: result.error,
          zodIssues: result.zodError?.flatten(),
        });
      }
      void logAuditEvent({
        userId: req.user.id,
        action: "policy.aithonshield_validated",
        resourceType: "aithonshield_yml",
        resourceId: "validate",
        metadata: { hasPolicy: Boolean(result.config.policy) },
        req,
      });
      res.json({
        ok: true,
        config: result.config,
      });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      console.error("[aithonshield/validate]", e);
      return res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/policy/aithonshield/evaluate", requireAuth, async (req: any, res) => {
    try {
      const { yaml, counts } = evaluateBodySchema.parse(req.body);
      const parsed = parseAithonShieldYaml(yaml);
      if (!parsed.ok) {
        return res.status(400).json({
          ok: false,
          error: parsed.error,
          zodIssues: parsed.zodError?.flatten(),
        });
      }
      const failOn = parsed.config.policy?.fail_on;
      const evaluation = evaluatePolicyFailOn(failOn, counts as SeverityCounts);
      void logAuditEvent({
        userId: req.user.id,
        action: "policy.aithonshield_evaluated",
        resourceType: "aithonshield_yml",
        resourceId: "evaluate",
        metadata: { pass: evaluation.pass, counts },
        req,
      });
      res.json({
        ok: true,
        pass: evaluation.pass,
        violations: evaluation.violations,
        failOn: failOn ?? null,
        counts,
      });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      console.error("[aithonshield/evaluate]", e);
      return res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
