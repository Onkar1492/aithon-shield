import { FindingsTable } from "@/components/FindingsTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GlobalFixDialog } from "@/components/GlobalFixDialog";
import { GlobalFixProgressDialog } from "@/components/GlobalFixProgressDialog";
import { Search, Zap, Layers, Archive, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Finding } from "@shared/schema";
import { isFindingResolved } from "@/lib/findings";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FindingCluster {
  fingerprint: string;
  canonical: Finding & { fixConfidence?: unknown };
  duplicates: (Finding & { fixConfidence?: unknown })[];
  totalCount: number;
  scanTypes: string[];
  severities: string[];
  firstSeen: string;
  lastSeen: string;
}

interface DuplicatesSummary {
  totalFindings: number;
  uniqueClusters: number;
  duplicateCount: number;
  clusters: FindingCluster[];
}

// Priority tier — driven by severity
function getPriorityTier(severity: string | null | undefined): string {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical") return "P1";
  if (s === "high")     return "P2";
  if (s === "medium")   return "P3";
  if (s === "low")      return "P4";
  return "P5";
}

function severityColor(sev: string): string {
  const s = sev.toUpperCase();
  if (s === "CRITICAL") return "destructive";
  if (s === "HIGH") return "destructive";
  if (s === "MEDIUM") return "default";
  return "secondary";
}

