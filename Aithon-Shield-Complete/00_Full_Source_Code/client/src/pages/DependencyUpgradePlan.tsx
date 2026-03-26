import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Search,
  ArrowUpDown,
  Loader2,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

interface DependencyInfo {
  name: string;
  currentVersion: string;
  ecosystem: string;
  purl: string | null;
  manifestFile: string | null;
}

interface UpgradeRecommendation {
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

interface UpgradePlan {
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

const urgencyColors: Record<string, string> = {
  critical: "bg-red-600 hover:bg-red-700 text-white",
  high: "bg-orange-600 hover:bg-orange-700 text-white",
  medium: "bg-yellow-600 hover:bg-yellow-700 text-white",
  low: "bg-blue-600 hover:bg-blue-700 text-white",
};

const severityBadge: Record<string, string> = {
  CRITICAL: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severityBadge[severity.toUpperCase()] ?? "outline";
  return (
    <Badge variant={variant as any} className="text-xs">
      {severity}
    </Badge>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <Badge className={`text-xs ${urgencyColors[urgency] ?? ""}`}>
      {urgency.toUpperCase()} priority
    </Badge>
  );
}

function ReachabilityBadge({ value }: { value: string | null }) {
  if (!value) return null;
  if (value === "import_referenced") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <ExternalLink className="h-3 w-3" />
        Import referenced
      </Badge>
    );
  }
  if (value === "no_import_match") {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        No import match
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      Not analyzed
    </Badge>
  );
}

type SortField = "urgency" | "severity" | "vulns" | "name";

