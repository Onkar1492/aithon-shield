import { useState } from "react";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge } from "./SeverityBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Sparkles, RotateCw, MoreVertical, AlertTriangle, Archive, Scale, Undo2, Ticket } from "lucide-react";

// Priority tier — driven by severity
function getPriorityTier(severity: string | null | undefined): string {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical") return "P1";
  if (s === "high")     return "P2";
  if (s === "medium")   return "P3";
  if (s === "low")      return "P4";
  return "P5";
}

function getPriorityLabel(tier: string): string {
  switch (tier) {
    case "P1": return "Critical";
    case "P2": return "High";
    case "P3": return "Medium";
    case "P4": return "Low";
    case "P5": return "Minimal";
    default: return tier;
  }
}

function getPriorityColor(tier: string): string {
  switch (tier) {
    case "P1": return "bg-red-500/15 text-red-500 border-red-500/40";
    case "P2": return "bg-orange-500/15 text-orange-500 border-orange-500/40";
    case "P3": return "bg-yellow-500/15 text-yellow-600 border-yellow-500/40";
    case "P4": return "bg-blue-500/15 text-blue-500 border-blue-500/40";
    default:   return "bg-muted text-muted-foreground border-border";
  }
}

// Helper function to check if finding is "Fix This First"
function isFixThisFirst(priorityScore: number, severity: string, exploitabilityScore: number): boolean {
  return priorityScore >= 85 || (severity === "Critical" && exploitabilityScore >= 80);
}

function isRiskAccepted(finding: { status?: string | null }): boolean {
  return (finding.status ?? "").toLowerCase() === "accepted-risk";
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RemediationDialog } from "./RemediationDialog";
import type { Finding } from "@shared/schema";
import type { FixConfidencePayload } from "@shared/fixConfidence";
import { getFixConfidenceForFinding } from "@/lib/fixConfidenceDisplay";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isFindingResolved } from "@/lib/findings";
import { formatScaReachabilityLabel } from "@shared/scaReachability";
import { AcceptRiskDialog } from "./AcceptRiskDialog";
import { UploadCloud } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** API responses include `fixConfidence`; DB row type does not. */
type FindingRow = Finding & {
  fixConfidence?: FixConfidencePayload;
  fpSuppression?: { score: number; label: string; verdict?: string };
};

interface FindingsTableProps {
  findings: FindingRow[];
  isLoading: boolean;
}

type TrackerConnectionsPayload = {
  jira: { connected: boolean };
  linear: { connected: boolean };
};

const TRACKER_DISCONNECTED: TrackerConnectionsPayload = {
  jira: { connected: false },
  linear: { connected: false },
};

