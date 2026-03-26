/**
 * CycloneDX 1.5–compatible Vulnerability Exploitability eXchange (VEX) JSON
 * derived from Aithon Shield findings (CVE mentions in title/description/remediation).
 */
import { randomUUID } from "crypto";
import type { Finding } from "@shared/schema";
import { extractCveIdsFromText } from "@shared/cveWatchlistUtils";

type VexState = "exploitable" | "in_triage" | "not_affected" | "resolved";

const STATE_RANK: Record<VexState, number> = {
  exploitable: 4,
  in_triage: 3,
  not_affected: 2,
  resolved: 1,
};

function nvdUrl(cve: string): string {
  return `https://nvd.nist.gov/vuln/detail/${cve}`;
}

function findingToContribution(f: Finding): VexState {
  if (f.isArchived) return "resolved";
  const st = (f.status ?? "").toLowerCase();
  if (f.fixesApplied === true || st === "resolved" || st === "fixed") return "resolved";
  if (st === "accepted-risk") return "not_affected";
  if (st === "open" || st === "in-progress" || st === "in progress") {
    const sev = (f.severity ?? "").toLowerCase();
    if (sev === "critical" || sev === "high") return "exploitable";
    return "in_triage";
  }
  return "in_triage";
}

function mergeState(a: VexState, b: VexState): VexState {
  return STATE_RANK[a] >= STATE_RANK[b] ? a : b;
}

function justificationForState(s: VexState): string | undefined {
  if (s === "not_affected") return "mitigated_by_other_means";
  return undefined;
}

function worstSeverity(refs: Finding[]): "critical" | "high" | "medium" | "low" {
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  let best = 0;
  let out: "critical" | "high" | "medium" | "low" = "low";
  for (const r of refs) {
    const s = (r.severity ?? "").toLowerCase();
    const k = s === "critical" ? "critical" : s === "high" ? "high" : s === "medium" ? "medium" : "low";
    if (rank[k] > best) {
      best = rank[k];
      out = k;
    }
  }
  return out;
}

export type VexBuildMeta = {
  scope: "workspace" | "mvp_scan";
  scanId?: string;
  projectHint?: string | null;
};

/**
 * Build a standalone CycloneDX BOM document whose primary payload is `vulnerabilities[]`
 * with VEX-style `analysis.state` per CVE.
 */
export function buildCycloneDxVexFromFindings(
  findings: Finding[],
  meta: VexBuildMeta,
): Record<string, unknown> {
  const serial = `urn:uuid:${randomUUID()}`;
  const ts = new Date().toISOString();

  /** CVE -> aggregated state + source findings */
  const byCve = new Map<string, { state: VexState; refs: Finding[] }>();

  for (const f of findings) {
    const blob = [f.title, f.description, f.remediation, f.aiSuggestion].filter(Boolean).join("\n");
    const cves = extractCveIdsFromText(blob);
    if (cves.length === 0) continue;
    const contrib = findingToContribution(f);
    for (const cve of cves) {
      const cur = byCve.get(cve);
      if (!cur) {
        byCve.set(cve, { state: contrib, refs: [f] });
      } else {
        cur.state = mergeState(cur.state, contrib);
        cur.refs.push(f);
      }
    }
  }

  const vulnerabilities = [...byCve.entries()].map(([cve, { state, refs }]) => {
    const uniqTitles = [...new Set(refs.map((r) => r.title))].slice(0, 5);
    const detailParts = [
      `Aithon Shield aggregated ${refs.length} finding(s) referencing ${cve}.`,
      `Representative titles: ${uniqTitles.join("; ")}`,
    ];
    const analysis: Record<string, unknown> = {
      state,
      detail: detailParts.join(" "),
    };
    const j = justificationForState(state);
    if (j) analysis.justification = j;

    return {
      id: cve,
      source: {
        name: "NVD",
        url: nvdUrl(cve),
      },
      ratings: [
        {
          source: { name: "Aithon Shield", url: "https://aithonshield.local" },
          severity: worstSeverity(refs),
        },
      ],
      analysis,
    };
  });

  const findingsWithCve = findings.filter((f) => {
    const blob = [f.title, f.description, f.remediation, f.aiSuggestion].filter(Boolean).join("\n");
    return extractCveIdsFromText(blob).length > 0;
  }).length;

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: serial,
    version: 1,
    metadata: {
      timestamp: ts,
      tools: [
        {
          vendor: "Aithon Shield",
          name: "aithon-vex",
          version: "1.0.0",
        },
      ],
      properties: [
        { name: "aithon:vex:scope", value: meta.scope },
        ...(meta.scanId ? [{ name: "aithon:vex:scanId", value: meta.scanId }] : []),
        ...(meta.projectHint ? [{ name: "aithon:vex:projectHint", value: meta.projectHint }] : []),
        { name: "aithon:vex:findingsTotal", value: String(findings.length) },
        { name: "aithon:vex:findingsWithCveMention", value: String(findingsWithCve) },
        { name: "aithon:vex:vulnerabilityEntries", value: String(vulnerabilities.length) },
      ],
    },
    vulnerabilities,
  };
}