export default function DependencyUpgradePlan() {
  const [, params] = useRoute("/scans/mvp/:id/upgrade-plan");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const scanId = params?.id;

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [showSafe, setShowSafe] = useState(false);

  const { data: plan, isLoading, error } = useQuery<UpgradePlan>({
    queryKey: [`/api/mvp-scans/${scanId}/upgrade-plan`],
    enabled: !!scanId,
  });

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast({ title: "Copied", description: "Upgrade command copied to clipboard" });
  };

  if (!scanId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No scan ID provided.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Building upgrade plan...</span>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/scan-details/mvp/${scanId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to scan
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p>Could not load upgrade plan. This scan may not have SBOM or SCA data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  let filtered = plan.recommendations.filter((r) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      r.dependency.name.toLowerCase().includes(q) ||
      r.dependency.ecosystem.toLowerCase().includes(q) ||
      r.cves.some((c) => c.toLowerCase().includes(q))
    );
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortField === "urgency") {
      return (urgencyOrder[a.upgradeUrgency] ?? 99) - (urgencyOrder[b.upgradeUrgency] ?? 99);
    }
    if (sortField === "severity") {
      const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (sevOrder[a.highestSeverity.toUpperCase()] ?? 99) - (sevOrder[b.highestSeverity.toUpperCase()] ?? 99);
    }
    if (sortField === "vulns") return b.vulnerabilityCount - a.vulnerabilityCount;
    return a.dependency.name.localeCompare(b.dependency.name);
  });

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/scan-details/mvp/${scanId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to scan
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Dependency Upgrade Plan
          </h1>
          <p className="text-muted-foreground mt-1">
            {plan.projectName} — prioritized upgrade recommendations for vulnerable dependencies
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold">{plan.totalDependencies}</div>
              <div className="text-sm text-muted-foreground">Total dependencies</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-red-600">{plan.vulnerableDependencies}</div>
              <div className="text-sm text-muted-foreground">Vulnerable</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {plan.totalDependencies - plan.vulnerableDependencies}
              </div>
              <div className="text-sm text-muted-foreground">Safe</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {plan.summary.criticalUpgrades > 0 && (
                  <Badge variant="destructive" className="text-xs">{plan.summary.criticalUpgrades} critical</Badge>
                )}
                {plan.summary.highUpgrades > 0 && (
                  <Badge className="text-xs bg-orange-600 text-white">{plan.summary.highUpgrades} high</Badge>
                )}
                {plan.summary.mediumUpgrades > 0 && (
                  <Badge className="text-xs bg-yellow-600 text-white">{plan.summary.mediumUpgrades} medium</Badge>
                )}
                {plan.summary.lowUpgrades > 0 && (
                  <Badge variant="outline" className="text-xs">{plan.summary.lowUpgrades} low</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Upgrade priorities</div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by package name, ecosystem, or CVE..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort:</span>
            {(["urgency", "severity", "vulns", "name"] as SortField[]).map((f) => (
              <Button
                key={f}
                variant={sortField === f ? "default" : "outline"}
                size="sm"
                onClick={() => setSortField(f)}
              >
                <ArrowUpDown className="h-3 w-3 mr-1" />
                {f === "vulns" ? "Vuln count" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">No vulnerable dependencies found</p>
              <p className="text-sm mt-1">
                {searchFilter
                  ? "No results match your search. Try a different query."
                  : "All scanned dependencies appear safe."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Upgrade Recommendations ({filtered.length})
            </h2>
            {filtered.map((rec) => {
              const key = `${rec.dependency.name}@${rec.dependency.currentVersion}`;
              const isExpanded = expandedRows.has(key);
              return (
                <Card key={key} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleRow(key)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">
                          {rec.dependency.name}
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                          v{rec.dependency.currentVersion}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {rec.dependency.ecosystem}
                        </Badge>
                      </div>
                      {rec.dependency.manifestFile && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {rec.dependency.manifestFile}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <ReachabilityBadge value={rec.reachability} />
                      <UrgencyBadge urgency={rec.upgradeUrgency} />
                      <SeverityBadge severity={rec.highestSeverity} />
                      <Badge variant="outline" className="text-xs">
                        {rec.vulnerabilityCount} vuln{rec.vulnerabilityCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-muted/30 space-y-4">
                      {/* Upgrade command */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Terminal className="h-3 w-3" />
                          Upgrade command
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-background border rounded px-3 py-1.5 text-sm font-mono">
                            {rec.upgradeCommand}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCommand(rec.upgradeCommand);
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                        </div>
                      </div>

                      {/* CVEs */}
                      {rec.cves.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">CVEs</p>
                          <div className="flex flex-wrap gap-1">
                            {rec.cves.map((cve) => (
                              <Badge key={cve} variant="outline" className="text-xs font-mono">
                                {cve}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CVSS */}
                      {rec.highestCvss > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Highest CVSS:</span>
                          <Badge
                            className={`text-xs ${
                              rec.highestCvss >= 9
                                ? "bg-red-600 text-white"
                                : rec.highestCvss >= 7
                                  ? "bg-orange-600 text-white"
                                  : rec.highestCvss >= 4
                                    ? "bg-yellow-600 text-white"
                                    : ""
                            }`}
                          >
                            {rec.highestCvss.toFixed(1)}
                          </Badge>
                        </div>
                      )}

                      {/* Linked findings */}
                      {rec.findings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Related findings ({rec.findings.length})
                          </p>
                          <div className="space-y-1">
                            {rec.findings.map((f) => (
                              <div
                                key={f.id}
                                className="flex items-center gap-2 text-xs bg-background border rounded px-2 py-1"
                              >
                                <SeverityBadge severity={f.severity} />
                                <span className="truncate flex-1">{f.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {f.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Safe dependencies toggle */}
        {plan.safeDependencies.length > 0 && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSafe(!showSafe)}
              className="gap-1"
            >
              {showSafe ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <ShieldCheck className="h-4 w-4 text-green-500" />
              {plan.safeDependencies.length} safe dependencies
            </Button>

            {showSafe && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {plan.safeDependencies.map((dep) => (
                  <div
                    key={`${dep.name}@${dep.currentVersion}`}
                    className="flex items-center gap-2 border rounded px-3 py-2 text-sm"
                  >
                    <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-mono truncate">{dep.name}</span>
                    <Badge variant="outline" className="text-xs font-mono shrink-0">
                      v{dep.currentVersion}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
