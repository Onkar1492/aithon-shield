import type { Express } from "express";
import type { IStorage } from "./storage";
import { buildCycloneDxVexFromFindings } from "./services/vexGenerator";
import { logAuditEvent } from "./auditEmitter";

export function registerVexRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireAuth } = deps;

  app.get("/api/vex/document", requireAuth, async (req: any, res) => {
    try {
      const findings = await storage.getAllFindings(req.user.id, false);
      const doc = buildCycloneDxVexFromFindings(findings, { scope: "workspace" });
      const filename = `aithon-vex-workspace-${Date.now()}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      void logAuditEvent({
        userId: req.user.id,
        action: "vex.workspace_export",
        resourceType: "vex",
        resourceId: null,
        metadata: {
          entries: Array.isArray(doc.vulnerabilities) ? (doc.vulnerabilities as unknown[]).length : 0,
        },
        req,
      });
      res.json(doc);
    } catch (e: unknown) {
      console.error("[vex/document]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/mvp-scans/:id/vex", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }
      const findings = await storage.getFindingsByScan(req.params.id, req.user.id, "mvp");
      const doc = buildCycloneDxVexFromFindings(findings, {
        scope: "mvp_scan",
        scanId: scan.id,
        projectHint: scan.repositoryUrl ?? scan.projectName ?? null,
      });
      const filename = `aithon-vex-mvp-${scan.id}-${Date.now()}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      void logAuditEvent({
        userId: req.user.id,
        action: "vex.mvp_scan_export",
        resourceType: "vex",
        resourceId: scan.id,
        metadata: {
          entries: Array.isArray(doc.vulnerabilities) ? (doc.vulnerabilities as unknown[]).length : 0,
        },
        req,
      });
      res.json(doc);
    } catch (e: unknown) {
      console.error("[mvp-scans vex]", e);
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  });
}