export function FindingsTable({ findings, isLoading }: FindingsTableProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<FindingRow | null>(null);
  const [acceptRiskFinding, setAcceptRiskFinding] = useState<FindingRow | null>(null);

  /** Session-only API: use throwOnError false so the ⋮ menu still shows tracker actions (with Settings hint if load fails). */
  const { data: trackerStatus } = useQuery<TrackerConnectionsPayload>({
    queryKey: ["/api/tracker-connections"],
    retry: false,
    throwOnError: false,
    placeholderData: TRACKER_DISCONNECTED,
  });

  const tracker = trackerStatus ?? TRACKER_DISCONNECTED;

  const fpFeedbackMutation = useMutation({
    mutationFn: async (payload: { findingId: string; verdict: "likely_fp" | "true_positive" }) => {
      const res = await apiRequest("POST", `/api/findings/${payload.findingId}/fp-feedback`, { verdict: payload.verdict });
      return res.json() as Promise<{ ok: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({ title: "Feedback saved", description: "False-positive signal updated for this fingerprint." });
    },
    onError: (e: any) => {
      toast({ title: "Could not save", description: e?.message ?? "Try again", variant: "destructive" });
    },
  });

  const trackerIssueMutation = useMutation({
    mutationFn: async (payload: { findingId: string; provider: "jira" | "linear" }) => {
      const res = await apiRequest("POST", `/api/findings/${payload.findingId}/tracker-issue`, {
        provider: payload.provider,
      });
      return res.json() as Promise<{ url: string; key: string; provider: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({
        title: "Tracker issue created",
        description: `${data.key} — open the link from your ${data.provider === "linear" ? "Linear" : "Jira"} workspace.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Tracker issue failed", description: e.message, variant: "destructive" });
    },
  });

  const rescanMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("POST", `/api/findings/${findingId}/rescan`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({
        title: "Re-scan initiated",
        description: "The finding is being re-scanned for updated security analysis",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate re-scan",
        variant: "destructive",
      });
    },
  });

  const revokeRiskMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("POST", "/api/risk-exceptions/revoke-by-finding", { findingId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk-exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sla/summary"] });
      toast({
        title: "Risk acceptance revoked",
        description: "The finding is open again for remediation tracking.",
      });
    },
    onError: (e: Error) => {
      toast({
        title: "Could not revoke",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("POST", `/api/findings/${findingId}/archive`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings/archived"] });
      toast({
        title: "Finding archived",
        description: "The finding has been moved to the archive",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive finding",
        variant: "destructive",
      });
    },
  });

  const handleArchive = (findingId: string) => {
    archiveMutation.mutate(findingId);
  };

  const handleOpenRemediation = (finding: FindingRow) => {
    setSelectedFinding(finding);
    setRemediationOpen(true);
  };

  const handleRescan = (findingId: string) => {
    rescanMutation.mutate(findingId);
  };

  const handleViewDetails = (finding: FindingRow) => {
    // Open the remediation dialog to view all details
    handleOpenRemediation(finding);
  };

  const handleApplyFix = () => {
    // Invalidate the findings query to refresh the list
    queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading findings...</div>;
  }

  if (findings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No findings match your current filters.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border" data-testid="table-findings">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Scan/Project</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Risk Score</TableHead>
              <TableHead>Fix confidence</TableHead>
              <TableHead>SCA reach</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>CWE</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding: FindingRow) => {
              const fixConfidence = getFixConfidenceForFinding(finding);
              const priorityScore = finding.priorityScore || 0;
              const priorityTier = getPriorityTier(finding.severity);
              const showFixFirst = isFixThisFirst(priorityScore, finding.severity, finding.exploitabilityScore || 0);
              
              return (
                <TableRow key={finding.id} className="hover-elevate">
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold ${getPriorityColor(priorityTier)}`}
                          data-testid={`badge-priority-${finding.id}`}
                        >
                          {priorityTier}
                        </span>
                        <span className="text-xs text-muted-foreground">{getPriorityLabel(priorityTier)}</span>
                      </div>
                      {showFixFirst && (
                        <Badge 
                          variant="destructive" 
                          className="text-xs gap-1 w-fit"
                          data-testid={`badge-fix-first-${finding.id}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Fix This First
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{finding.title}</span>
                      {finding.fpSuppression?.label === "user_marks_likely_fp" && (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800 dark:text-amber-200">
                          Likely FP
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" data-testid={`scan-name-${finding.id}`}>
                    {(finding as any).scanName || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={finding.severity.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} showIcon={false} />
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className="font-semibold border-primary/40 text-primary"
                    >
                      {finding.riskScore}/10
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="tabular-nums font-semibold cursor-help border-primary/30"
                          data-testid={`fix-confidence-${finding.id}`}
                        >
                          {fixConfidence.score}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-xs font-medium capitalize">
                          Side-effect risk: {fixConfidence.sideEffectRisk}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {fixConfidence.explainability}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[140px]">
                    {finding.category === "Supply Chain Risk" ? (
                      <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600 dark:text-orange-400 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Supply Chain
                      </Badge>
                    ) : finding.category === "Dependency Vulnerability" && finding.scaReachability ? (
                      <span className="line-clamp-2" title={formatScaReachabilityLabel(finding.scaReachability) ?? ""}>
                        {formatScaReachabilityLabel(finding.scaReachability)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                <TableCell className="font-mono text-sm">{finding.asset}</TableCell>
                <TableCell className="font-mono text-sm">
                  {finding.cwe ? (
                    <a href={`/learn?cwe=${finding.cwe}`} className="text-primary hover:underline" title="Learn about this vulnerability">
                      {finding.cwe}
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{finding.detected}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{finding.status}</span>
                    {finding.trackerIssueUrl && (
                      <a
                        href={finding.trackerIssueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline"
                        data-testid={`link-tracker-issue-${finding.id}`}
                      >
                        <Ticket className="w-3 h-3" />
                        {finding.trackerIssueKey ?? "Ticket"}
                      </a>
                    )}
                    {isFindingResolved(finding) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`icon-reupload-reminder-${finding.id}`}
                          >
                            <UploadCloud className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            Fix applied. Deploy the updated build to your app destination to activate the change.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Fix / re-scan when not resolved and not risk-accepted */}
                    {!isFindingResolved(finding) && !isRiskAccepted(finding) && (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-fix-${finding.id}`}
                            >
                              <Sparkles className="w-4 h-4 mr-1" />
                              Fix
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenRemediation(finding)}
                              data-testid={`menu-ai-remediation-${finding.id}`}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI Remediation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRescan(finding.id)}
                          disabled={rescanMutation.isPending}
                          data-testid={`button-rescan-${finding.id}`}
                        >
                          <RotateCw className={`w-4 h-4 ${rescanMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      </>
                    )}
                    {!isFindingResolved(finding) && isRiskAccepted(finding) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeRiskMutation.mutate(finding.id)}
                        disabled={revokeRiskMutation.isPending}
                        data-testid={`button-revoke-risk-${finding.id}`}
                      >
                        <Undo2 className="w-4 h-4 mr-1" />
                        Revoke acceptance
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-more-actions-${finding.id}`}
                          aria-label="More actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleViewDetails(finding)}
                          data-testid={`menu-view-details-${finding.id}`}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {!isFindingResolved(finding) && !isRiskAccepted(finding) && (
                          <DropdownMenuItem
                            onClick={() => setAcceptRiskFinding(finding)}
                            data-testid={`menu-accept-risk-${finding.id}`}
                          >
                            <Scale className="w-4 h-4 mr-2" />
                            Accept risk
                          </DropdownMenuItem>
                        )}
                        {!finding.trackerIssueUrl && !isFindingResolved(finding) && !isRiskAccepted(finding) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (!tracker.jira.connected) {
                                  toast({
                                    title: "Connect Jira first",
                                    description: "Open Settings → Issue trackers (Jira / Linear) and save your Jira Cloud credentials.",
                                  });
                                  setLocation("/settings");
                                  return;
                                }
                                trackerIssueMutation.mutate({ findingId: finding.id, provider: "jira" });
                              }}
                              disabled={trackerIssueMutation.isPending}
                              data-testid={`menu-create-jira-${finding.id}`}
                            >
                              <Ticket className="w-4 h-4 mr-2" />
                              Create Jira issue
                              {!tracker.jira.connected && (
                                <span className="ml-auto text-xs text-muted-foreground pl-2">Setup</span>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (!tracker.linear.connected) {
                                  toast({
                                    title: "Connect Linear first",
                                    description: "Open Settings → Issue trackers (Jira / Linear) and save your Linear API key and team id.",
                                  });
                                  setLocation("/settings");
                                  return;
                                }
                                trackerIssueMutation.mutate({ findingId: finding.id, provider: "linear" });
                              }}
                              disabled={trackerIssueMutation.isPending}
                              data-testid={`menu-create-linear-${finding.id}`}
                            >
                              <Ticket className="w-4 h-4 mr-2" />
                              Create Linear issue
                              {!tracker.linear.connected && (
                                <span className="ml-auto text-xs text-muted-foreground pl-2">Setup</span>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                        {!isFindingResolved(finding) && !isRiskAccepted(finding) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => fpFeedbackMutation.mutate({ findingId: finding.id, verdict: "likely_fp" })}
                              disabled={fpFeedbackMutation.isPending}
                            >
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Mark likely false positive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => fpFeedbackMutation.mutate({ findingId: finding.id, verdict: "true_positive" })}
                              disabled={fpFeedbackMutation.isPending}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Confirm true positive
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleArchive(finding.id)}
                          disabled={archiveMutation.isPending}
                          data-testid={`menu-archive-${finding.id}`}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedFinding && (
        <RemediationDialog
          open={remediationOpen}
          onOpenChange={setRemediationOpen}
          findingTitle={selectedFinding.title}
          severity={selectedFinding.severity}
          findingId={selectedFinding.id}
          fixesApplied={selectedFinding.fixesApplied || undefined}
          status={selectedFinding.status || undefined}
          onApplyFix={handleApplyFix}
          fixConfidence={getFixConfidenceForFinding(selectedFinding)}
          category={selectedFinding.category}
          scaReachability={selectedFinding.scaReachability}
        />
      )}
      {acceptRiskFinding && (
        <AcceptRiskDialog
          open={!!acceptRiskFinding}
          onOpenChange={(o) => !o && setAcceptRiskFinding(null)}
          findingId={acceptRiskFinding.id}
          findingTitle={acceptRiskFinding.title}
        />
      )}
    </TooltipProvider>
  );
}
