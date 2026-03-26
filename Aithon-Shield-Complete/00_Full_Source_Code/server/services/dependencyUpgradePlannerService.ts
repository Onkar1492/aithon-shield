/**
 * Dependency upgrade path planner — extracts dependency info from SBOM components
 * and SCA findings, then produces a prioritized upgrade plan.
 */
import type { Finding } from "@shared/schema";

export interface DependencyInfo {
  name: string;
  currentVersion: string;
  ecosystem: string;
  purl: string | null;
  manifestFile: string | null;
}

export interface UpgradeRecommendation {
  dependency: DependencyInfo;
  vulnerabilityCount: number;
  highestSeverity: string;
  highestCvss: number;
  cves: string[];
  reachability: string | null;
  upgradeUrgency: "critical" | "high" | "medium" | "low";
  upgradeCommand: string;
  findings: Array<{
    id: string;
    title: string;
    severity: string;
    cwe: string;
    status: string;
  }>;
}

export interface UpgradePlan {
  scanId: string;
  projectName: string;
  totalDependencies: number;
  vulnerableDependencies: number;
  recommendations: UpgradeRecommendation[];
  safeDependencies: DependencyInfo[];
  summary: {
    criticalUpgrades: number;
    highUpgrades: number;
    mediumUpgrades: number;
    lowUpgrades: number;
  };
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function parseSeverityScore(severity: string): number {
  return SEVERITY_ORDER[severity.toUpperCase()] ?? 0;
}

/**
 * Extract package name and version from a finding's location field.
 * Location format: "package.json:express@4.17.1" or "requirements.txt:flask@2.0.1"
 */
function parseLocationDependency(location: string | null): { file: string; name: string; version: string } | null {
  if (!location) return null;
  const match = location.match(/^(.+?):(.+?)@(.+)$/);
  if (!match) return null;
  return { file: match[1], name: match[2], version: match[3] };
}

/**
 * Extract CVE IDs from finding description or title.
 */
function extractCves(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) ?? [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}

/**
 * Extract CVSS score from finding description.
 */
function extractCvss(description: string | null): number {
  if (!description) return 0;
  const match = description.match(/CVSS\s*(?:Score)?[:\s]*(\d+\.?\d*)/i);
  return match ? parseFloat(match[1]) : 0;
}

function guessEcosystem(manifestFile: string): string {
  const f = manifestFile.toLowerCase();
  if (f.includes("package.json") || f.includes("package-lock") || f.includes("yarn.lock")) return "npm";
  if (f.includes("requirements") || f.includes("pipfile") || f.includes("pyproject")) return "pip";
  if (f.includes("go.mod") || f.includes("go.sum")) return "go";
  if (f.includes("pom.xml") || f.includes("build.gradle")) return "maven";
  if (f.includes("gemfile")) return "gem";
  if (f.includes("composer")) return "composer";
  if (f.includes("cargo")) return "cargo";
  return "unknown";
}

function buildUpgradeCommand(dep: DependencyInfo): string {
  const eco = dep.ecosystem.toLowerCase();
  if (eco === "npm") return `npm update ${dep.name}`;
  if (eco === "pip") return `pip install --upgrade ${dep.name}`;
  if (eco === "go") return `go get -u ${dep.name}`;
  if (eco === "maven") return `mvn versions:use-latest-releases -Dincludes=${dep.name}`;
  if (eco === "gem") return `bundle update ${dep.name}`;
  if (eco === "composer") return `composer update ${dep.name}`;
  if (eco === "cargo") return `cargo update -p ${dep.name}`;
  return `Update ${dep.name} to the latest patched version`;
}

function computeUrgency(highestSeverity: string, reachability: string | null, vulnCount: number): UpgradeRecommendation["upgradeUrgency"] {
  const sev = highestSeverity.toUpperCase();
  if (sev === "CRITICAL") return "critical";
  if (sev === "HIGH" && reachability === "import_referenced") return "critical";
  if (sev === "HIGH") return "high";
  if (sev === "MEDIUM" && vulnCount > 1) return "high";
  if (sev === "MEDIUM") return "medium";
  return "low";
}

/**
 * Build an upgrade plan from SBOM components and SCA findings.
 */
export function buildUpgradePlan(
  scanId: string,
  projectName: string,
  sbomComponents: Array<{ name: string; version: string; purl?: string }>,
  scaFindings: Finding[],
): UpgradePlan {
  const depMap = new Map<string, DependencyInfo>();

  for (const comp of sbomComponents) {
    const key = `${comp.name}@${comp.version}`.toLowerCase();
    if (!depMap.has(key)) {
      const eco = comp.purl ? (comp.purl.split("/")[0]?.replace("pkg:", "") ?? "unknown") : "unknown";
      depMap.set(key, {
        name: comp.name,
        currentVersion: comp.version,
        ecosystem: eco,
        purl: comp.purl ?? null,
        manifestFile: null,
      });
    }
  }

  for (const f of scaFindings) {
    const parsed = parseLocationDependency(f.location);
    if (!parsed) continue;
    const key = `${parsed.name}@${parsed.version}`.toLowerCase();
    if (!depMap.has(key)) {
      depMap.set(key, {
        name: parsed.name,
        currentVersion: parsed.version,
        ecosystem: guessEcosystem(parsed.file),
        purl: null,
        manifestFile: parsed.file,
      });
    } else {
      const existing = depMap.get(key)!;
      if (!existing.manifestFile) existing.manifestFile = parsed.file;
      if (existing.ecosystem === "unknown") existing.ecosystem = guessEcosystem(parsed.file);
    }
  }

  const vulnByDep = new Map<string, Finding[]>();
  for (const f of scaFindings) {
    const parsed = parseLocationDependency(f.location);
    if (!parsed) continue;
    const key = `${parsed.name}@${parsed.version}`.toLowerCase();
    const arr = vulnByDep.get(key) ?? [];
    arr.push(f);
    vulnByDep.set(key, arr);
  }

  const recommendations: UpgradeRecommendation[] = [];
  const safeDependencies: DependencyInfo[] = [];

  for (const [key, dep] of depMap) {
    const vulns = vulnByDep.get(key) ?? [];
    if (vulns.length === 0) {
      safeDependencies.push(dep);
      continue;
    }

    let highestSev = "LOW";
    let highestCvss = 0;
    const allCves: string[] = [];
    let reachability: string | null = null;

    for (const v of vulns) {
      if (parseSeverityScore(v.severity) > parseSeverityScore(highestSev)) {
        highestSev = v.severity;
      }
      const cvss = extractCvss(v.description);
      if (cvss > highestCvss) highestCvss = cvss;
      allCves.push(...extractCves(`${v.title} ${v.description}`));
      if (v.scaReachability && !reachability) reachability = v.scaReachability;
    }

    recommendations.push({
      dependency: dep,
      vulnerabilityCount: vulns.length,
      highestSeverity: highestSev,
      highestCvss,
      cves: [...new Set(allCves)],
      reachability,
      upgradeUrgency: computeUrgency(highestSev, reachability, vulns.length),
      upgradeCommand: buildUpgradeCommand(dep),
      findings: vulns.map((v) => ({
        id: v.id,
        title: v.title,
        severity: v.severity,
        cwe: v.cwe,
        status: v.status,
      })),
    });
  }

  const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => {
    const ua = urgencyOrder[a.upgradeUrgency] ?? 99;
    const ub = urgencyOrder[b.upgradeUrgency] ?? 99;
    if (ua !== ub) return ua - ub;
    return b.highestCvss - a.highestCvss;
  });

  return {
    scanId,
    projectName,
    totalDependencies: depMap.size,
    vulnerableDependencies: recommendations.length,
    recommendations,
    safeDependencies,
    summary: {
      criticalUpgrades: recommendations.filter((r) => r.upgradeUrgency === "critical").length,
      highUpgrades: recommendations.filter((r) => r.upgradeUrgency === "high").length,
      mediumUpgrades: recommendations.filter((r) => r.upgradeUrgency === "medium").length,
      lowUpgrades: recommendations.filter((r) => r.upgradeUrgency === "low").length,
    },
  };
}
