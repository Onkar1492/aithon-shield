import { storage } from "./storage";
import { startMvpScanBackground } from "./executeMvpScanBackground";
import { buildNextRunSummary, parseScheduledScanConfig } from "@shared/scheduledScanUtils";
import type { ScanResult } from "./services/types";
import type { ScheduledScan } from "@shared/schema";

const TICK_MS = Math.max(
  5_000,
  parseInt(process.env.AITHON_SCHEDULED_SCAN_TICK_MS || "30000", 10) || 30_000,
);

function previewBaseUrl(): string {
  if (process.env.APP_BASE_URL?.trim()) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }
  const port = process.env.PORT || "5001";
  return `http://127.0.0.1:${port}`;
}

async function processDueJob(row: ScheduledScan): Promise<void> {
  const now = new Date();
  const cfg = parseScheduledScanConfig(row.scanConfig);

  if (!cfg || cfg.scanType !== "mvp") {
    const claimed = await storage.claimScheduledScanRun(row, now);
    if (!claimed) return;
    await storage.updateScheduledScan(row.id, row.userId, {
      lastRunSummaryJson: JSON.stringify({
        skipped: true,
        reason: !cfg ? "invalid_scan_config" : "unsupported_scan_type",
        scanType: cfg?.scanType ?? null,
        scannedAt: now.toISOString(),
      }),
    });
    if (!cfg) {
      console.warn(`[scheduled-scan] invalid scan_config for job ${row.id}`);
    } else {
      console.warn(
        `[scheduled-scan] scan type "${cfg.scanType}" not implemented for scheduled runs (job ${row.id})`,
      );
    }
    return;
  }

  const mvp = await storage.getMvpCodeScan(cfg.targetScanId, row.userId);
  if (!mvp) {
    const claimed = await storage.claimScheduledScanRun(row, now);
    if (!claimed) return;
    await storage.updateScheduledScan(row.id, row.userId, {
      lastRunSummaryJson: JSON.stringify({
        error: "target_scan_not_found",
        targetScanId: cfg.targetScanId,
        scannedAt: now.toISOString(),
      }),
    });
    console.warn(`[scheduled-scan] MVP scan ${cfg.targetScanId} not found for job ${row.id}`);
    return;
  }

  if (mvp.scanStatus === "scanning") {
    const claimed = await storage.claimScheduledScanRun(row, now);
    if (!claimed) return;
    await storage.updateScheduledScan(row.id, row.userId, {
      lastRunSummaryJson: JSON.stringify({
        skipped: true,
        reason: "target_already_scanning",
        targetScanId: cfg.targetScanId,
        scannedAt: now.toISOString(),
      }),
    });
    return;
  }

  const previousSummaryJson = row.lastRunSummaryJson;
  const claimedRun = await storage.claimScheduledScanRun(row, now);
  if (!claimedRun) return;

  await storage.updateMvpCodeScan(cfg.targetScanId, row.userId, {
    scanStatus: "scanning",
    scanProgress: 0,
    scanStage: "Initializing scan (scheduled)...",
    scanError: null,
    cancellationRequested: false,
  });

  const fresh = await storage.getMvpCodeScan(cfg.targetScanId, row.userId);
  if (!fresh) return;

  startMvpScanBackground({
    scan: fresh,
    userId: row.userId,
    scanId: cfg.targetScanId,
    previewBaseUrl: previewBaseUrl(),
    onCompleted: async (result: ScanResult) => {
      const vulns = result.vulnerabilities;
      const criticalCount = vulns.filter((v) => v.severity === "CRITICAL").length;
      const highCount = vulns.filter((v) => v.severity === "HIGH").length;
      const mediumCount = vulns.filter((v) => v.severity === "MEDIUM").length;
      const lowCount = vulns.filter((v) => v.severity === "LOW").length;
      const summary = buildNextRunSummary(
        previousSummaryJson,
        {
          findingsCount: vulns.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
        },
        new Date(),
      );
      await storage.updateScheduledScan(row.id, row.userId, {
        lastRunSummaryJson: JSON.stringify(summary),
      });
    },
  });
}

export function startScheduledScanEngine(): void {
  const run = async () => {
    try {
      const now = new Date();
      const due = await storage.getDueScheduledScans(now);
      for (const row of due) {
        await processDueJob(row);
      }
    } catch (e) {
      console.error("[scheduled-scan] tick failed:", e);
    }
  };

  void run();
  setInterval(() => void run(), TICK_MS);
  console.log(`[scheduled-scan] engine started (tick ${TICK_MS}ms)`);
}
