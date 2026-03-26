import { z } from "zod";
import type { Finding } from "./schema";

export type SlaSeverity = "critical" | "high" | "medium" | "low";

/** Hours to remediate per severity (same semantics as `.aithonshield.yml` policy.sla, e.g. 24h → 24). */
export type SlaHoursBySeverity = Partial<Record<SlaSeverity, number>>;

const SLA_SEVERITIES: SlaSeverity[] = ["critical", "high", "medium", "low"];

export const slaHoursBySeveritySchema = z.object({
  critical: z.number().positive().max(8760).nullable().optional(),
  high: z.number().positive().max(8760).nullable().optional(),
  medium: z.number().positive().max(8760).nullable().optional(),
  low: z.number().positive().max(8760).nullable().optional(),
});

/** Parse strings like `24h`, `7d`, `48h` from YAML into approximate hours. */
export function parseDurationToHours(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  const m = /^(\d+(?:\.\d+)?)\s*(h|d|w)$/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2];
  if (u === "h") return n;
  if (u === "d") return n * 24;
  if (u === "w") return n * 24 * 7;
  return null;
}

export function normalizeSeverityToSlaKey(severity: string | null | undefined): SlaSeverity | null {
  const s = (severity ?? "").toLowerCase().trim();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return null;
}

function isUnresolvedOpen(f: Finding): boolean {
  const st = (f.status ?? "").toLowerCase();
  if (st === "resolved" || st === "fixed" || st === "accepted-risk") return false;
  return st === "open" || st === "in-progress" || st === "in progress";
}

export type SlaRowStatus = "breached" | "at_risk" | "ok";

export type SlaFindingEvaluation = {
  findingId: string;
  title: string;
  severity: string;
  scanType: string | null;
  scanId: string | null;
  createdAt: string;
  dueAt: string;
  hoursBudget: number;
  status: SlaRowStatus;
  overdueHours: number | null;
};

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (3600 * 1000);
}

/**
 * Classify open findings against SLA hours. Breach = past due and still open.
 * At risk = within 25% of window remaining (warning band).
 */
export function evaluateSlaForFindings(
  findings: Finding[],
  policy: SlaHoursBySeverity | null | undefined,
  now: Date = new Date(),
): { breaches: SlaFindingEvaluation[]; upcoming: SlaFindingEvaluation[] } {
  const policySafe = policy ?? {};
  const hasAny = SLA_SEVERITIES.some((k) => typeof policySafe[k] === "number" && (policySafe[k] as number) > 0);
  if (!hasAny) {
    return { breaches: [], upcoming: [] };
  }

  const rows: SlaFindingEvaluation[] = [];

  for (const f of findings) {
    if (f.isArchived) continue;
    if (!isUnresolvedOpen(f)) continue;
    const sev = normalizeSeverityToSlaKey(f.severity);
    if (!sev) continue;
    const hours = policySafe[sev];
    if (hours === undefined || hours === null || hours <= 0) continue;

    const created = new Date(f.createdAt);
    const due = new Date(created.getTime() + hours * 3600 * 1000);
    const overdueH = hoursBetween(due, now);

    let status: SlaRowStatus = "ok";
    if (now > due) {
      status = "breached";
    } else {
      const totalH = hours;
      const remainingH = hoursBetween(now, due);
      if (remainingH <= totalH * 0.25) status = "at_risk";
    }

    rows.push({
      findingId: f.id,
      title: f.title,
      severity: f.severity,
      scanType: f.scanType ?? null,
      scanId: f.scanId ?? null,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
      dueAt: due.toISOString(),
      hoursBudget: hours,
      status,
      overdueHours: status === "breached" ? Math.max(0, overdueH) : null,
    });
  }

  const breaches = rows.filter((r) => r.status === "breached").sort((a, b) => (b.overdueHours ?? 0) - (a.overdueHours ?? 0));
  const upcoming = rows
    .filter((r) => r.status !== "breached")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 50);

  return { breaches, upcoming };
}
