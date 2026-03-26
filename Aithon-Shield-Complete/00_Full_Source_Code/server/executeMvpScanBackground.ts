import type { MvpCodeScan } from "@shared/schema";
import { storage } from "./storage";
import { scanMvpCode } from "./services/mvpScanService";
import { notifyScanStart, notifyScanComplete } from "./pushNotificationService";
import { handleScanError, formatErrorForLogging } from "./services/errors";
import { resolvedSecurityModules } from "./scanModuleUtils";
import { logAuditEvent } from "./auditEmitter";
import type { ScanResult } from "./services/types";

export type MvpScanBackgroundOpts = {
  scan: MvpCodeScan;
  userId: string;
  scanId: string;
  req?: { protocol?: string; get?: (name: string) => string | undefined };
  /** When not using HTTP `req` (scheduler), e.g. http://127.0.0.1:5001 */
  previewBaseUrl?: string;
  onCompleted?: (result: ScanResult) => Promise<void>;
};

function buildPreviewUrl(scanId: string, opts: MvpScanBackgroundOpts): string {
  const { req, previewBaseUrl } = opts;
  if (req?.get && req.protocol) {
    return `${req.protocol}://${req.get("host")}/preview/${scanId}`;
  }
  const base = previewBaseUrl ?? `http://127.0.0.1:${process.env.PORT || "5001"}`;
  return `${base.replace(/\/$/, "")}/preview/${scanId}`;
}

/**
 * Continues an MVP scan after the route (or scheduler) has set status to `scanning`.
 * Fire-and-forget: returns immediately after chaining the async scan work.
 */
export function startMvpScanBackground(opts: MvpScanBackgroundOpts): void {
  const { scan, userId, scanId, req, onCompleted } = opts;

  void notifyScanStart(storage, scan.userId, scan.id, "mvp", scan.projectName || "MVP Code Scan");

  const progressCallback = async (progress: number, stage: string) => {
    const currentScan = await storage.getMvpCodeScan(scanId, userId);
    if (currentScan?.cancellationRequested) {
      throw new Error("Scan cancellation requested by user");
    }
    await storage.updateMvpCodeScan(scanId, userId, {
      scanProgress: progress,
      scanStage: stage,
    });
  };

  const meta = scan.workflowMetadata as Record<string, unknown> | null | undefined;
  const securityModules = resolvedSecurityModules(meta, ["SAST", "SCA", "IaC", "Secrets"]);
  const hint = typeof meta?.techStackHint === "string" ? meta.techStackHint.toLowerCase() : "";
  let detectedLanguage: string;
  if (hint.includes("python")) detectedLanguage = "python";
  else if (hint.includes("java") && !hint.includes("javascript")) detectedLanguage = "java";
  else if (hint.includes("go") || hint.includes("golang")) detectedLanguage = "go";
  else if (hint.includes("rust")) detectedLanguage = "rust";
  else if (hint.includes("ruby")) detectedLanguage = "ruby";
  else if (hint.includes("php")) detectedLanguage = "php";
  else if (scan.repositoryUrl.includes(".js") || scan.repositoryUrl.includes("javascript"))
    detectedLanguage = "javascript";
  else if (scan.repositoryUrl.includes(".py") || scan.repositoryUrl.includes("python"))
    detectedLanguage = "python";
  else detectedLanguage = "typescript";

  scanMvpCode(
    scan.repositoryUrl,
    {
      language: detectedLanguage,
      framework: undefined,
      environment: undefined,
      userId,
      scanId: scan.id,
      securityModules,
      projectName: scan.projectName,
      repositoryUrl: scan.repositoryUrl,
    },
    progressCallback
  )
    .then(async (result) => {
      for (const vulnerability of result.vulnerabilities) {
        await storage.createFinding({
          userId: scan.userId,
          title: vulnerability.title,
          description: vulnerability.description,
          severity: vulnerability.severity,
          category: vulnerability.category,
          asset: "Source Code",
          cwe: vulnerability.cwe,
          detected: new Date().toISOString(),
          status: "open",
          location: vulnerability.location,
          remediation: vulnerability.remediation,
          aiSuggestion: vulnerability.aiSuggestion,
          riskScore: vulnerability.riskScore,
          exploitabilityScore: vulnerability.exploitabilityScore,
          impactScore: vulnerability.impactScore,
          source: "mvp-scan",
          mvpScanId: scan.id,
          scanId: scan.id,
          scanType: "mvp",
          scaReachability: vulnerability.scaReachability ?? null,
        });
      }

      const criticalCount = result.vulnerabilities.filter((v) => v.severity === "CRITICAL").length;
      const highCount = result.vulnerabilities.filter((v) => v.severity === "HIGH").length;
      const mediumCount = result.vulnerabilities.filter((v) => v.severity === "MEDIUM").length;
      const lowCount = result.vulnerabilities.filter((v) => v.severity === "LOW").length;

      const previewUrl = buildPreviewUrl(scanId, opts);

      await storage.updateMvpCodeScan(scanId, userId, {
        scanStatus: "completed",
        scanProgress: 100,
        scanStage: "Scan complete",
        findingsCount: result.vulnerabilities.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        scannedAt: new Date(),
        previewUrl,
        sbomCycloneDxJson: result.sbom?.cyclonedx ?? null,
        sbomSpdxJson: result.sbom?.spdx ?? null,
        sbomGeneratedAt: result.sbom ? new Date() : null,
      });

      await notifyScanComplete(
        storage,
        scan.userId,
        scan.id,
        "mvp",
        scan.projectName || "MVP Code Scan",
        result.vulnerabilities.length
      );

      if (onCompleted) {
        await onCompleted(result);
      }
    })
    .catch(async (error: unknown) => {
      const scanError = handleScanError(error);
      console.error("MVP scan error:", formatErrorForLogging(error));
      const isCancellation = scanError.code === "CANCELLED";
      await storage.updateMvpCodeScan(scanId, userId, {
        scanStatus: isCancellation ? "cancelled" : "failed",
        scanError: scanError.userMessage,
        scanProgress: null,
        scanStage: null,
        cancellationRequested: false,
      });
      console.error(`MVP scan ${isCancellation ? "cancelled" : "failed"}:`, scanError.userMessage);
    });

  void logAuditEvent({
    userId,
    action: "mvp_scan.scan_started",
    resourceType: "mvp_scan",
    resourceId: scan.id,
    metadata: { projectName: scan.projectName },
    req: req as any,
  });
}
