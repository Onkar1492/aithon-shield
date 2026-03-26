/**
 * Multi-repo / multi-environment summary — aggregates scans and findings
 * across all scan types, grouped by repository (or app) and branch/environment.
 */

export interface EnvironmentBreakdown {
  branch: string;
  scanCount: number;
  lastScanDate: string | null;
  lastScanStatus: string;
  findingsOpen: number;
  findingsCritical: number;
  findingsHigh: number;
}

export interface RepoSummary {
  repoKey: string;
  displayName: string;
  repoUrl: string | null;
  scanTypes: string[];
  totalScans: number;
  totalFindingsOpen: number;
  totalFindingsCritical: number;
  totalFindingsHigh: number;
  lastScanDate: string | null;
  lastScanStatus: string;
  environments: EnvironmentBreakdown[];
}

export interface MultiRepoSummary {
  totalRepos: number;
  totalScans: number;
  totalFindingsOpen: number;
  repos: RepoSummary[];
}

interface ScanRow {
  id: string;
  scanType: string;
  repoKey: string;
  displayName: string;
  repoUrl: string | null;
  branch: string;
  status: string;
  createdAt: Date | string | null;
}

interface FindingRow {
  scanId: string | null;
  scanType: string | null;
  severity: string;
  status: string;
  isArchived: boolean;
}

