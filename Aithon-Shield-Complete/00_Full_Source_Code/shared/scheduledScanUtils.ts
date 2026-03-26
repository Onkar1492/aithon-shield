import { z } from "zod";

/** Stored in `scheduled_scans.scan_config` (JSON string). */
export const scheduledScanConfigSchema = z.object({
  targetScanId: z.string().uuid(),
  scanType: z.enum(["mvp", "web", "mobile"]),
});

export type ScheduledScanConfigPayload = z.infer<typeof scheduledScanConfigSchema>;

export function parseScheduledScanConfig(raw: string): ScheduledScanConfigPayload | null {
  try {
    const j = JSON.parse(raw) as unknown;
    const p = scheduledScanConfigSchema.safeParse(j);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

/** Next run time after `from` for recurring schedules (UTC). */
export function computeNextRunAt(
  from: Date,
  frequency: string,
  cronExpression: string | null | undefined,
): Date {
  const d = new Date(from.getTime());
  const f = frequency.toLowerCase();
  if (f === "daily") {
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (f === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (f === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  if (f === "custom" && cronExpression?.trim()) {
    // MVP: treat custom as daily if not parsed
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** First `next_run_at` after creating a schedule — run soon, not immediately (avoid startup storms). */
export function computeInitialNextRunAt(): Date {
  return new Date(Date.now() + 60_000);
}

/** Persisted in `scheduled_scans.last_run_summary_json` after each scheduled run. */
export type ScheduledRunLastSummary = {
  scannedAt: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  driftFromPrevious: {
    findingsDelta: number;
    criticalDelta: number;
    highDelta: number;
    mediumDelta: number;
    lowDelta: number;
  } | null;
};

export function parseLastRunSummaryJson(raw: string | null | undefined): ScheduledRunLastSummary | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as ScheduledRunLastSummary;
    if (typeof j.findingsCount !== "number") return null;
    return j;
  } catch {
    return null;
  }
}

export function buildNextRunSummary(
  previousJson: string | null | undefined,
  counts: {
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  },
  scannedAt: Date,
): ScheduledRunLastSummary {
  const prev = parseLastRunSummaryJson(previousJson ?? null);
  const drift = prev
    ? {
        findingsDelta: counts.findingsCount - prev.findingsCount,
        criticalDelta: counts.criticalCount - prev.criticalCount,
        highDelta: counts.highCount - prev.highCount,
        mediumDelta: counts.mediumCount - prev.mediumCount,
        lowDelta: counts.lowCount - prev.lowCount,
      }
    : null;
  return {
    scannedAt: scannedAt.toISOString(),
    ...counts,
    driftFromPrevious: drift,
  };
}
