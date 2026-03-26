/**
 * Findings deduplication / clustering — groups duplicate or near-duplicate findings
 * across scans so users see one canonical entry per unique issue.
 *
 * Fingerprint = SHA-256( normalized CWE | normalized category | title stem | location stem ).
 * Findings with the same fingerprint are grouped into a cluster.
 */
import { createHash } from "crypto";
import type { Finding } from "@shared/schema";

export interface FindingCluster {
  fingerprint: string;
  canonical: Finding;
  duplicates: Finding[];
  totalCount: number;
  scanTypes: string[];
  severities: string[];
  firstSeen: string;
  lastSeen: string;
}

export interface ClusterSummary {
  totalFindings: number;
  uniqueClusters: number;
  duplicateCount: number;
  clusters: FindingCluster[];
}

function normalizeCwe(cwe: string): string {
  const m = String(cwe || "").match(/\d+/);
  return m ? m[0] : String(cwe || "").toLowerCase().trim();
}

function normalizeCategory(cat: string): string {
  return (cat || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Reduce a title to a stem by lowercasing, stripping scan-specific prefixes
 * (e.g. "Demo: ", "MVP: "), and collapsing whitespace.
 */
function normalizeTitleStem(title: string): string {
  let t = (title || "").toLowerCase();
  t = t.replace(/^(demo|mvp|web|mobile|container|api|network|linter|pipeline)\s*:\s*/i, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Normalize location: strip line/column numbers, lowercase, collapse separators.
 * "src/auth/login.ts:42:10" → "src/auth/login.ts"
 */
function normalizeLocation(loc: string | null | undefined): string {
  if (!loc) return "";
  let l = loc.toLowerCase().trim();
  l = l.replace(/:\d+/g, "");
  l = l.replace(/\s+/g, " ").trim();
  return l;
}

export function computeFingerprint(finding: Finding): string {
  const parts = [
    normalizeCwe(finding.cwe),
    normalizeCategory(finding.category),
    normalizeTitleStem(finding.title),
    normalizeLocation(finding.location),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/**
 * Group findings into clusters. The canonical finding in each cluster is the one
 * with the highest priority score, breaking ties by most recent detection date.
 */
export function clusterFindings(allFindings: Finding[]): ClusterSummary {
  const map = new Map<string, Finding[]>();

  for (const f of allFindings) {
    const fp = computeFingerprint(f);
    const arr = map.get(fp) ?? [];
    arr.push(f);
    map.set(fp, arr);
  }

  const clusters: FindingCluster[] = [];

  for (const [fingerprint, group] of map) {
    group.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      const da = new Date(a.detected).getTime();
      const db = new Date(b.detected).getTime();
      return db - da;
    });

    const canonical = group[0];
    const duplicates = group.slice(1);
    const dates = group.map((f) => new Date(f.detected).getTime());
    const scanTypes = [...new Set(group.map((f) => f.scanType).filter(Boolean))] as string[];
    const severities = [...new Set(group.map((f) => f.severity))];

    clusters.push({
      fingerprint,
      canonical,
      duplicates,
      totalCount: group.length,
      scanTypes,
      severities,
      firstSeen: new Date(Math.min(...dates)).toISOString(),
      lastSeen: new Date(Math.max(...dates)).toISOString(),
    });
  }

  clusters.sort((a, b) => b.totalCount - a.totalCount);

  const duplicateCount = allFindings.length - clusters.length;

  return {
    totalFindings: allFindings.length,
    uniqueClusters: clusters.length,
    duplicateCount,
    clusters,
  };
}

/**
 * Return only clusters that contain more than one finding (actual duplicates).
 */
export function getDuplicateClusters(allFindings: Finding[]): ClusterSummary {
  const full = clusterFindings(allFindings);
  const dupClusters = full.clusters.filter((c) => c.totalCount > 1);
  const dupFindingsCount = dupClusters.reduce((sum, c) => sum + c.totalCount, 0);
  return {
    totalFindings: dupFindingsCount,
    uniqueClusters: dupClusters.length,
    duplicateCount: dupFindingsCount - dupClusters.length,
    clusters: dupClusters,
  };
}
