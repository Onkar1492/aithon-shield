import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Shield,
  Bug,
  Sparkles,
  Eye,
  RotateCw,
  Wrench
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Finding } from "@shared/schema";
import { isFindingResolved } from "@/lib/findings";
import { ReuploadReminder } from "@/components/ReuploadReminder";
import { FixScopeDialog } from "@/components/FixScopeDialog";
import { useFixWorkflow } from "@/hooks/useFixWorkflow";

type ScanType = "mvp" | "mobile" | "web" | "pipeline" | "container" | "network" | "linter";

interface ScanData {
  id: string;
  scanStatus: "pending" | "scanning" | "in-progress" | "completed" | "failed";
  findingsCount?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  projectName?: string;
  appName?: string;
  url?: string;
  target?: string;
  scannedAt?: string;
}

const scanTypeLabels: Record<ScanType, string> = {
  mvp: "MVP Code Scan",
  mobile: "Mobile App Scan",
  web: "Web App Scan",
  pipeline: "CI/CD Pipeline Scan",
  container: "Container Scan",
  network: "Network Scan",
  linter: "Code Linter Scan"
};

const scanTypeEndpoints: Record<ScanType, string> = {
  mvp: "/api/mvp-scans",
  mobile: "/api/mobile-scans",
  web: "/api/web-scans",
  pipeline: "/api/pipeline-scans",
  container: "/api/container-scans",
  network: "/api/network-scans",
  linter: "/api/linter-scans"
};

