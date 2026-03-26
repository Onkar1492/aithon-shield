import type { Express } from "express";
import archiver from "archiver";
import type { IStorage } from "./storage";
import { evaluateSlaForFindings, type SlaHoursBySeverity } from "@shared/slaPolicy";
import { logAuditEvent } from "./auditEmitter";
import type { Finding } from "@shared/schema";

const SLA_SEVERITIES = ["critical", "high", "medium", "low"] as const;

function normalizeStoredPolicy(raw: unknown): SlaHoursBySeverity | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: SlaHoursBySeverity = {};
  for (const k of SLA_SEVERITIES) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function serializeFinding(f: Finding): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

function findingsToCsv(findings: Finding[]): string {
  const headers = [
    "id",
    "title",
    "severity",
    "status",
    "category",
    "cwe",
    "asset",
    "scanType",
    "scanId",
    "riskScore",
    "isArchived",
    "fixesApplied",
    "detected",
    "createdAt",
  ];
  const esc = (s: string | number | boolean | null | undefined) => {
    if (s == null) return "";
    const t = String(s).replace(/"/g, '""');
    return `"${t}"`;
  };
  const lines = [headers.join(",")];
  for (const f of findings) {
    lines.push(
      [
        esc(f.id),
        esc(f.title),
        esc(f.severity),
        esc(f.status),
        esc(f.category),
        esc(f.cwe),
        esc(f.asset),
        esc(f.scanType),
        esc(f.scanId),
        esc(f.riskScore),
        esc(f.isArchived),
        esc(f.fixesApplied),
        esc(f.detected),
        esc(f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt)),
      ].join(","),
    );
  }
  return lines.join("\n");
}

const README = `Aithon Shield — compliance evidence package
============================================

This ZIP was generated from your workspace. It is intended for auditors and internal
governance: it contains security findings, recent audit events, SLA evaluation output,
and active risk exceptions (if any).

Contents
--------
- manifest.json       — generation metadata and counts
- README.txt          — this file
- findings.json       — non-archived and archived findings (full JSON)
- findings-summary.csv— tabular summary for spreadsheets
- audit-events.json   — up to 1000 most recent audit log entries
- sla-summary.json    — policy hours and breach / upcoming lists (if policy configured)
- risk-exceptions.json — risk acceptance records with finding titles

Framework mapping (OWASP, NIST, SOC 2, etc.) remains in the Compliance page in the app;
this package focuses on verifiable operational data from scans and platform activity.

Do not share outside your organization without redacting sensitive fields.
`;

export function registerComplianceEvidenceRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireAuth } = deps;

  app.get("/api/compliance/evidence-package", requireAuth, async (req: any, res) => {
    const userId = req.user.id;
    try {
      const [user, findings, auditRows, exceptions] = await Promise.all([
        storage.getUser(userId),
        storage.getAllFindings(userId, true),
        storage.listAuditEvents(userId, { limit: 1000, offset: 0 }),
        storage.listRiskExceptionsForUser(userId),
      ]);

      const policy = normalizeStoredPolicy(user?.slaPolicyHours ?? null);
      const openForSla = await storage.getAllFindings(userId, false);
      const { breaches, upcoming } = evaluateSlaForFindings(openForSla, policy);

      const manifest = {
        product: "Aithon Shield",
        packageType: "compliance_evidence_v1",
        generatedAt: new Date().toISOString(),
        userId,
        counts: {
          findingsTotal: findings.length,
          findingsNonArchived: findings.filter((f) => !f.isArchived).length,
          auditEvents: auditRows.length,
          riskExceptions: exceptions.length,
          slaBreaches: breaches.length,
          slaUpcoming: upcoming.length,
        },
      };

      const findingsSerialized = findings.map(serializeFinding);
      const auditSerialized = auditRows.map((e) => ({
        id: e.id,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        metadata: e.metadata,
      }));

      const slaSummary = {
        policyHours: policy ?? {},
        breaches,
        upcoming,
        openFindingsConsidered: openForSla.filter((f) => !f.isArchived).length,
      };

      const exceptionsSerialized = exceptions.map((x) => ({
        id: x.id,
        findingId: x.findingId,
        findingTitle: x.findingTitle,
        findingSeverity: x.findingSeverity,
        justification: x.justification,
        expiresAt: x.expiresAt instanceof Date ? x.expiresAt.toISOString() : x.expiresAt,
        status: x.status,
        revokedAt: x.revokedAt instanceof Date ? x.revokedAt.toISOString() : x.revokedAt,
        createdAt: x.createdAt instanceof Date ? x.createdAt.toISOString() : x.createdAt,
      }));

      const archive = archiver("zip", { zlib: { level: 9 } });
      const safeUser = user?.email?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "user";
      const filename = `aithon-compliance-evidence_${safeUser}_${Date.now()}.zip`;

      archive.on("error", (err: Error) => {
        if (!res.headersSent) {
          res.status(500).json({ message: err.message ?? "Archive failed" });
        } else {
          res.destroy(err);
        }
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      archive.pipe(res);

      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
      archive.append(README, { name: "README.txt" });
      archive.append(JSON.stringify(findingsSerialized, null, 2), { name: "findings.json" });
      archive.append(findingsToCsv(findings), { name: "findings-summary.csv" });
      archive.append(JSON.stringify(auditSerialized, null, 2), { name: "audit-events.json" });
      archive.append(JSON.stringify(slaSummary, null, 2), { name: "sla-summary.json" });
      archive.append(JSON.stringify(exceptionsSerialized, null, 2), { name: "risk-exceptions.json" });

      void logAuditEvent({
        userId,
        action: "compliance.evidence_package_download",
        resourceType: "compliance",
        resourceId: null,
        metadata: {
          findingsCount: findings.length,
          auditCount: auditRows.length,
        },
        req,
      });

      await archive.finalize();
    } catch (e: unknown) {
      console.error("[compliance/evidence-package]", e);
      if (!res.headersSent) {
        res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
      }
    }
  });
}
