/**
 * Per-project (scan) developer score cards.
 * Pure aggregation + scoring from flat finding rows (no DB).
 */

export type FindingLikeForScore = {
  scanId: string | null;
  scanType: string | null;
  scanName?: string | null;
  severity: string;
  status: string | null;
  fixesApplied?: boolean | null;
};

export type DeveloperScoreCardRow = {
  projectKey: string;
  scanType: string;
  scanId: string;
  projectName: string;
  /** 0–100 composite security engagement score */
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  totalFindings: number;
  openFindings: number;
  resolvedFindings: number;
  acceptedRiskFindings: number;
  criticalOpen: number;
  highOpen: number;
  mediumOpen: number;
  lowOpen: number;
  /** Resolved / total (0 if total 0) */
  resolutionRate: number;
};

function severityNorm(s: string): string {
  return (s ?? "").toLowerCase();
}

function isResolved(f: FindingLikeForScore): boolean {
  if (f.fixesApplied === true) return true;
  const st = (f.status ?? "").toUpperCase().trim();
  return st === "RESOLVED";
}

function isAcceptedRisk(f: FindingLikeForScore): boolean {
  return (f.status ?? "").toLowerCase() === "accepted-risk";
}

function isOpenActionable(f: FindingLikeForScore): boolean {
  return !isResolved(f) && !isAcceptedRisk(f);
}

function gradeFromScore(score: number): DeveloperScoreCardRow["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Composite score: balances resolution progress vs open critical/high exposure.
 * Explainable for dashboards and compliance narratives.
 */
export function computeEngagementScore(stats: {
  total: number;
  open: number;
  criticalOpen: number;
  highOpen: number;
  mediumOpen: number;
  lowOpen: number;
  resolved: number;
  acceptedRisk: number;
}): number {
  const { total, criticalOpen, highOpen, mediumOpen, lowOpen, resolved } = stats;
  if (total === 0) return 100;

  const resolutionRate = resolved / total;

  // Exposure penalty (capped)
  const rawPenalty =
    criticalOpen * 12 + highOpen * 7 + mediumOpen * 3 + lowOpen * 1;
  const penalty = Math.min(75, rawPenalty);

  // Resolution lifts the score (up to +25)
  const resolutionBoost = resolutionRate * 25;

  const raw = 75 - penalty + resolutionBoost;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function buildDeveloperScoreCards(rows: FindingLikeForScore[]): DeveloperScoreCardRow[] {
  const groups = new Map<
    string,
    {
      scanType: string;
      scanId: string;
      projectName: string;
      items: FindingLikeForScore[];
    }
  >();

  for (const f of rows) {
    if (!f.scanId || !f.scanType) continue;
    const key = `${f.scanType}:${f.scanId}`;
    const g = groups.get(key);
    const name = f.scanName?.trim() || "Unknown project";
    if (!g) {
      groups.set(key, { scanType: f.scanType, scanId: f.scanId, projectName: name, items: [f] });
    } else {
      g.items.push(f);
      if (name && name !== "Unknown project") g.projectName = name;
    }
  }

  const cards: DeveloperScoreCardRow[] = [];
  for (const [, g] of groups) {
    let criticalOpen = 0;
    let highOpen = 0;
    let mediumOpen = 0;
    let lowOpen = 0;
    let openFindings = 0;
    let resolvedFindings = 0;
    let acceptedRiskFindings = 0;

    for (const f of g.items) {
      if (isAcceptedRisk(f)) {
        acceptedRiskFindings++;
        continue;
      }
      if (isResolved(f)) {
        resolvedFindings++;
        continue;
      }
      openFindings++;
      const sev = severityNorm(f.severity);
      if (sev === "critical") criticalOpen++;
      else if (sev === "high") highOpen++;
      else if (sev === "medium") mediumOpen++;
      else lowOpen++;
    }

    const totalFindings = g.items.length;
    const score = computeEngagementScore({
      total: totalFindings,
      open: openFindings,
      criticalOpen,
      highOpen,
      mediumOpen,
      lowOpen,
      resolved: resolvedFindings,
      acceptedRisk: acceptedRiskFindings,
    });

    cards.push({
      projectKey: `${g.scanType}:${g.scanId}`,
      scanType: g.scanType,
      scanId: g.scanId,
      projectName: g.projectName,
      score,
      grade: gradeFromScore(score),
      totalFindings,
      openFindings,
      resolvedFindings,
      acceptedRiskFindings,
      criticalOpen,
      highOpen,
      mediumOpen,
      lowOpen,
      resolutionRate: totalFindings > 0 ? Math.round((resolvedFindings / totalFindings) * 1000) / 1000 : 0,
    });
  }

  cards.sort((a, b) => a.score - b.score);
  return cards;
}