export default function ScanDetails() {
  const [, params] = useRoute("/scan-details/:type/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  
  const scanType = params?.type as ScanType;
  const scanId = params?.id;
  const [showRescanConfirm, setShowRescanConfirm] = useState(false);

  const isRescanSupported = scanType === "mvp" || scanType === "mobile" || scanType === "web";

  const scanPageRoutes: Record<string, string> = {
    mvp: "/mvp-scans",
    mobile: "/mobile-scans",
    web: "/web-scans",
  };

  const rescanMutation = useMutation({
    mutationFn: async () => {
      const endpoint = `${scanTypeEndpoints[scanType]}/${scanId}/scan`;
      const res = await apiRequest("POST", endpoint);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${scanTypeEndpoints[scanType]}/${scanId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({
        title: "New scan started",
        description: "The scan is now running. Results will appear as they are discovered.",
      });
      setShowRescanConfirm(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start the scan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fix workflow for linter, pipeline, network, and container scans
  const fixWorkflow = (scanType === 'linter' || scanType === 'pipeline' || scanType === 'network' || scanType === 'container') 
    ? useFixWorkflow(scanType, scanId || "", {
        onFixComplete: () => setSelectedFinding(null), // Close finding dialog after fix
      })
    : null;

  // Close finding dialog when scope or payment dialogs open
  useEffect(() => {
    if (!fixWorkflow) return;
    
    // Close finding dialog when either scope or payment dialog opens
    if (fixWorkflow.showScopeDialog || fixWorkflow.showPaymentDialog) {
      setSelectedFinding(null);
    }
  }, [fixWorkflow?.showScopeDialog, fixWorkflow?.showPaymentDialog, fixWorkflow]);

  // Fetch scan data from detail endpoint (not list) to get accurate real-time counts
  const { data: scan, isLoading: isLoadingScans } = useQuery<ScanData>({
    queryKey: [`${scanTypeEndpoints[scanType]}/${scanId}`],
    enabled: !!scanType && !!scanId,
    refetchInterval: (query) => {
      const scanData = query.state.data as ScanData | undefined;
      // Poll every 2s if scan is in progress, otherwise stop polling
      return scanData?.scanStatus === "scanning" || scanData?.scanStatus === "in-progress" || scanData?.scanStatus === "pending" ? 2000 : false;
    },
  });

  // Fetch findings related to this scan
  const { data: allFindings = [] } = useQuery<Finding[]>({
    queryKey: ["/api/findings"],
    // Poll for new findings if scan is still in progress
    refetchInterval: scan?.scanStatus === "scanning" || scan?.scanStatus === "in-progress" || scan?.scanStatus === "pending" ? 2000 : false,
  });

  // Filter findings for this specific scan
  const scanFindings = allFindings.filter(f => {
    if (scanType === "mvp") return f.source === "mvp-scan" && f.mvpScanId === scanId;
    if (scanType === "mobile") return f.source === "mobile-scan" && f.mobileScanId === scanId;
    if (scanType === "web") return f.source === "web-scan" && f.webScanId === scanId;
    if (scanType === "pipeline") return f.source === "pipeline-scan" && f.pipelineScanId === scanId;
    if (scanType === "container") return f.source === "container-scan" && f.containerScanId === scanId;
    if (scanType === "network") return f.source === "network-scan" && f.networkScanId === scanId;
    if (scanType === "linter") return f.source === "linter-scan" && f.linterScanId === scanId;
    return false;
  });

  // Apply fix mutation
  const applyFixMutation = useMutation({
    mutationFn: async (findingId: string) => {
      return apiRequest("PATCH", `/api/findings/${findingId}`, {
        status: "resolved"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({
        title: "Fix Applied",
        description: "The suggested fix has been applied and the finding is marked as resolved.",
      });
      setSelectedFinding(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply fix. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!scanType || !scanId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Invalid scan details</p>
      </div>
    );
  }

  if (isLoadingScans) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <XCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Scan not found</p>
        <Button onClick={() => setLocation("/scans")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scans
        </Button>
      </div>
    );
  }

  const getScanName = () => {
    if (scan.projectName) return scan.projectName;
    if (scan.appName) return scan.appName;
    if (scan.url) return scan.url;
    if (scan.target) return scan.target;
    return "Unnamed Scan";
  };

  const getProgressPercentage = () => {
    if (scan.scanStatus === "completed") return 100;
    if (scan.scanStatus === "failed") return 100;
    if (scan.scanStatus === "scanning" || scan.scanStatus === "in-progress") return 65;
    return 10;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-red-500 border-red-500/50";
      case "HIGH": return "text-orange-500 border-orange-500/50";
      case "MEDIUM": return "text-yellow-500 border-yellow-500/50";
      case "LOW": return "text-gray-500 border-gray-500/50";
      default: return "text-gray-500 border-gray-500/50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/scans")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{scanTypeLabels[scanType]}</h1>
            <p className="text-muted-foreground mt-1">{getScanName()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={
              scan.scanStatus === "completed" 
                ? "default" 
                : scan.scanStatus === "failed" 
                ? "destructive" 
                : "secondary"
            }
            className="text-sm"
            data-testid="badge-scan-status"
          >
            {(scan.scanStatus === "scanning" || scan.scanStatus === "in-progress") && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {scan.scanStatus === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {scan.scanStatus === "failed" && <XCircle className="w-3 h-3 mr-1" />}
            {scan.scanStatus === "pending" && <Clock className="w-3 h-3 mr-1" />}
            {scan.scanStatus === "scanning" ? "Scanning" : scan.scanStatus.charAt(0).toUpperCase() + scan.scanStatus.slice(1).replace("-", " ")}
          </Badge>
          {isRescanSupported && scan.scanStatus === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRescanConfirm(true)}
              data-testid="button-run-new-scan"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Run New Scan
            </Button>
          )}
          {isRescanSupported && scanFindings.length > 0 && scan.scanStatus === "completed" && (
            <Button
              size="sm"
              onClick={() => setLocation(`${scanPageRoutes[scanType]}/${scanId}`)}
              data-testid="button-fix-workflow"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Fix & Upload Workflow
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Scan Progress</h3>
            <span className="text-sm text-muted-foreground">
              {getProgressPercentage()}%
            </span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
          {(scan.scanStatus === "scanning" || scan.scanStatus === "in-progress") && (
            <p className="text-sm text-muted-foreground">
              Scanning in progress... Findings will appear below as they are discovered.
            </p>
          )}
          {scan.scanStatus === "completed" && (
            <p className="text-sm text-muted-foreground">
              Scan completed. Found {scan.findingsCount || 0} issue{(scan.findingsCount || 0) !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Bug className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{scan.criticalCount || 0}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{scan.highCount || 0}</div>
              <div className="text-xs text-muted-foreground">High</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{scan.mediumCount || 0}</div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{scan.lowCount || 0}</div>
              <div className="text-xs text-muted-foreground">Low</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Findings {scanFindings.length > 0 && `(${scanFindings.length})`}
        </h2>
        
        {scanFindings.length === 0 ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              {scan.scanStatus === "in-progress" || scan.scanStatus === "pending" 
                ? "No findings yet. The scan is still in progress..." 
                : "No security issues found. Great job!"}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {scanFindings
              .sort((a, b) => {
                const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                return (severityOrder[a.severity as keyof typeof severityOrder] || 4) - 
                       (severityOrder[b.severity as keyof typeof severityOrder] || 4);
              })
              .map((finding) => (
                <Card 
                  key={finding.id} 
                  className="p-4 hover-elevate cursor-pointer"
                  onClick={() => setSelectedFinding(finding)}
                  data-testid={`finding-${finding.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`text-xs ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {finding.category}
                        </Badge>
                        {finding.status === "resolved" && (
                          <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold mb-1">{finding.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {finding.description}
                      </p>
                      {finding.location && (
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          {finding.location}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" data-testid={`button-view-${finding.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Action Banner - Fix & Upload Workflow */}
      {isRescanSupported && scanFindings.length > 0 && scan.scanStatus === "completed" && (
        <Card className="p-6 border-primary/30 bg-primary/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Ready to fix these issues?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use the full fix workflow to apply manual or automated fixes, validate them, and upload the corrected version back to your original destination.
              </p>
            </div>
            <Button
              onClick={() => setLocation(`${scanPageRoutes[scanType]}/${scanId}`)}
              data-testid="button-fix-workflow-banner"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Open Fix & Upload Workflow
            </Button>
          </div>
        </Card>
      )}

      {/* Rescan Confirmation Dialog */}
      <AlertDialog open={showRescanConfirm} onOpenChange={setShowRescanConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run a New Scan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run a fresh security scan on this project. New findings will replace the current results. The scan may take a few moments to complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-rescan">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending}
              data-testid="button-confirm-rescan"
            >
              {rescanMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Scan...
                </>
              ) : (
                <>
                  <RotateCw className="w-4 h-4 mr-2" />
                  Run Scan Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finding Details Dialog */}
      <Dialog open={!!selectedFinding} onOpenChange={() => setSelectedFinding(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-finding-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-500" />
              {selectedFinding?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedFinding?.category} - {selectedFinding?.severity} Severity
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Severity and Status */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getSeverityColor(selectedFinding?.severity || "")}>
                {selectedFinding?.severity}
              </Badge>
              <Badge variant="secondary">{selectedFinding?.category}</Badge>
              {selectedFinding?.cwe && (
                <Badge variant="outline" className="text-xs">
                  CWE-{selectedFinding.cwe}
                </Badge>
              )}
              {selectedFinding?.status === "resolved" && (
                <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                  Resolved
                </Badge>
              )}
            </div>

            {/* Description */}
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{selectedFinding?.description}</p>
            </div>

            {/* Location */}
            {selectedFinding?.location && (
              <div>
                <h4 className="font-semibold mb-2">Location</h4>
                <code className="block p-3 bg-muted rounded-md text-sm font-mono">
                  {selectedFinding.location}
                </code>
              </div>
            )}

            {/* AI-Powered Fix Suggestion */}
            {selectedFinding?.aiSuggestion && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold">AI-Powered Fix Suggestion</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{selectedFinding.aiSuggestion}</p>
                {!isFindingResolved(selectedFinding) ? (
                  <Button
                    onClick={() => {
                      if ((scanType === 'linter' || scanType === 'pipeline' || scanType === 'network' || scanType === 'container') && fixWorkflow) {
                        fixWorkflow.beginFix(selectedFinding);
                        // Don't close finding dialog - scope dialog will handle this
                      } else {
                        applyFixMutation.mutate(selectedFinding.id);
                      }
                    }}
                    disabled={(scanType === 'linter' || scanType === 'pipeline' || scanType === 'network' || scanType === 'container') && fixWorkflow ? fixWorkflow.isApplyingSingleFix : applyFixMutation.isPending}
                    className="w-full"
                    data-testid="button-apply-fix"
                  >
                    {(((scanType === 'linter' || scanType === 'pipeline' || scanType === 'network' || scanType === 'container') && fixWorkflow) ? fixWorkflow.isApplyingSingleFix : applyFixMutation.isPending) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Applying Fix...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Apply Fix
                      </>
                    )}
                  </Button>
                ) : (
                  <ReuploadReminder findingId={selectedFinding.id} />
                )}
              </div>
            )}

            {/* Remediation Steps */}
            {selectedFinding?.remediation && (
              <div>
                <h4 className="font-semibold mb-2">Remediation Steps</h4>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{selectedFinding.remediation}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fix Scope Dialog - for linter, pipeline, network, and container scans */}
      {(scanType === 'linter' || scanType === 'pipeline' || scanType === 'network' || scanType === 'container') && fixWorkflow && (
        <FixScopeDialog
          open={fixWorkflow.showScopeDialog}
          onOpenChange={fixWorkflow.setShowScopeDialog}
          findingTitle={fixWorkflow.selectedFinding?.title || ""}
          totalFindings={scanFindings.length}
          scanTypeName={
            scanType === 'linter' ? 'Linter Scan' :
            scanType === 'pipeline' ? 'CI/CD Pipeline Scan' :
            scanType === 'network' ? 'Network Scan' :
            'Container Scan'
          }
          onFixSingle={fixWorkflow.handleSingleFix}
          onFixAll={fixWorkflow.handleFixAll}
        />
      )}

      {/* Payment Dialog for Fix All - for linter, pipeline, network, and container scans */}
      {(scanType === 'linter' || scanType === 'pipeline' || scanType === 'network' || scanType === 'container') && fixWorkflow && (
        <Dialog open={fixWorkflow.showPaymentDialog} onOpenChange={fixWorkflow.setShowPaymentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Payment for Batch Fix</DialogTitle>
              <DialogDescription>
                Automated fix service for {fixWorkflow.issueCount} issues
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Base Price</p>
                  <p className="text-xs text-muted-foreground">Service fee</p>
                </div>
                <p className="font-semibold">$5.00</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Per Issue</p>
                  <p className="text-xs text-muted-foreground">{fixWorkflow.issueCount} issues × $2.00</p>
                </div>
                <p className="font-semibold">${((fixWorkflow.issueCount || 0) * 2).toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="font-semibold">Total</p>
                <p className="text-xl font-bold">${(fixWorkflow.paymentAmount / 100).toFixed(2)}</p>
              </div>
              {fixWorkflow.paymentClientSecret === 'demo_client_secret' && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Demo Mode: Payment will be simulated
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fixWorkflow.setShowPaymentDialog(false)}
                className="flex-1"
                data-testid="button-cancel-payment"
              >
                Cancel
              </Button>
              <Button
                onClick={fixWorkflow.handlePaymentConfirm}
                disabled={fixWorkflow.isConfirmingPayment}
                className="flex-1"
                data-testid="button-confirm-payment"
              >
                {fixWorkflow.isConfirmingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Payment"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
