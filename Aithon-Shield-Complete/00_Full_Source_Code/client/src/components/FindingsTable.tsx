import { useState } from "react";
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
import { ExternalLink, Sparkles, RotateCw, MoreVertical, AlertTriangle, Archive } from "lucide-react";

// P1-P5 priority tier — driven by severity
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RemediationDialog } from "./RemediationDialog";
import type { Finding } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { isFindingResolved } from "@/lib/findings";
import { UploadCloud } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FindingsTableProps {
  findings: Finding[];
  isLoading: boolean;
}

export function FindingsTable({ findings, isLoading }: FindingsTableProps) {
  const { toast } = useToast();
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

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

  const handleOpenRemediation = (finding: Finding) => {
    setSelectedFinding(finding);
    setRemediationOpen(true);
  };

  const handleRescan = (findingId: string) => {
    rescanMutation.mutate(findingId);
  };

  const handleViewDetails = (finding: Finding) => {
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
              <TableHead>Asset</TableHead>
              <TableHead>CWE</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding: Finding) => {
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
                  <TableCell className="font-medium">{finding.title}</TableCell>
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
                <TableCell className="font-mono text-sm">{finding.asset}</TableCell>
                <TableCell className="font-mono text-sm">{finding.cwe}</TableCell>
                <TableCell className="text-muted-foreground">{finding.detected}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{finding.status}</span>
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
                    {/* Only show Fix and Re-scan buttons if finding is NOT resolved */}
                    {!isFindingResolved(finding) && (
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
        />
      )}
    </TooltipProvider>
  );
}