export default function Findings() {
  const [location, setLocation] = useLocation();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [scaReach, setScaReach] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalFixOpen, setGlobalFixOpen] = useState(false);
  const [globalFixJobId, setGlobalFixJobId] = useState<string | null>(null);
  const [globalFixProgressOpen, setGlobalFixProgressOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const searchParams = location.split("?")[1] ?? "";
    const params = new URLSearchParams(searchParams);
    const severityParam = params.get("severity");
    const statusParam = params.get("status");
    const priorityParam = params.get("priority");
    const scaReachParam = params.get("scaReach");
    const searchParam = params.get("search");
    
    // Reset to defaults when parameters are absent
    setSeverity(severityParam || "all");
    setStatus(statusParam || "all");
    setPriority(priorityParam || "all");
    setScaReach(scaReachParam || "all");
    setSearchQuery(searchParam || "");
  }, [location]);

  // Update URL when filters change
  const updateURL = (
    newSeverity?: string,
    newStatus?: string,
    newPriority?: string,
    newSearch?: string,
    newScaReach?: string,
  ) => {
    const params = new URLSearchParams();
    const sev = newSeverity !== undefined ? newSeverity : severity;
    const stat = newStatus !== undefined ? newStatus : status;
    const pri = newPriority !== undefined ? newPriority : priority;
    const search = newSearch !== undefined ? newSearch : searchQuery;
    const reach = newScaReach !== undefined ? newScaReach : scaReach;

    if (sev !== "all") params.set("severity", sev);
    if (stat !== "all") params.set("status", stat);
    if (pri !== "all") params.set("priority", pri);
    if (reach !== "all") params.set("scaReach", reach);
    if (search) params.set("search", search);

    const queryString = params.toString();
    setLocation(`/findings${queryString ? `?${queryString}` : ""}`);
  };

  const handleSeverityChange = (value: string) => {
    setSeverity(value);
    updateURL(value, undefined, undefined, undefined, undefined);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateURL(undefined, value, undefined, undefined, undefined);
  };

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    updateURL(undefined, undefined, value, undefined, undefined);
  };

  const handleScaReachChange = (value: string) => {
    setScaReach(value);
    updateURL(undefined, undefined, undefined, undefined, value);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value === "") {
      updateURL(undefined, undefined, undefined, "", undefined);
    }
  };

  const { data: findings, isLoading } = useQuery<Finding[]>({
    queryKey: ["/api/findings"],
  });

  const { data: duplicatesData, isLoading: isLoadingDuplicates } = useQuery<DuplicatesSummary>({
    queryKey: ["/api/findings/duplicates"],
    enabled: activeTab === "duplicates",
  });

  const dismissDuplicatesMutation = useMutation({
    mutationFn: async (fingerprint: string) => {
      const res = await apiRequest("POST", `/api/findings/clusters/${fingerprint}/dismiss-duplicates`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Duplicates dismissed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/findings/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleCluster = (fp: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  };

  const handleGlobalFixSuccess = (jobId: string) => {
    setGlobalFixJobId(jobId);
    setGlobalFixProgressOpen(true);
  };

  // Count unresolved findings
  const unresolvedFindings = findings?.filter(f => !isFindingResolved(f)) || [];
  const hasUnresolvedIssues = unresolvedFindings.length > 0;

  const filteredFindings = findings?.filter((finding) => {
    const scanName = (finding as any).scanName || "";
    const matchesSearch = finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scanName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severity === "all" || finding.severity.toLowerCase() === severity.toLowerCase();
    const matchesStatus = status === "all" || finding.status.toLowerCase() === status.toLowerCase();
    const findingPriorityTier = getPriorityTier(finding.severity);
    const matchesPriority = priority === "all" || findingPriorityTier === priority;
    const reach = finding.scaReachability;
    const matchesScaReach =
      scaReach === "all" ||
      (scaReach === "none" && !reach) ||
      (scaReach !== "none" && reach === scaReach);
    return matchesSearch && matchesSeverity && matchesStatus && matchesPriority && matchesScaReach;
  }) || [];

  const dupCount = duplicatesData?.duplicateCount ?? 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Security Findings</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          View and manage all security vulnerabilities
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Findings</TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-2">
            <Layers className="h-4 w-4" />
            Duplicates
            {dupCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {dupCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search findings or scan name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                data-testid="input-search-findings"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <Select value={severity} onValueChange={handleSeverityChange}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="P1">P1 — Critical (85-100)</SelectItem>
                  <SelectItem value="P2">P2 — High (70-84)</SelectItem>
                  <SelectItem value="P3">P3 — Medium (50-69)</SelectItem>
                  <SelectItem value="P4">P4 — Low (25-49)</SelectItem>
                  <SelectItem value="P5">P5 — Minimal (0-24)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={scaReach} onValueChange={handleScaReachChange}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-sca-reach">
                  <SelectValue placeholder="SCA reachability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (SCA reach)</SelectItem>
                  <SelectItem value="import_referenced">SCA: import referenced</SelectItem>
                  <SelectItem value="no_import_match">SCA: no import match</SelectItem>
                  <SelectItem value="not_analyzed">SCA: not analyzed</SelectItem>
                  <SelectItem value="none">No SCA reach tag</SelectItem>
                </SelectContent>
              </Select>
              {hasUnresolvedIssues && (
                <Button
                  size="default"
                  onClick={() => setGlobalFixOpen(true)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white whitespace-nowrap"
                  data-testid="button-fix-all-findings"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Fix All ({unresolvedFindings.length})
                </Button>
              )}
            </div>
          </div>

          <GlobalFixDialog
            open={globalFixOpen}
            onOpenChange={setGlobalFixOpen}
            onSuccess={handleGlobalFixSuccess}
          />
          {globalFixJobId && (
            <GlobalFixProgressDialog
              open={globalFixProgressOpen}
              onOpenChange={setGlobalFixProgressOpen}
              jobId={globalFixJobId}
            />
          )}

          <FindingsTable findings={filteredFindings} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4 mt-4">
          {isLoadingDuplicates ? (
            <p className="text-muted-foreground text-sm">Loading duplicate clusters...</p>
          ) : !duplicatesData || duplicatesData.clusters.length === 0 ? (
            <Card className="p-8 text-center">
              <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-lg">No duplicates detected</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                All findings are unique. When the same vulnerability is detected across multiple scans,
                clusters will appear here so you can dismiss the duplicates.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span><strong className="text-foreground">{duplicatesData.uniqueClusters}</strong> cluster{duplicatesData.uniqueClusters !== 1 ? "s" : ""}</span>
                <span><strong className="text-foreground">{duplicatesData.duplicateCount}</strong> duplicate finding{duplicatesData.duplicateCount !== 1 ? "s" : ""} can be dismissed</span>
                <span><strong className="text-foreground">{duplicatesData.totalFindings}</strong> total findings in clusters</span>
              </div>

              <div className="space-y-3">
                {duplicatesData.clusters.map((cluster) => {
                  const isExpanded = expandedClusters.has(cluster.fingerprint);
                  return (
                    <Card key={cluster.fingerprint} className="overflow-hidden">
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCluster(cluster.fingerprint)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{cluster.canonical.title}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {cluster.totalCount} finding{cluster.totalCount !== 1 ? "s" : ""}
                            </Badge>
                            {cluster.severities.map((sev) => (
                              <Badge key={sev} variant={severityColor(sev) as any} className="text-xs">
                                {sev}
                              </Badge>
                            ))}
                            {cluster.scanTypes.map((st) => (
                              <Badge key={st} variant="secondary" className="text-xs">
                                {st}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            CWE-{cluster.canonical.cwe} · {cluster.canonical.category} · First seen {new Date(cluster.firstSeen).toLocaleDateString()} · Last seen {new Date(cluster.lastSeen).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissDuplicatesMutation.mutate(cluster.fingerprint);
                          }}
                          disabled={dismissDuplicatesMutation.isPending}
                        >
                          <Archive className="h-3.5 w-3.5 mr-1.5" />
                          Dismiss {cluster.duplicates.length} duplicate{cluster.duplicates.length !== 1 ? "s" : ""}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Canonical (kept)
                          </div>
                          <div className="flex items-center gap-2 text-sm p-2 rounded bg-background border">
                            <Badge variant={severityColor(cluster.canonical.severity) as any} className="text-xs">
                              {cluster.canonical.severity}
                            </Badge>
                            <span className="truncate flex-1">{cluster.canonical.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {cluster.canonical.scanType} · {cluster.canonical.status}
                            </span>
                          </div>

                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3 mb-2">
                            Duplicates ({cluster.duplicates.length})
                          </div>
                          {cluster.duplicates.map((dup) => (
                            <div key={dup.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background border border-dashed opacity-75">
                              <Badge variant={severityColor(dup.severity) as any} className="text-xs">
                                {dup.severity}
                              </Badge>
                              <span className="truncate flex-1">{dup.title}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {dup.scanType} · {dup.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
