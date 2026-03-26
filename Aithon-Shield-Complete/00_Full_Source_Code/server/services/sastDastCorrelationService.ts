/**
 * Correlate MVP (SAST-heavy) findings with Web (DAST) findings when both
 * target the same repository linked from a web app workflow.
 */
import type { Finding } from "@shared/schema";

export type CorrelationFindingRef = {
  id: string;
  title: string;
  cwe: string;
  severity: string;
  category: string;
  location: string | null;
};

export type SastDastPair = {
  dast: CorrelationFindingRef;
  sast: CorrelationFindingRef;
  matchType: "cwe";
};

export function normalizeRepositoryUrl(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s.endsWith("/")) s = s.slice(0, -1);
  if (s.endsWith(".git")) s = s.slice(0, -4);
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return `${u.hostname}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return s.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/\.git$/, "");
  }
}

function normalizeCwe(cwe: string): string {
  const m = String(cwe || "").match(/\d{1,4}/);
  return m ? m[0] : String(cwe || "").toLowerCase().trim() || "unknown";
}

export function toCorrelationRef(f: Finding): CorrelationFindingRef {
  return {
    id: f.id,
    title: f.title,
    cwe: f.cwe,
    severity: f.severity,
    category: f.category,
    location: f.location ?? null,
  };
}

function bucketByCwe(findings: Finding[]): Map<string, Finding[]> {
  const m = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = normalizeCwe(f.cwe);
    const arr = m.get(k) ?? [];
    arr.push(f);
    m.set(k, arr);
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => a.id.localeCompare(b.id));
  }
  return m;
}

/**
 * Pair DAST and SAST findings that share the same normalized CWE (first N of each bucket).
 */
export function correlateSastDastFindings(dastFindings: Finding[], sastFindings: Finding[]): {
  pairs: SastDastPair[];
  dastOnly: CorrelationFindingRef[];
  sastOnly: CorrelationFindingRef[];
  summary: { dastTotal: number; sastTotal: number; pairedCount: number };
} {
  const dastBuckets = bucketByCwe(dastFindings);
  const sastBuckets = bucketByCwe(sastFindings);
  const cwes = new Set([...dastBuckets.keys(), ...sastBuckets.keys()]);

  const pairs: SastDastPair[] = [];
  const usedDast = new Set<string>();
  const usedSast = new Set<string>();

  for (const cwe of cwes) {
    const dRow = dastBuckets.get(cwe) ?? [];
    const sRow = sastBuckets.get(cwe) ?? [];
    const n = Math.min(dRow.length, sRow.length);
    for (let i = 0; i < n; i++) {
      const d = dRow[i];
      const s = sRow[i];
      pairs.push({
        dast: toCorrelationRef(d),
        sast: toCorrelationRef(s),
        matchType: "cwe",
      });
      usedDast.add(d.id);
      usedSast.add(s.id);
    }
  }

  const dastOnly = dastFindings.filter((f) => !usedDast.has(f.id)).map(toCorrelationRef);
  const sastOnly = sastFindings.filter((f) => !usedSast.has(f.id)).map(toCorrelationRef);

  return {
    pairs,
    dastOnly,
    sastOnly,
    summary: {
      dastTotal: dastFindings.length,
      sastTotal: sastFindings.length,
      pairedCount: pairs.length,
    },
  };
}
