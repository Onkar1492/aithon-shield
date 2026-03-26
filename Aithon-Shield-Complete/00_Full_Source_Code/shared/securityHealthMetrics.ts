import type { Finding } from "./schema";

/** Same resolution semantics as client `isFindingResolved`. */
export function isFindingResolvedForMetrics(f: Finding): boolean {
  return (
    f.fixesApplied === true ||
    (typeof f.status === "string" && f.status.toUpperCase().trim() === "RESOLVED")
  );
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function endOfUtcDay(dayKey: string): Date {
  const d = new Date(`${dayKey}T23:59:59.999Z`);
  return d;
}

/** Finding is unresolved at end of `endOfDay` (UTC day boundary). */
export function isActiveAtEndOfDay(f: Finding, endOfDay: Date): boolean {
  const created = new Date(f.createdAt);
  if (created > endOfDay) return false;
  if (!isFindingResolvedForMetrics(f)) {
    const s = (f.status || "").toLowerCase();
    return s === "open" || s === "in-progress" || s === "in progress";
  }
  const eff = f.resolvedAt ? new Date(f.resolvedAt) : new Date(f.createdAt);
  return eff > endOfDay;
}

function wasResolvedByEndOfDay(f: Finding, endOfDay: Date): boolean {
  if (!isFindingResolvedForMetrics(f)) return false;
  if (f.resolvedAt) return new Date(f.resolvedAt) <= endOfDay;
  return new Date(f.createdAt) <= endOfDay;
}

/** Dashboard-aligned health score for a snapshot of findings. */
export function computeHealthScoreSnapshot(
  findingsExistingByDay: Finding[],
  endOfDay: Date,
): number {
  const existed = findingsExistingByDay.filter((f) => new Date(f.createdAt) <= endOfDay);
  if (existed.length === 0) return 100;

  const active = existed.filter((f) => isActiveAtEndOfDay(f, endOfDay));
  const activeCritical = active.filter((f) => f.severity === "CRITICAL").length;
  const activeHigh = active.filter((f) => f.severity === "HIGH").length;
  const activeMedium = active.filter((f) => f.severity === "MEDIUM").length;

  const resolvedCount = existed.filter((f) => wasResolvedByEndOfDay(f, endOfDay)).length;

  const criticalPenalty = activeCritical * 10;
  const highPenalty = activeHigh * 5;
  const mediumPenalty = activeMedium * 2;
  const totalPenalty = criticalPenalty + highPenalty + mediumPenalty;
  const resolutionBonus = Math.min(20, resolvedCount * 2);
  return Math.max(0, Math.min(100, 100 - totalPenalty + resolutionBonus));
}

export type SecurityHealthDayPoint = {
  date: string;
  newFindings: number;
  resolvedFindings: number;
  healthScore: number;
};

export type MttrBySeverityHours = {
  critical: number | null;
  high: number | null;
  medium: number | null;
  low: number | null;
  overall: number | null;
  /** Findings with non-null resolvedAt used for overall / severity buckets. */
  sampleSize: number;
};

export type SecurityHealthSummary = {
  windowDays: number;
  timeline: SecurityHealthDayPoint[];
  mttrHours: MttrBySeverityHours;
  regressionCount: number;
  /** Current snapshot (all non-archived findings). */
  currentHealthScore: number;
  openFindings: number;
  resolvedFindings: number;
};

function normTitle(t: string): string {
  return t.trim().toLowerCase();
}

function fingerprint(f: Finding): string | null {
  if (!f.scanId || !f.scanType) return null;
  return `${f.scanId}|${f.scanType}|${f.cwe}|${normTitle(f.title)}`;
}

export function countRegressionOpenFindings(findings: Finding[]): number {
  const map = new Map<string, Finding[]>();
  for (const f of findings) {
    const fp = fingerprint(f);
    if (!fp) continue;
    const list = map.get(fp) ?? [];
    list.push(f);
    map.set(fp, list);
  }
  let n = 0;
  for (const list of map.values()) {
    const hasResolved = list.some((f) => isFindingResolvedForMetrics(f));
    const openDuplicates = list.filter((f) => !isFindingResolvedForMetrics(f));
    if (hasResolved && openDuplicates.length > 0) {
      n += openDuplicates.length;
    }
  }
  return n;
}

function meanHours(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mttrForSeverity(findings: Finding[], sev: string): number | null {
  const rows = findings.filter(
    (f) =>
      isFindingResolvedForMetrics(f) &&
      f.resolvedAt &&
      f.severity === sev,
  );
  const hours = rows.map((f) => {
    const ms = new Date(f.resolvedAt!).getTime() - new Date(f.createdAt).getTime();
    return Math.max(0, ms / 3_600_000);
  });
  return meanHours(hours);
}

export function buildSecurityHealthSummary(
  findings: Finding[],
  windowDays: number,
): SecurityHealthSummary {
  const days = Math.min(90, Math.max(7, windowDays));
  const timeline: SecurityHealthDayPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - offset);
    const dayKey = utcDayKey(d);
    const eod = endOfUtcDay(dayKey);

    const newFindings = findings.filter((f) => utcDayKey(new Date(f.createdAt)) === dayKey).length;
    const resolvedFindings = findings.filter(
      (f) => f.resolvedAt && utcDayKey(new Date(f.resolvedAt)) === dayKey,
    ).length;

    const healthScore = computeHealthScoreSnapshot(findings, eod);

    timeline.push({
      date: dayKey,
      newFindings,
      resolvedFindings,
      healthScore,
    });
  }

  const withResolvedAt = findings.filter((f) => isFindingResolvedForMetrics(f) && f.resolvedAt);
  const allHours = withResolvedAt.map((f) => {
    const ms = new Date(f.resolvedAt!).getTime() - new Date(f.createdAt).getTime();
    return Math.max(0, ms / 3_600_000);
  });

  const mttrHours: MttrBySeverityHours = {
    critical: mttrForSeverity(findings, "CRITICAL"),
    high: mttrForSeverity(findings, "HIGH"),
    medium: mttrForSeverity(findings, "MEDIUM"),
    low: mttrForSeverity(findings, "LOW"),
    overall: meanHours(allHours),
    sampleSize: withResolvedAt.length,
  };

  const regressionCount = countRegressionOpenFindings(findings);

  const openFindings = findings.filter(
    (f) => f.status === "open" || f.status === "in-progress",
  ).length;
  const resolvedFindings = findings.filter((f) => isFindingResolvedForMetrics(f)).length;

  const now = new Date();
  const currentHealthScore = computeHealthScoreSnapshot(findings, now);

  return {
    windowDays: days,
    timeline,
    mttrHours,
    regressionCount,
    currentHealthScore,
    openFindings,
    resolvedFindings,
  };
}
