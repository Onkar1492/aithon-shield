import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  AlertTriangle,
  ShieldAlert,
  FolderGit2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ScanSearch,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface EnvironmentBreakdown {
  branch: string;
  scanCount: number;
  lastScanDate: string | null;
  lastScanStatus: string;
  findingsOpen: number;
  findingsCritical: number;
  findingsHigh: number;
}

interface RepoSummary {
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

interface MultiRepoSummary {
  totalRepos: number;
  totalScans: number;
  totalFindingsOpen: number;
  repos: RepoSummary[];
}

function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === "failed") return <XCircle className="h-4 w-4 text-red-500" />;
  if (s === "in_progress" || s === "running" || s === "scanning") return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ReposDashboard() {
  const [, setLocation] = useLocation();
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<MultiRepoSummary>({
    queryKey: ["/api/repo-environment-summary"],
  });

  const toggleRepo = (key: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Repositories &amp; Environments</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Cross-repo, cross-environment security overview — every project and branch in one place.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading repository summary...
        </div>
      ) : !data || data.repos.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderGit2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">No repositories or apps yet</h3>
          <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
            Run your first scan (MVP Code Scan, Mobile App Scan, or Web App Scan) and your
            projects will appear here grouped by repository and branch.
          </p>
          <Button className="mt-4" onClick={() => setLocation("/")}>
            Go to Dashboard
          </Button>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderGit2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalRepos}</p>
                <p className="text-xs text-muted-foreground">Repositories / Apps</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ScanSearch className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalScans}</p>
                <p className="text-xs text-muted-foreground">Total Scans</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalFindingsOpen}</p>
                <p className="text-xs text-muted-foreground">Open Findings</p>
              </div>
            </Card>
          </div>

          {/* Repo cards */}
          <div className="space-y-3">
            {data.repos.map((repo) => {
              const isExpanded = expandedRepos.has(repo.repoKey);
              return (
                <Card key={repo.repoKey} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleRepo(repo.repoKey)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    <FolderGit2 className="h-5 w-5 text-primary shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{repo.displayName}</span>
                        {repo.scanTypes.map((st) => (
                          <Badge key={st} variant="secondary" className="text-xs">
                            {st}
                          </Badge>
                        ))}
                        <Badge variant="outline" className="text-xs">
                          {repo.environments.length} branch{repo.environments.length !== 1 ? "es" : ""}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {repo.totalScans} scan{repo.totalScans !== 1 ? "s" : ""} · Last scanned {timeAgo(repo.lastScanDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {repo.totalFindingsCritical > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {repo.totalFindingsCritical} critical
                        </Badge>
                      )}
                      {repo.totalFindingsHigh > 0 && (
                        <Badge className="text-xs gap-1 bg-orange-600 hover:bg-orange-700 text-white">
                          <ShieldAlert className="h-3 w-3" />
                          {repo.totalFindingsHigh} high
                        </Badge>
                      )}
                      <Badge
                        variant={repo.totalFindingsOpen === 0 ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {repo.totalFindingsOpen} open
                      </Badge>
                      <StatusIcon status={repo.lastScanStatus} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                      {repo.repoUrl && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate">{repo.repoUrl}</span>
                        </div>
                      )}

                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Branches / Environments
                      </div>

                      <div className="space-y-2">
                        {repo.environments.map((env) => (
                          <div
                            key={env.branch}
                            className="flex items-center gap-3 p-3 rounded-md bg-background border text-sm"
                          >
                            <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{env.branch}</span>
                              <span className="text-muted-foreground ml-2">
                                · {env.scanCount} scan{env.scanCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {env.findingsCritical > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {env.findingsCritical} critical
                                </Badge>
                              )}
                              {env.findingsHigh > 0 && (
                                <Badge variant="destructive" className="text-xs bg-orange-600">
                                  {env.findingsHigh} high
                                </Badge>
                              )}
                              <Badge
                                variant={env.findingsOpen === 0 ? "secondary" : "outline"}
                                className="text-xs"
                              >
                                {env.findingsOpen} open
                              </Badge>
                              <StatusIcon status={env.lastScanStatus} />
                              <span className="text-xs text-muted-foreground">
                                {timeAgo(env.lastScanDate)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
