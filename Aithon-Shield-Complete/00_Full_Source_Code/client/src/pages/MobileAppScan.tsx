import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Smartphone, Apple, Package, Shield, Upload, CheckCircle, AlertTriangle, Info, Copy, Bug, Lightbulb, MapPin, Check, Hand, Zap, Pencil, Trash2, XCircle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UploadProgress } from "@/components/UploadProgress";
import { PostFixValidationDialog } from "@/components/PostFixValidationDialog";
import { UploadWithFixesOptionsDialog } from "@/components/UploadWithFixesOptionsDialog";
import { UploadWithoutFixesWarningDialog } from "@/components/UploadWithoutFixesWarningDialog";
import { ChooseWorkflowSection } from "@/components/ChooseWorkflowSection";
import { EditMobileAppScanDialog } from "@/components/EditMobileAppScanDialog";
import { useScanUpload } from "@/hooks/use-scan-upload";
import { useRoute } from "wouter";
import type { MobileAppScan, Finding } from "@shared/schema";

interface FileLocation {
  file: string;
  line: number;
  function: string | null;
  description: string;
}

export default function MobileAppScan() {
  const { toast } = useToast();
  const [, routeParams] = useRoute("/mobile-scans/:id");
  const [selectedScanId, setSelectedScanId] = useState<string | null>(routeParams?.id || null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadWithFixes, setUploadWithFixes] = useState(false);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [fileLocations, setFileLocations] = useState<FileLocation[]>([]);
  const [validating, setValidating] = useState(false);
  const [showPostFixValidation, setShowPostFixValidation] = useState(false);
  const [showUploadWithFixesOptions, setShowUploadWithFixesOptions] = useState(false);
  const [showUploadWithoutFixesWarning, setShowUploadWithoutFixesWarning] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  useEffect(() => {
    if (routeParams?.id) {
      setSelectedScanId(routeParams.id);
    }
  }, [routeParams?.id]);

  // Shared upload hook for automated fix flow
  const { upload, isUploading } = useScanUpload();

  const { data: scans = [], isLoading } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
    refetchInterval: (query) => {
      const data = query.state.data;
      // Auto-refresh if any scan is scanning
      if (data?.some(scan => scan.scanStatus === "scanning" || scan.scanStatus === "pending" || scan.scanStatus === "cancelling")) {
        return 2000;
      }
      return false;
    },
  });

  const { data: selectedScan } = useQuery<MobileAppScan>({
    queryKey: ["/api/mobile-scans", selectedScanId],
    enabled: !!selectedScanId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.scanStatus === "scanning" || data?.scanStatus === "cancelling" || data?.uploadStatus === "pending" || (data?.uploadProgress && data.uploadProgress !== 'idle')) {
        return 1000;
      }
      return false;
    },
  });

  const { data: findings = [], isLoading: findingsLoading } = useQuery<Finding[]>({
    queryKey: ["/api/mobile-scans", selectedScanId, "findings"],
    enabled: !!selectedScanId && selectedScan?.scanStatus === "completed",
  });

  const startScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const res = await apiRequest("POST", `/api/mobile-scans/${scanId}/scan`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans"] });
      toast({
        title: "Scan started",
        description: "Security analysis in progress...",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ scanId, withFixes, runTests }: { scanId: string; withFixes: boolean; runTests?: boolean }) => {
      const endpoint = runTests ? `/api/mobile-scans/${scanId}/upload-and-test` : `/api/mobile-scans/${scanId}/upload`;
      const res = await apiRequest("POST", endpoint, { withFixes });
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      setShowUploadDialog(false);
      toast({
        title: variables.runTests ? "Upload & Testing initiated" : "Upload initiated",
        description: variables.runTests 
          ? "App is being uploaded and comprehensive tests will run automatically"
          : `App ${variables.withFixes ? "with fixes" : "without fixes"} is being uploaded to the store`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const res = await apiRequest("DELETE", `/api/mobile-scans/${scanId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans"] });
      setSelectedScanId(null);
      setShowDeleteConfirmation(false);
      toast({
        title: "Scan deleted",
        description: "The scan has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete scan",
        variant: "destructive",
      });
    },
  });

  const cancelScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const response = await fetch(`/api/mobile-scans/${scanId}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to cancel scan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile-scans'] });
      setShowCancelConfirmation(false);
      toast({
        title: "Scan cancelled successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to cancel scan",
        variant: "destructive",
      });
    },
  });

  const handleUploadClick = async (withFixes: boolean) => {
    // Ensure a scan is selected (defensive check matching Web/MVP pattern)
    if (!selectedScanId) {
      toast({
        title: "No scan selected",
        description: "Please select a scan before uploading",
        variant: "destructive",
      });
      return;
    }

    setUploadWithFixes(withFixes);
    
    // If uploading with fixes, show post-fix validation dialog with fix options
    if (withFixes) {
      setShowPostFixValidation(true);
      return;
    }
    
    // If uploading without fixes, show warning dialog first (matching Web workflow)
    setShowUploadWithoutFixesWarning(true);
  };

  const handleConfirmUpload = (runTests = false) => {
    if (selectedScan) {
      uploadMutation.mutate({ scanId: selectedScan.id, withFixes: uploadWithFixes, runTests });
    }
  };

  const handleValidationComplete = () => {
    // Validation passed or fixes applied, proceed to upload
    setShowPostFixValidation(false);
    setShowUploadDialog(true);
  };

  // Helper to get deployment target - use autoUploadDestination or derive from platform
  const getDeploymentTarget = (scan: MobileAppScan | undefined): string => {
    if (!scan) return "";
    if (scan.autoUploadDestination) return scan.autoUploadDestination;
    return scan.platform === "ios" ? "App Store" : "Play Store";
  };

  const handleProceedWithUpload = (runTests?: boolean) => {
    if (!selectedScanId || !selectedScan) {
      toast({
        title: "Missing information",
        description: "Cannot upload without scan ID",
        variant: "destructive",
      });
      return;
    }

    const destination = getDeploymentTarget(selectedScan);
    
    upload({
      scanType: "mobile",
      scanId: selectedScanId,
      destination,
      withFixes: true,
      runTests,
    });

    // Don't close dialog here - let UploadWithFixesOptionsDialog handle its own state
    // The dialog will show test results and close when upload completes or user cancels
  };

  const getScanStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" data-testid="badge-scan-pending">Pending</Badge>;
      case "scanning":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20" data-testid="badge-scan-scanning">Scanning</Badge>;
      case "cancelling":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" data-testid="badge-scan-cancelling">Cancelling</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-scan-completed">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid="badge-scan-failed">Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20" data-testid="badge-scan-cancelled">Cancelled</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-scan-unknown">{status}</Badge>;
    }
  };

  const getUploadStatusBadge = (status: string) => {
    switch (status) {
      case "none":
        return <Badge variant="outline" data-testid="badge-upload-none">Not Uploaded</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" data-testid="badge-upload-pending">Uploading</Badge>;
      case "uploaded":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-upload-uploaded">Uploaded</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid="badge-upload-failed">Failed</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-upload-unknown">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-mobile-scan">Mobile App Security Scan</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-mobile-scan-description">
          Fetch apps from Apple App Store or Google Play Store, scan for vulnerabilities, and upload fixed versions
        </p>
      </div>

      <ChooseWorkflowSection 
        title="Start Mobile App Scan"
        description="Choose your workflow to scan mobile apps from app stores or existing builds"
        defaultAppType="mobile"
        hideTabs={true}
      />

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Selected Scan Details */}
        {selectedScan && (
          <Card data-testid={`card-scan-details-${selectedScan.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2" data-testid={`heading-scan-${selectedScan.id}`}>
                    {selectedScan.platform === "ios" ? <Apple className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                    {selectedScan.appName}
                  </CardTitle>
                  <CardDescription className="mt-1" data-testid={`text-scan-id-${selectedScan.id}`}>
                    {selectedScan.platform === "ios" ? "Bundle ID" : "Package"}: {selectedScan.appId} • v{selectedScan.version}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEditDialog(true)}
                    data-testid={`button-edit-scan-${selectedScan.id}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirmation(true)}
                    data-testid={`button-delete-scan-${selectedScan.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium" data-testid={`label-scan-status-${selectedScan.id}`}>Scan Status</p>
                  {getScanStatusBadge(selectedScan.scanStatus)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium" data-testid={`label-upload-status-${selectedScan.id}`}>Upload Status</p>
                  {getUploadStatusBadge(selectedScan.uploadStatus)}
                </div>
              </div>

              {selectedScan.scanStatus === "scanning" && (
                <div className="space-y-2">
                  <Progress 
                    value={selectedScan.scanProgress ?? 0} 
                    className="h-2" 
                    data-testid={`progress-scan-${selectedScan.id}`} 
                  />
                  <p className="text-sm text-muted-foreground" data-testid={`text-scanning-${selectedScan.id}`}>
                    {selectedScan.scanStage || 'Preparing scan...'} ({selectedScan.scanProgress ?? 0}%)
                  </p>
                </div>
              )}

              {(selectedScan.scanStatus === "failed" || selectedScan.scanStatus === "cancelled") && selectedScan.scanError && (
                <Alert variant="destructive" data-testid={`alert-scan-error-${selectedScan.id}`}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {selectedScan.scanStatus === "cancelled" ? "Scan Cancelled" : "Scan Failed"}
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    {selectedScan.scanError}
                  </AlertDescription>
                  {selectedScan.scanStatus === "failed" && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          startScanMutation.mutate(selectedScan.id);
                        }}
                        disabled={startScanMutation.isPending}
                        data-testid={`button-retry-scan-${selectedScan.id}`}
                      >
                        <Loader2 className={`h-4 w-4 mr-2 ${startScanMutation.isPending ? 'animate-spin' : ''}`} />
                        Retry Scan
                      </Button>
                    </div>
                  )}
                </Alert>
              )}

              {selectedScan.scanStatus === "cancelling" && (
                <div className="space-y-2">
                  <Progress 
                    value={selectedScan.scanProgress ?? 0} 
                    className="h-2" 
                    data-testid={`progress-scan-${selectedScan.id}`} 
                  />
                  <p className="text-sm text-muted-foreground" data-testid={`text-cancelling-${selectedScan.id}`}>
                    {selectedScan.scanStage || 'Cancelling scan...'} ({selectedScan.scanProgress ?? 0}%)
                  </p>
                </div>
              )}

              {selectedScan.scanStatus === "completed" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground" data-testid={`label-total-findings-${selectedScan.id}`}>Total Findings</p>
                      <p className="text-2xl font-bold" data-testid={`text-total-findings-${selectedScan.id}`}>{selectedScan.findingsCount}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground" data-testid={`label-severity-breakdown-${selectedScan.id}`}>Severity Breakdown</p>
                      <div className="flex gap-2">
                        <Badge variant="destructive" data-testid={`badge-critical-${selectedScan.id}`}>{selectedScan.criticalCount} Critical</Badge>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20" data-testid={`badge-high-${selectedScan.id}`}>
                          {selectedScan.highCount} High
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Findings List */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" data-testid={`label-findings-${selectedScan.id}`}>
                        Security Findings
                      </p>
                      {findingsLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" data-testid={`loading-findings-${selectedScan.id}`}></div>
                      )}
                    </div>
                    
                    {!findingsLoading && findings.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm" data-testid={`text-no-findings-${selectedScan.id}`}>
                        No security findings detected
                      </div>
                    )}

                    {!findingsLoading && findings.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto" data-testid={`list-findings-${selectedScan.id}`}>
                        {findings.map((finding) => (
                          <Card key={finding.id} className="p-3" data-testid={`finding-card-${finding.id}`}>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <Bug className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <p className="font-medium text-sm" data-testid={`finding-title-${finding.id}`}>
                                    {finding.title}
                                  </p>
                                </div>
                                <Badge 
                                  variant={finding.severity === "CRITICAL" ? "destructive" : "outline"}
                                  className={
                                    finding.severity === "HIGH" 
                                      ? "bg-orange-500/10 text-orange-500 border-orange-500/20" 
                                      : finding.severity === "MEDIUM"
                                      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                      : finding.severity === "LOW"
                                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                      : ""
                                  }
                                  data-testid={`finding-severity-${finding.id}`}
                                >
                                  {finding.severity}
                                </Badge>
                              </div>
                              {finding.location && (
                                <p className="text-xs text-muted-foreground font-mono" data-testid={`finding-location-${finding.id}`}>
                                  {finding.location}
                                </p>
                              )}
                              {finding.aiSuggestion && (
                                <p className="text-xs text-muted-foreground" data-testid={`finding-ai-suggestion-${finding.id}`}>
                                  <span className="text-primary">AI:</span> {finding.aiSuggestion}
                                </p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Test Results */}
                  {selectedScan.testStatus && selectedScan.testStatus !== 'not_tested' && (
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium" data-testid={`label-test-results-${selectedScan.id}`}>
                          Comprehensive Test Results
                        </p>
                        <Badge 
                          variant={selectedScan.testStatus === "passed" ? "outline" : selectedScan.testStatus === "failed" ? "destructive" : "outline"}
                          className={selectedScan.testStatus === "passed" ? "bg-green-500/10 text-green-500 border-green-500/20" : selectedScan.testStatus === "running" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : ""}
                          data-testid={`badge-test-status-${selectedScan.id}`}
                        >
                          {selectedScan.testStatus === "running" ? "Testing..." : selectedScan.testStatus.toUpperCase()}
                        </Badge>
                      </div>
                      {selectedScan.testSummary && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-test-summary-${selectedScan.id}`}>
                          {selectedScan.testSummary}
                        </p>
                      )}
                      {selectedScan.testDetails && selectedScan.testStatus !== 'running' && (
                        <Card className="p-3 bg-muted/30" data-testid={`card-test-details-${selectedScan.id}`}>
                          <pre className="text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                            {(() => {
                              try {
                                const details = JSON.parse(selectedScan.testDetails);
                                return details.logs?.join('\n') || JSON.stringify(details, null, 2);
                              } catch {
                                return selectedScan.testDetails;
                              }
                            })()}
                          </pre>
                        </Card>
                      )}
                    </div>
                  )}

                  {selectedScan.uploadStatus === "none" && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium" data-testid={`label-upload-options-${selectedScan.id}`}>Upload Options</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="default"
                          className="gap-2"
                          onClick={() => handleUploadClick(true)}
                          disabled={uploadMutation.isPending}
                          data-testid={`button-review-fix-issues-${selectedScan.id}`}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Review & Fix Issues
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => handleUploadClick(false)}
                          disabled={uploadMutation.isPending}
                          data-testid={`button-upload-without-fixes-${selectedScan.id}`}
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Upload Without Fixes
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedScan.uploadStatus === "pending" && selectedScan.uploadProgress && (
                    <UploadProgress 
                      uploadProgress={selectedScan.uploadProgress} 
                      destination={selectedScan.platform === "ios" ? "App Store" : "Play Store"}
                    />
                  )}

                  {selectedScan.uploadStatus === "uploaded" && (
                    <>
                      <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg border border-green-500/20" data-testid={`alert-uploaded-${selectedScan.id}`}>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <p className="text-sm font-medium text-green-500">Successfully uploaded to {selectedScan.platform === "ios" ? "App Store" : "Play Store"}</p>
                      </div>
                      <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-medium" data-testid={`label-reupload-${selectedScan.id}`}>Re-upload to App Store</p>
                        <p className="text-sm text-muted-foreground">Upload a new version with updated fixes</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="default"
                            className="gap-2"
                            onClick={() => handleUploadClick(true)}
                            disabled={uploadMutation.isPending}
                            data-testid={`button-review-fix-issues-${selectedScan.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Review & Fix Issues
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => handleUploadClick(false)}
                            disabled={uploadMutation.isPending}
                            data-testid={`button-reupload-without-fixes-${selectedScan.id}`}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Re-upload Without Fixes
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {(selectedScan.scanStatus === "pending" || selectedScan.scanStatus === "scanning") && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedScan.scanStatus === "pending" && (
                    <Button
                      className="gap-2"
                      onClick={() => startScanMutation.mutate(selectedScan.id)}
                      disabled={startScanMutation.isPending}
                      data-testid={`button-start-scan-${selectedScan.id}`}
                    >
                      <Shield className="h-4 w-4" />
                      Start Scan
                    </Button>
                  )}
                  {(selectedScan.scanStatus === "scanning" || selectedScan.scanStatus === "pending") && (
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => setShowCancelConfirmation(true)}
                      disabled={cancelScanMutation.isPending}
                      data-testid="button-cancel-scan"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Scan
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* All Scans */}
      <Card data-testid="card-all-scans">
        <CardHeader>
          <CardTitle data-testid="heading-all-scans">All Mobile App Scans</CardTitle>
          <CardDescription data-testid="text-all-scans-description">
            View and manage your mobile app security scans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-scans">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-scans">
              No scans yet. Register an app to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className={`flex items-center justify-between gap-4 p-4 rounded-lg border cursor-pointer hover-elevate ${selectedScanId === scan.id ? "bg-primary/10 border-primary/30" : ""}`}
                  onClick={() => setSelectedScanId(scan.id)}
                  data-testid={`item-scan-${scan.id}`}
                >
                  <div className="flex items-center gap-3">
                    {scan.platform === "ios" ? (
                      <Apple className={`h-5 w-5 ${selectedScanId === scan.id ? "text-primary" : "text-muted-foreground"}`} />
                    ) : (
                      <Package className={`h-5 w-5 ${selectedScanId === scan.id ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <div>
                      <p className={`font-medium ${selectedScanId === scan.id ? "text-foreground" : ""}`} data-testid={`text-scan-name-${scan.id}`}>{scan.appName}</p>
                      <p className="text-sm text-muted-foreground" data-testid={`text-scan-details-${scan.id}`}>
                        {scan.appId} • v{scan.version}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {scan.scanStatus === "completed" && (
                      <div className="flex items-center gap-2" data-testid={`findings-summary-${scan.id}`}>
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20" data-testid={`badge-critical-count-${scan.id}`}>
                          {scan.criticalCount}
                        </Badge>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20" data-testid={`badge-high-count-${scan.id}`}>
                          {scan.highCount}
                        </Badge>
                      </div>
                    )}
                    {scan.scanStatus === "pending" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            startScanMutation.mutate(scan.id);
                          }}
                          disabled={startScanMutation.isPending}
                          data-testid={`button-start-scan-list-${scan.id}`}
                        >
                          <Shield className="h-4 w-4" />
                          Start Scan
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScanId(scan.id);
                            setShowCancelConfirmation(true);
                          }}
                          disabled={cancelScanMutation.isPending}
                          data-testid="button-cancel-scan"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    )}
                    {scan.scanStatus === "scanning" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScanId(scan.id);
                          setShowCancelConfirmation(true);
                        }}
                        disabled={cancelScanMutation.isPending}
                        data-testid="button-cancel-scan"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                    {getScanStatusBadge(scan.scanStatus)}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScanId(scan.id);
                          setShowEditDialog(true);
                        }}
                        data-testid={`button-edit-scan-list-${scan.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScanId(scan.id);
                          setShowDeleteConfirmation(true);
                        }}
                        data-testid={`button-delete-scan-list-${scan.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post-Fix Validation Dialog */}
      <PostFixValidationDialog
        scanType="mobile"
        scanId={selectedScanId}
        open={showPostFixValidation}
        onOpenChange={(open) => {
          // ONLY allow opening - closing must be done via explicit button clicks
          // This prevents automatic closing from Dialog internals, focus loss, or polling
          if (open) {
            setShowPostFixValidation(true);
          }
          // Ignore false values - dialog closes only when user clicks a button
        }}
        onClose={() => setShowPostFixValidation(false)}
        onValidationComplete={handleValidationComplete}
        onRequestUpload={() => {
          // Close validation dialog and open upload dialog after automated fixes complete
          setShowPostFixValidation(false);
          setShowUploadWithFixesOptions(true);
        }}
      />

      {/* Upload With Fixes Options Dialog - For automated fix flow */}
      {/* ALWAYS RENDER - dialog manages its own visibility via internal state to prevent auto-close */}
      <UploadWithFixesOptionsDialog
        open={showUploadWithFixesOptions}
        onOpenChange={(open) => {
          // ONLY allow opening - closing must be done via explicit button clicks
          if (open) {
            setShowUploadWithFixesOptions(true);
          }
          // Ignore false values - dialog closes only when user clicks Cancel or completes upload
        }}
        onClose={() => setShowUploadWithFixesOptions(false)}
        scanType="mobile"
        scanId={selectedScanId || ""}
        destination={selectedScan ? getDeploymentTarget(selectedScan) : "app store"}
        onProceedWithUpload={handleProceedWithUpload}
      />

      {/* Upload Without Fixes Warning Dialog */}
      {selectedScanId && (
        <UploadWithoutFixesWarningDialog
          open={showUploadWithoutFixesWarning}
          onOpenChange={setShowUploadWithoutFixesWarning}
          scanType="mobile"
          scanId={selectedScanId}
          destination={selectedScan ? getDeploymentTarget(selectedScan) : "app store"}
          onProceedAnyway={() => {
            setShowUploadWithoutFixesWarning(false);
            setShowUploadDialog(true);
          }}
          onResolveIssues={() => {
            setShowUploadWithoutFixesWarning(false);
            setShowPostFixValidation(true);
          }}
        />
      )}

      {/* Upload Confirmation Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => !uploadMutation.isPending && setShowUploadDialog(open)}>
        <DialogContent data-testid="dialog-upload-confirmation">
          {uploadMutation.isPending ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" data-testid="heading-upload-in-progress">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  Uploading to {selectedScan?.platform === "ios" ? "iOS App Store" : "Android Play Store"}...
                </DialogTitle>
                <DialogDescription data-testid="text-upload-status">
                  Your app {uploadWithFixes ? "with security fixes" : ""} is being uploaded. This may take a moment...
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Progress value={undefined} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  You will receive a notification when the upload is complete.
                </p>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle data-testid="heading-dialog-upload">
                  Confirm Upload to {selectedScan?.platform === "ios" ? "iOS App Store" : "Android Play Store"}
                </DialogTitle>
                <DialogDescription data-testid="text-dialog-upload-description">
                  {uploadWithFixes 
                    ? `This will upload your app WITH security fixes applied back to the ${selectedScan?.platform === "ios" ? "iOS App Store" : "Android Play Store"}. The fixes will be automatically applied to version ${selectedScan?.version}.`
                    : `This will upload your app WITHOUT any fixes back to the ${selectedScan?.platform === "ios" ? "iOS App Store" : "Android Play Store"}. No changes will be made to your app.`
                  }
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadDialog(false)}
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmUpload()}
                  data-testid="button-confirm-upload"
                >
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Validation Warning Dialog */}
      <AlertDialog open={showValidationWarning} onOpenChange={setShowValidationWarning}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex flex-col items-center gap-4 text-center mb-4">
              <div className="rounded-full bg-destructive/10 p-6">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
              <AlertDialogTitle className="text-3xl font-bold">
                Warning: Security Fixes May Break Your App
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-6 text-base">
              <Card className="p-6 bg-destructive/10 border-destructive/30 border-2">
                <p className="text-xl font-semibold text-foreground mb-4 text-center">
                  We found potential problems that could break your application:
                </p>
                <ul className="text-base space-y-3">
                  {validationIssues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-3 bg-background/60 rounded-lg">
                      <span className="text-destructive text-2xl leading-none mt-1">•</span>
                      <span className="text-foreground font-medium flex-1">{issue}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {fileLocations.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-xl font-bold text-foreground text-center bg-primary/10 p-4 rounded-lg border-2 border-primary/30">
                    <MapPin className="h-6 w-6" />
                    <span>Where You Need to Manually Fix These Issues:</span>
                  </div>
                  <div className="space-y-3">
                    {fileLocations.map((location, idx) => (
                      <Card key={idx} className="p-4 bg-muted/50 border-2 hover-elevate">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <code className="text-sm font-mono text-primary break-all font-semibold">
                              {location.file}:{location.line}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-shrink-0 gap-2"
                              onClick={() => {
                                const locationText = location.function 
                                  ? `${location.file}:${location.line} (${location.function})`
                                  : `${location.file}:${location.line}`;
                                navigator.clipboard.writeText(locationText);
                                toast({
                                  title: "Location Copied",
                                  description: "File location copied to clipboard",
                                });
                              }}
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </Button>
                          </div>
                          {location.function && (
                            <p className="text-sm text-muted-foreground">
                              In function: <code className="font-mono font-semibold">{location.function}</code>
                            </p>
                          )}
                          <p className="text-sm text-foreground font-medium">
                            {location.description}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Card className="p-6 bg-blue-500/10 border-blue-500/30 border-2">
                <div className="flex items-center justify-center gap-2 text-lg font-bold text-foreground mb-3">
                  <Lightbulb className="h-5 w-5" />
                  <span>What Should You Do?</span>
                </div>
                <p className="text-base text-foreground leading-relaxed">
                  We recommend fixing these issues manually in your code editor before uploading. 
                  This way, you can test everything works correctly and avoid breaking your app.
                </p>
              </Card>

              <Card className="p-6 bg-amber-500/10 border-amber-500/30 border-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-base text-foreground leading-relaxed">
                    <strong className="text-lg">Important:</strong> Aithon Shield only fixes security vulnerabilities. 
                    You'll need to handle any other code changes yourself to make sure everything works together.
                  </p>
                </div>
              </Card>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-3 sm:gap-3">
            <AlertDialogCancel 
              className="w-full text-lg py-6 hover-elevate"
              data-testid="button-manual-fix"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <Hand className="h-5 w-5" />
                  <span className="font-bold">I'll Fix This Manually</span>
                </div>
                <span className="text-xs font-normal opacity-80">Recommended - Apply fixes safely in your code editor</span>
              </div>
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowValidationWarning(false);
                if (selectedScan) {
                  uploadMutation.mutate({ scanId: selectedScan.id, withFixes: true, runTests: true });
                }
              }}
              data-testid="button-proceed-anyway"
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 text-lg py-6"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <span className="font-bold">Continue Anyway & Test</span>
                </div>
                <span className="text-xs font-normal opacity-90">Apply fixes now and run comprehensive tests</span>
              </div>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Scan Dialog */}
      {selectedScan && (
        <EditMobileAppScanDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          scan={selectedScan}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="heading-delete-confirmation">Delete Scan?</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              This action cannot be undone. This will permanently delete the scan and all associated findings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedScan && deleteMutation.mutate(selectedScan.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Scan Confirmation Dialog */}
      <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <AlertDialogContent data-testid="dialog-cancel-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="heading-cancel-confirmation">Cancel Scan?</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-cancel-confirmation">
              Are you sure you want to cancel this scan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cancel">No, Continue Scan</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedScanId) {
                  cancelScanMutation.mutate(selectedScanId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-cancel"
            >
              Yes, Cancel Scan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
