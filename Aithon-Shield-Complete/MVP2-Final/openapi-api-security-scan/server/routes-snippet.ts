/**
 * Extracted from server/routes.ts — OpenAPI API security scan job + endpoints.
 * To restore: paste back into routes.ts and re-add imports.
 *
 * Imports needed:
 *   import { analyzeOpenApiApiSecurity, fetchOpenApiSpecText } from "./services/openApiApiSecurityService";
 *   import { insertApiSecurityScanBodySchema, patchApiSecurityScanSchema } from "@shared/schema";
 *   import type { ApiSecurityScan } from "@shared/schema";
 */

// ── Job ──────────────────────────────────────────────────────────────────────

/** P5-C10 — OpenAPI static API security analysis. */
async function runApiSecurityScanJob(scan: ApiSecurityScan): Promise<void> {
  const displayName = scan.apiName;
  await notifyScanStart(storage, scan.userId, scan.id, "api", displayName);
  await storage.updateApiSecurityScan(scan.id, scan.userId, {
    scanStatus: "scanning",
    scanError: null,
  });
  try {
    let specText: string;
    let specSourceLabel: string;
    if (scan.specUrl?.trim()) {
      const fetched = await fetchOpenApiSpecText(scan.specUrl.trim());
      if ("error" in fetched) {
        await storage.updateApiSecurityScan(scan.id, scan.userId, {
          scanStatus: "failed",
          scanError: fetched.error,
        });
        await notifyScanComplete(storage, scan.userId, scan.id, "api", displayName, 0);
        return;
      }
      specText = fetched.text;
      specSourceLabel = scan.specUrl.trim();
    } else if (scan.specBody?.trim()) {
      specText = scan.specBody.trim();
      specSourceLabel = "pasted OpenAPI spec";
    } else {
      await storage.updateApiSecurityScan(scan.id, scan.userId, {
        scanStatus: "failed",
        scanError: "No spec URL or pasted body",
      });
      await notifyScanComplete(storage, scan.userId, scan.id, "api", displayName, 0);
      return;
    }

    const { findings } = analyzeOpenApiApiSecurity({
      specText,
      specSourceLabel,
      baseUrlOverride: scan.baseUrlOverride,
    });
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const f of findings) {
      if (f.severity === "CRITICAL") critical++;
      else if (f.severity === "HIGH") high++;
      else if (f.severity === "MEDIUM") medium++;
      else low++;
      await storage.createFinding({
        userId: scan.userId,
        title: f.title,
        description: f.description,
        severity: f.severity,
        category: f.category,
        asset: displayName,
        cwe: f.cwe,
        detected: new Date().toISOString(),
        status: "open",
        location: f.location,
        remediation: f.remediation,
        aiSuggestion: f.aiSuggestion,
        riskScore: f.riskScore,
        exploitabilityScore: f.exploitabilityScore,
        impactScore: f.impactScore,
        source: "api-security-scan",
        apiSecurityScanId: scan.id,
        scanId: scan.id,
        scanType: "api",
      });
    }
    await storage.updateApiSecurityScan(scan.id, scan.userId, {
      scanStatus: "completed",
      scannedAt: new Date(),
      findingsCount: findings.length,
      criticalCount: critical,
      highCount: high,
      mediumCount: medium,
      lowCount: low,
      scanError: null,
    });
    await notifyScanComplete(storage, scan.userId, scan.id, "api", displayName, findings.length);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "API security scan failed";
    console.error("[api-security-scan]", msg, err);
    await storage.updateApiSecurityScan(scan.id, scan.userId, { scanStatus: "failed", scanError: msg });
    await notifyScanComplete(storage, scan.userId, scan.id, "api", displayName, 0);
  }
}

// ── Endpoints (inside registerRoutes) ────────────────────────────────────────

/*
  app.get("/api/api-security-scans", requireAuth, async (req: any, res) => {
    try {
      const scans = await storage.getAllApiSecurityScans(req.user.id);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/api-security-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const scan = await storage.getApiSecurityScan(req.params.id, req.user.id);
      if (!scan) {
        return res.status(404).json({ message: "API security scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/api-security-scans", requireAuth, async (req, res) => {
    try {
      const validatedData = insertApiSecurityScanBodySchema.parse(req.body);
      const scan = await storage.createApiSecurityScan({
        ...validatedData,
        userId: req.user!.id,
      });
      void runApiSecurityScanJob(scan).catch((e) => console.error("[api-security-scan] job", e));
      res.status(201).json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.patch("/api/api-security-scans/:id", requireAuth, async (req: any, res) => {
    try {
      const validatedData = patchApiSecurityScanSchema.parse(req.body);
      const scan = await storage.updateApiSecurityScan(req.params.id, req.user.id, validatedData);
      if (!scan) {
        return res.status(404).json({ message: "API security scan not found" });
      }
      res.json(scan);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });
*/