function normalizeRepoKey(url: string): string {
  let s = url.trim().toLowerCase();
  if (s.endsWith("/")) s = s.slice(0, -1);
  if (s.endsWith(".git")) s = s.slice(0, -4);
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return `${u.hostname}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return s.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function buildMultiRepoSummary(
  mvpScans: Array<{ id: string; repositoryUrl: string; projectName: string | null; branch: string | null; scanStatus: string; createdAt: Date | string | null }>,
  mobileScans: Array<{ id: string; appName: string; scanStatus: string; createdAt: Date | string | null }>,
  webScans: Array<{ id: string; appName: string | null; appUrl: string; scanStatus: string; createdAt: Date | string | null }>,
  containerScans: Array<{ id: string; imageName: string; imageTag: string; registry: string; scanStatus: string; createdAt: Date | string | null }>,
  pipelineScans: Array<{ id: string; repositoryUrl: string; repositoryName: string; branch: string; platform: string; scanStatus: string; createdAt: Date | string | null }>,
  networkScans: Array<{ id: string; targetHost: string; targetName: string; scanStatus: string; createdAt: Date | string | null }>,
  linterScans: Array<{ id: string; repositoryUrl: string; projectName: string; scanStatus: string; createdAt: Date | string | null }>,
  allFindings: FindingRow[],
): MultiRepoSummary {
  const scanRows: ScanRow[] = [];

  for (const s of mvpScans) {
    scanRows.push({
      id: s.id,
      scanType: "mvp",
      repoKey: normalizeRepoKey(s.repositoryUrl),
      displayName: s.projectName || s.repositoryUrl,
      repoUrl: s.repositoryUrl,
      branch: s.branch || "main",
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  for (const s of mobileScans) {
    scanRows.push({
      id: s.id,
      scanType: "mobile",
      repoKey: `mobile/${s.appName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      displayName: s.appName,
      repoUrl: null,
      branch: "default",
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  for (const s of webScans) {
    const name = s.appName || s.appUrl;
    scanRows.push({
      id: s.id,
      scanType: "web",
      repoKey: `web/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      displayName: name,
      repoUrl: s.appUrl,
      branch: "default",
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  for (const s of containerScans) {
    const name = `${s.imageName}:${s.imageTag}`;
    scanRows.push({
      id: s.id,
      scanType: "container",
      repoKey: `container/${s.imageName.toLowerCase().replace(/[^a-z0-9/]+/g, "-")}`,
      displayName: name,
      repoUrl: s.registry !== "custom" ? `${s.registry}/${s.imageName}` : s.imageName,
      branch: s.imageTag,
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  for (const s of pipelineScans) {
    scanRows.push({
      id: s.id,
      scanType: "pipeline",
      repoKey: normalizeRepoKey(s.repositoryUrl),
      displayName: s.repositoryName || s.repositoryUrl,
      repoUrl: s.repositoryUrl,
      branch: s.branch || "main",
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  for (const s of networkScans) {
    scanRows.push({
      id: s.id,
      scanType: "network",
      repoKey: `network/${s.targetHost.toLowerCase().replace(/[^a-z0-9.:-]+/g, "-")}`,
      displayName: s.targetName || s.targetHost,
      repoUrl: s.targetHost,
      branch: "default",
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  for (const s of linterScans) {
    scanRows.push({
      id: s.id,
      scanType: "linter",
      repoKey: normalizeRepoKey(s.repositoryUrl),
      displayName: s.projectName || s.repositoryUrl,
      repoUrl: s.repositoryUrl,
      branch: "default",
      status: s.scanStatus,
      createdAt: s.createdAt,
    });
  }

  const findingsByScan = new Map<string, FindingRow[]>();
  for (const f of allFindings) {
    if (!f.scanId || f.isArchived) continue;
    const key = `${f.scanType}:${f.scanId}`;
    const arr = findingsByScan.get(key) ?? [];
    arr.push(f);
    findingsByScan.set(key, arr);
  }

  const repoMap = new Map<string, { scans: ScanRow[]; displayName: string; repoUrl: string | null; scanTypes: Set<string> }>();

  for (const row of scanRows) {
    let entry = repoMap.get(row.repoKey);
    if (!entry) {
      entry = { scans: [], displayName: row.displayName, repoUrl: row.repoUrl, scanTypes: new Set() };
      repoMap.set(row.repoKey, entry);
    }
    entry.scans.push(row);
    entry.scanTypes.add(row.scanType);
  }

  const repos: RepoSummary[] = [];

  for (const [repoKey, entry] of repoMap) {
    const branchMap = new Map<string, ScanRow[]>();
    for (const s of entry.scans) {
      const arr = branchMap.get(s.branch) ?? [];
      arr.push(s);
      branchMap.set(s.branch, arr);
    }

    const environments: EnvironmentBreakdown[] = [];
    let totalOpen = 0;
    let totalCritical = 0;
    let totalHigh = 0;

    for (const [branch, branchScans] of branchMap) {
      branchScans.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });

      let envOpen = 0;
      let envCritical = 0;
      let envHigh = 0;

      for (const scan of branchScans) {
        const key = `${scan.scanType}:${scan.id}`;
        const scanFindings = findingsByScan.get(key) ?? [];
        for (const f of scanFindings) {
          const isOpen = f.status.toLowerCase() !== "resolved" && f.status.toLowerCase() !== "fixed";
          if (isOpen) {
            envOpen++;
            if (f.severity === "CRITICAL") envCritical++;
            if (f.severity === "HIGH") envHigh++;
          }
        }
      }

      const latest = branchScans[0];
      environments.push({
        branch,
        scanCount: branchScans.length,
        lastScanDate: latest?.createdAt ? new Date(latest.createdAt).toISOString() : null,
        lastScanStatus: latest?.status ?? "unknown",
        findingsOpen: envOpen,
        findingsCritical: envCritical,
        findingsHigh: envHigh,
      });

      totalOpen += envOpen;
      totalCritical += envCritical;
      totalHigh += envHigh;
    }

    environments.sort((a, b) => {
      const da = a.lastScanDate ? new Date(a.lastScanDate).getTime() : 0;
      const db = b.lastScanDate ? new Date(b.lastScanDate).getTime() : 0;
      return db - da;
    });

    const allScans = entry.scans.slice().sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    const latestScan = allScans[0];

    repos.push({
      repoKey,
      displayName: entry.displayName,
      repoUrl: entry.repoUrl,
      scanTypes: [...entry.scanTypes],
      totalScans: entry.scans.length,
      totalFindingsOpen: totalOpen,
      totalFindingsCritical: totalCritical,
      totalFindingsHigh: totalHigh,
      lastScanDate: latestScan?.createdAt ? new Date(latestScan.createdAt).toISOString() : null,
      lastScanStatus: latestScan?.status ?? "unknown",
      environments,
    });
  }

  repos.sort((a, b) => {
    if (b.totalFindingsCritical !== a.totalFindingsCritical) return b.totalFindingsCritical - a.totalFindingsCritical;
    if (b.totalFindingsHigh !== a.totalFindingsHigh) return b.totalFindingsHigh - a.totalFindingsHigh;
    if (b.totalFindingsOpen !== a.totalFindingsOpen) return b.totalFindingsOpen - a.totalFindingsOpen;
    return b.totalScans - a.totalScans;
  });

  return {
    totalRepos: repos.length,
    totalScans: scanRows.length,
    totalFindingsOpen: repos.reduce((s, r) => s + r.totalFindingsOpen, 0),
    repos,
  };
}
