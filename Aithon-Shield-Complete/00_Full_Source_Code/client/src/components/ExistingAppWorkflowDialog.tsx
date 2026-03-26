import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Code, Smartphone, Globe, Download, Upload, Loader2, AlertTriangle, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pollScanUploadProgress } from "@/lib/uploadScanPoll";
import { UploadWithoutFixesWarningDialog } from "@/components/UploadWithoutFixesWarningDialog";
import { UploadWithFixesOptionsDialog } from "@/components/UploadWithFixesOptionsDialog";
import { InfoTooltip } from "@/components/InfoTooltip";
import { PostFixValidationDialog } from "@/components/PostFixValidationDialog";
import type { ScanType } from "@/hooks/use-scan-findings";
import type { Finding } from "@shared/schema";

interface ExistingAppWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAppType?: "mvp" | "mobile" | "web" | "container";
  hideTabs?: boolean;
}

type AppConfigPayload = {
  demoMode: boolean;
  demoStrictScanTargets?: boolean;
  demoScanHint: string | null;
};

function existingWorkflowTab(defaultAppType?: "mvp" | "mobile" | "web" | "container"): "mvp" | "mobile" | "web" {
  if (!defaultAppType || defaultAppType === "container") return "mvp";
  return defaultAppType;
}

export function ExistingAppWorkflowDialog({ open, onOpenChange, defaultAppType, hideTabs = false }: ExistingAppWorkflowDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: appConfig } = useQuery<AppConfigPayload>({
    queryKey: ["/api/app-config"],
  });
  const strictProdScanUrls = import.meta.env.PROD && appConfig?.demoMode !== true;
  const [appType, setAppType] = useState<"mvp" | "mobile" | "web">(() => existingWorkflowTab(defaultAppType));

  // Reset state when dialog opens or defaultAppType changes
  useEffect(() => {
    if (open && defaultAppType) {
      setAppType(existingWorkflowTab(defaultAppType));
    }
  }, [open, defaultAppType]);
  const [workflowStatus, setWorkflowStatus] = useState<"idle" | "scanning" | "completed" | "uploading">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  
  // MVP fields (downloading from repository)
  const [projectName, setProjectName] = useState("");
  const [sourceRepo, setSourceRepo] = useState<"github" | "gitlab" | "bitbucket">("github");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [mvpTechStack, setMvpTechStack] = useState("");
  const [mvpCloudInfra, setMvpCloudInfra] = useState("");
  
  // Mobile fields (downloading from App Store)
  const [appName, setAppName] = useState("");
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [bundleId, setBundleId] = useState("");
  const [mobileVersion, setMobileVersion] = useState("");
  const [mobileBackendApi, setMobileBackendApi] = useState("");
  const [mobileCloudProvider, setMobileCloudProvider] = useState("");
  
  // Web fields (downloading from live URL)
  const [webAppName, setWebAppName] = useState("");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [webScanDepth, setWebScanDepth] = useState<"shallow" | "moderate" | "deep">("moderate");
  const [webCloudHosting, setWebCloudHosting] = useState("");
  const [webAuthRequired, setWebAuthRequired] = useState(false);
  const [webAuthType, setWebAuthType] = useState<"basic" | "form" | "api-key" | "oauth">("basic");
  const [webAuthUsername, setWebAuthUsername] = useState("");
  const [webAuthPassword, setWebAuthPassword] = useState("");
  const [webAuthApiKey, setWebAuthApiKey] = useState("");
  const [webAuthLoginUrl, setWebAuthLoginUrl] = useState("");
  const [webSecurityModules, setWebSecurityModules] = useState<string[]>(["SAST", "DAST"]);
  const [mvpSecurityModules, setMvpSecurityModules] = useState<string[]>(["SAST", "SCA", "IaC", "Secrets"]);
  const [mobileSecurityModules, setMobileSecurityModules] = useState<string[]>(["SAST", "SCA", "Secrets"]);
  const [workflowAdvancedOpen, setWorkflowAdvancedOpen] = useState(false);
  const [mvpDeployKind, setMvpDeployKind] = useState<"none" | "ios" | "android" | "web">("none");
  const [mvpBundleId, setMvpBundleId] = useState("");
  const [mvpWebDeployUrl, setMvpWebDeployUrl] = useState("");
  
  // Scan results
  const [scanResults, setScanResults] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });
  const [showDetails, setShowDetails] = useState(false);
  const [issues, setIssues] = useState<Finding[]>([]);
  const [findingsStatus, setFindingsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [currentScanId, setCurrentScanId] = useState<string | null>(null); // Track current scan ID
  
  // Upload dialog states
  const [showUploadWithoutFixesWarning, setShowUploadWithoutFixesWarning] = useState(false);
  const [showUploadWithFixesOptions, setShowUploadWithFixesOptions] = useState(false);
  const [showPostFixValidation, setShowPostFixValidation] = useState(false);

  // Helper function to fetch findings for a completed scan
  const fetchFindings = async (scanId: string, scanType: string) => {
    try {
      setFindingsStatus("loading");
      const response = await apiRequest("GET", `/api/findings?scanId=${scanId}&scanType=${scanType}`);
      const findings: Finding[] = await response.json();
      setIssues(findings);
      setFindingsStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
    } catch (error) {
      console.error("Error fetching findings:", error);
      setFindingsStatus("error");
      toast({
        title: "Error Loading Issues",
        description: "Failed to load security issues. Please try again.",
        variant: "destructive",
      });
    }
  };

  const createScanMutation = useMutation({
    mutationFn: async ({ scanType, scanData }: { scanType: string; scanData: any }) => {
      let response;
      if (scanType === "mvp") {
        response = await apiRequest("POST", "/api/mvp-scans", scanData);
      } else if (scanType === "mobile") {
        response = await apiRequest("POST", "/api/mobile-scans", scanData);
      } else {
        response = await apiRequest("POST", "/api/web-scans", scanData);
      }
      const result = await response.json();
      return { ...result, scanType }; // Include scan type in response
    },
    onSuccess: async (data: any) => {
      // Scan created successfully, now trigger the actual scan
      const scanId = data.id;
      const scanType = data.scanType; // Use captured scan type, not state
      setCurrentScanId(scanId); // Store scan ID for later use
      
      try {
        // Trigger the scan endpoint to actually run the scan
        await apiRequest("POST", `/api/${scanType}-scans/${scanId}/scan`);
        
        // Poll for scan completion
        let pollCount = 0;
        const maxPollAttempts = 60; // 60 seconds max
        
        const pollInterval = setInterval(async () => {
          try {
            pollCount++;
            const response = await apiRequest("GET", `/api/${scanType}-scans/${scanId}`);
            const scanData = await response.json();
            
            if (scanData.scanStatus === "completed" || scanData.scanStatus === "failed") {
              clearInterval(pollInterval);
              queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`] });
              queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
              
              if (scanData.scanStatus === "completed") {
                // Update UI with actual scan results from database
                setScanResults({
                  total: scanData.findingsCount || 0,
                  critical: scanData.criticalCount || 0,
                  high: scanData.highCount || 0,
                  medium: scanData.mediumCount || 0,
                  low: scanData.lowCount || 0
                });
                
                // Fetch actual findings from database
                await fetchFindings(scanId, scanType);
                
                setWorkflowStatus("completed");
                toast({
                  title: "Scan Complete",
                  description: `Found ${scanData.findingsCount || 0} security issues. Check Findings page for details.`,
                });
              } else {
                setWorkflowStatus("idle");
                toast({
                  title: "Scan Failed",
                  description: "The security scan failed to complete",
                  variant: "destructive",
                });
              }
            } else if (pollCount >= maxPollAttempts) {
              // Timeout after 60 seconds
              clearInterval(pollInterval);
              setWorkflowStatus("idle");
              toast({
                title: "Scan Timeout",
                description: "The scan is taking longer than expected. Please check All Scans page for status.",
                variant: "destructive",
              });
            }
          } catch (error) {
            clearInterval(pollInterval);
            setWorkflowStatus("idle");
            console.error("Error polling scan status:", error);
            toast({
              title: "Polling Error",
              description: "Failed to check scan status",
              variant: "destructive",
            });
          }
        }, 1000); // Poll every second
        
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to start scan";
        toast({
          title: "Could not start scan",
          description: msg,
          variant: "destructive",
        });
        setWorkflowStatus("idle");
      }
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to create scan";
      toast({
        title: "Could not create scan",
        description: msg,
        variant: "destructive",
      });
      setWorkflowStatus("idle");
    },
  });

  const handleDownloadAndScan = () => {
    const branchNorm = branch.trim() || "main";
    const webMods = webSecurityModules.length > 0 ? webSecurityModules : ["SAST", "DAST", "SCA", "Secrets"];
    const mvpMods = mvpSecurityModules.length > 0 ? mvpSecurityModules : ["SAST", "SCA", "IaC", "Secrets"];
    const mobMods = mobileSecurityModules.length > 0 ? mobileSecurityModules : ["SAST", "SCA", "Secrets"];

    if (appType === "mvp") {
      if (!projectName.trim() || !repositoryUrl.trim()) {
        toast({
          title: "Missing Information",
          description: "Please provide project name and repository URL",
          variant: "destructive",
        });
        return;
      }
      if (strictProdScanUrls) {
        try {
          // eslint-disable-next-line no-new
          new URL(repositoryUrl.trim());
        } catch {
          toast({
            title: "Invalid repository URL",
            description: "Use a full URL starting with https:// (e.g. https://github.com/octocat/Hello-World).",
            variant: "destructive",
          });
          return;
        }
      }
    }
    if (appType === "mobile") {
      if (!appName.trim() || !bundleId.trim() || !mobileVersion.trim()) {
        toast({
          title: "Missing Information",
          description: "Please provide app name, bundle/package ID, and version",
          variant: "destructive",
        });
        return;
      }
    }
    if (appType === "web") {
      if (!webAppName.trim() || !webAppUrl.trim()) {
        toast({
          title: "Missing Information",
          description: "Please provide app name and live URL",
          variant: "destructive",
        });
        return;
      }
      if (strictProdScanUrls) {
        try {
          // eslint-disable-next-line no-new
          new URL(webAppUrl.trim());
        } catch {
          toast({
            title: "Invalid application URL",
            description: "Use a full URL starting with https:// (e.g. https://example.com).",
            variant: "destructive",
          });
          return;
        }
      }
    }

    const scanData =
      appType === "mvp"
        ? {
            projectName,
            repositoryUrl: repositoryUrl.trim(),
            platform: sourceRepo,
            branch: branchNorm,
            targetAppStore: null,
            appStoreBundleId: null,
            workflowMetadata: {
              techStackHint: mvpTechStack.trim() || undefined,
              cloudInfraHint: mvpCloudInfra.trim() || undefined,
              securityModules: mvpMods,
              mvpDeployKind: "none",
            },
          }
        : appType === "mobile"
          ? {
              appName,
              platform,
              appId: bundleId,
              version: mobileVersion,
              workflowMetadata: {
                backendApiUrl: mobileBackendApi.trim() || undefined,
                cloudProviderHint: mobileCloudProvider.trim() || undefined,
                securityModules: mobMods,
              },
            }
          : {
              appName: webAppName,
              appUrl: webAppUrl.trim(),
              hostingPlatform: webCloudHosting || "other",
              scanDepth:
                webScanDepth === "shallow" ? "quick" : webScanDepth === "moderate" ? "standard" : "comprehensive",
              authRequired: webAuthRequired,
              authType: webAuthRequired ? webAuthType : null,
              authUsername: webAuthRequired ? webAuthUsername : null,
              authPassword: webAuthRequired ? webAuthPassword : null,
              authLoginUrl: webAuthRequired && webAuthType === "form" ? webAuthLoginUrl : null,
              authApiKey: webAuthRequired && webAuthType === "api-key" ? webAuthApiKey : null,
              authTokenHeader: webAuthRequired && webAuthType === "api-key" ? "Authorization" : null,
              workflowMetadata: {
                securityModules: webMods,
              },
            };

    setWorkflowStatus("scanning");
    toast({
      title: "Starting scan",
      description: "Creating scan and analyzing your app…",
    });
    createScanMutation.mutate({ scanType: appType, scanData });
  };

  const getUploadDestinationDisplay = () => {
    if (appType === "mvp") {
      if (mvpDeployKind === "web" && mvpWebDeployUrl.trim()) return `Web: ${mvpWebDeployUrl.trim()}`;
      if (mvpDeployKind === "ios" || mvpDeployKind === "android") {
        return `${mvpDeployKind === "ios" ? "iOS" : "Android"} App Store (${mvpBundleId || "bundle TBD"})`;
      }
      return repositoryUrl.trim() ? `Repository: ${repositoryUrl.trim()}` : "Scan only (no deploy target)";
    }
    if (appType === "mobile") {
      return `${platform === "ios" ? "iOS" : "Android"} App Store (${bundleId})`;
    }
    return webAppUrl.trim() || "Web app";
  };

  const getUploadDestinationShortLabel = () => {
    if (appType === "mvp") {
      if (mvpDeployKind === "web") return "Web URL";
      if (mvpDeployKind === "ios") return "iOS App Store";
      if (mvpDeployKind === "android") return "Google Play Store";
      return "repository";
    }
    if (appType === "mobile") {
      return platform === "ios" ? "iOS App Store" : "Google Play Store";
    }
    return "production server";
  };

  const handleReUpload = async (withFixes: boolean, runTests: boolean = false) => {
    if (!currentScanId) {
      toast({
        title: "Upload unavailable",
        description: "No active scan ID. Try running the scan again.",
        variant: "destructive",
      });
      return;
    }

    if (appType === "mvp") {
      if (mvpDeployKind === "ios" || mvpDeployKind === "android") {
        if (!mvpBundleId.trim()) {
          toast({
            title: "Deployment",
            description: "Add a bundle ID or package name for the selected store, or choose Scan only / Web.",
            variant: "destructive",
          });
          return;
        }
      }
      if (mvpDeployKind === "web" && !mvpWebDeployUrl.trim()) {
        toast({
          title: "Deployment",
          description: "Add a web deployment URL or set deployment to Scan only.",
          variant: "destructive",
        });
        return;
      }
    }

    const destination = getUploadDestinationDisplay();

    try {
      const patchBody: Record<string, unknown> = {
        fixesApplied: withFixes,
        uploadPreference: withFixes ? "fix-and-upload" : "upload-without-fixes",
        autoUploadDestination: destination,
      };
      if (appType === "mvp") {
        patchBody.targetAppStore =
          mvpDeployKind === "ios" || mvpDeployKind === "android" ? mvpDeployKind : null;
        patchBody.appStoreBundleId =
          mvpDeployKind === "ios" || mvpDeployKind === "android" ? mvpBundleId.trim() || null : null;
        patchBody.workflowMetadata = {
          mvpDeployKind,
          mvpWebDeployUrl: mvpDeployKind === "web" ? mvpWebDeployUrl.trim() || undefined : undefined,
        };
      }

      await apiRequest("PATCH", `/api/${appType}-scans/${currentScanId}`, patchBody);

      const endpoint = runTests
        ? `/api/${appType}-scans/${currentScanId}/upload-and-test`
        : `/api/${appType}-scans/${currentScanId}/upload`;

      await apiRequest("POST", endpoint, {
        withFixes,
      });

      setWorkflowStatus("uploading");
      setUploadProgress(0);
      setUploadStatus("Queued…");

      const outcome = await pollScanUploadProgress(
        appType,
        currentScanId,
        (pct, label) => {
          setUploadProgress(pct);
          setUploadStatus(label);
        },
        { timeoutMs: 25000, intervalMs: 400 },
      );

      if (outcome === "failed") {
        toast({
          title: "Upload failed",
          description: "Check the scan details for more information.",
          variant: "destructive",
        });
        setWorkflowStatus("completed");
        return;
      }
      if (outcome === "timeout") {
        toast({
          title: "Upload still processing",
          description: "Open the scan detail page to see live upload status.",
        });
      } else {
        toast({
          title: runTests ? "Upload and tests complete" : "Upload complete",
          description: `Destination: ${destination}`,
        });
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error uploading scan:", error);
      setWorkflowStatus("completed");
      toast({
        title: "Upload Failed",
        description: "Failed to initiate upload. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setWorkflowStatus("idle");
    setUploadProgress(0);
    setUploadStatus("");
    setCurrentScanId(null); // Reset scan ID
    setProjectName("");
    setRepositoryUrl("");
    setBranch("main");
    setMvpTechStack("");
    setMvpCloudInfra("");
    setAppName("");
    setBundleId("");
    setMobileVersion("");
    setMobileBackendApi("");
    setMobileCloudProvider("");
    setWebAppName("");
    setWebAppUrl("");
    setWebScanDepth("moderate");
    setWebCloudHosting("");
    setWebAuthRequired(false);
    setWebSecurityModules(["SAST", "DAST"]);
    setMvpSecurityModules(["SAST", "SCA", "IaC", "Secrets"]);
    setMobileSecurityModules(["SAST", "SCA", "Secrets"]);
    setWorkflowAdvancedOpen(false);
    setMvpDeployKind("none");
    setMvpBundleId("");
    setMvpWebDeployUrl("");
    setScanResults({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    setIssues([]);
    setShowDetails(false);
  };

  const handleClose = () => {
    if (workflowStatus !== "idle" && workflowStatus !== "completed") {
      toast({
        title: "Operation in Progress",
        description: "Please wait for the current operation to complete",
        variant: "destructive",
      });
      return;
    }
    onOpenChange(false);
    resetForm();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Existing App Workflow</DialogTitle>
          <DialogDescription>
            Download your existing app, scan for security issues, and re-upload with fixes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs value={appType} onValueChange={(v) => setAppType(v as any)}>
            {!hideTabs && (
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mvp" data-testid="tab-existing-mvp" disabled={workflowStatus !== "idle"}>
                  <Code className="w-4 h-4 mr-2" />
                  MVP Code
                </TabsTrigger>
                <TabsTrigger value="mobile" data-testid="tab-existing-mobile" disabled={workflowStatus !== "idle"}>
                  <Smartphone className="w-4 h-4 mr-2" />
                  Mobile App
                </TabsTrigger>
                <TabsTrigger value="web" data-testid="tab-existing-web" disabled={workflowStatus !== "idle"}>
                  <Globe className="w-4 h-4 mr-2" />
                  Web App
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="mvp" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Download className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Download your MVP code from the repository, scan for vulnerabilities, and re-upload with fixes
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-project-name">Project Name *</Label><InfoTooltip size="wide" content="This label is only used inside this app: it appears in your scan history, lists, and reports so you can find this scan later. It does not need to match your repository URL or folder name. The repository URL and branch below define what we scan." testId="info-existing-project-name" /></div>
                  <Input
                    id="existing-project-name"
                    placeholder="e.g., My Existing MVP"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-project-name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-source-repo">Source Repository *</Label><InfoTooltip content="The platform where your existing code is hosted for download and scanning." testId="info-existing-source-repo" /></div>
                  <Select value={sourceRepo} onValueChange={(v) => setSourceRepo(v as any)} disabled={workflowStatus !== "idle"}>
                    <SelectTrigger id="existing-source-repo" data-testid="select-existing-source-repo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="bitbucket">Bitbucket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-repo-url">Repository URL *</Label><InfoTooltip content="The full URL to your existing code repository. Must be accessible for download." testId="info-existing-repo-url" /></div>
                  <Input
                    id="existing-repo-url"
                    placeholder="e.g., https://github.com/username/repo"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-repository-url"
                  />
                  {appConfig?.demoStrictScanTargets && appType === "mvp" && (
                    <p className="text-xs text-amber-800 dark:text-amber-200/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                      <strong>Demo hint:</strong> for disposable testing, consider e.g.{" "}
                      <code className="text-[11px]">https://github.com/octocat/Hello-World</code> or{" "}
                      <code className="text-[11px]">https://example.com/repo</code> — any value is accepted.
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-branch">Branch</Label><InfoTooltip content="The specific branch to download and scan. Defaults to 'main' if left empty." testId="info-existing-branch" /></div>
                  <Input
                    id="existing-branch"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-branch"
                  />
                </div>
              </div>

              <Collapsible open={workflowAdvancedOpen} onOpenChange={setWorkflowAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between px-0" disabled={workflowStatus !== "idle"}>
                    <span className="text-sm font-medium">Advanced (optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${workflowAdvancedOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="existing-mvp-tech-stack">Tech Stack (optional)</Label><InfoTooltip content="Helps tune analysis. Stored with the scan." testId="info-existing-mvp-tech-stack" /></div>
                      <Input
                        id="existing-mvp-tech-stack"
                        placeholder="e.g., React, Node.js, PostgreSQL"
                        value={mvpTechStack}
                        onChange={(e) => setMvpTechStack(e.target.value)}
                        disabled={workflowStatus !== "idle"}
                        data-testid="input-existing-mvp-tech-stack"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="existing-mvp-cloud-infra">Cloud/Infrastructure (optional)</Label><InfoTooltip content="Optional. The cloud platform or infrastructure your existing app uses." testId="info-existing-mvp-cloud-infra" /></div>
                      <Input
                        id="existing-mvp-cloud-infra"
                        placeholder="e.g., AWS, Azure, Google Cloud"
                        value={mvpCloudInfra}
                        onChange={(e) => setMvpCloudInfra(e.target.value)}
                        disabled={workflowStatus !== "idle"}
                        data-testid="input-existing-mvp-cloud-infra"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Security modules (optional)</Label>
                    <div className="flex flex-wrap gap-4">
                      {["SAST", "DAST", "SCA", "IaC", "Secrets"].map((m) => (
                        <label key={m} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={mvpSecurityModules.includes(m)}
                            onCheckedChange={(c) => {
                              if (c) setMvpSecurityModules([...mvpSecurityModules, m]);
                              else setMvpSecurityModules(mvpSecurityModules.filter((x) => x !== m));
                            }}
                            disabled={workflowStatus !== "idle"}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Defaults apply if none selected.</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Download className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Download your mobile app from the App Store, scan for vulnerabilities, and re-upload with fixes
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-app-name">App Name *</Label><InfoTooltip size="wide" content="This label is only used inside this app: it appears in your scan history, lists, and notifications so you can find this scan later. It does not need to match your App Store or Play Store listing title, or your bundle or package ID. Those are entered separately below." testId="info-existing-app-name" /></div>
                  <Input
                    id="existing-app-name"
                    placeholder="e.g., MyApp"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-app-name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-platform">Platform *</Label><InfoTooltip content="The platform your existing app is published on, iOS or Android." testId="info-existing-platform" /></div>
                  <Select value={platform} onValueChange={(v) => setPlatform(v as any)} disabled={workflowStatus !== "idle"}>
                    <SelectTrigger id="existing-platform" data-testid="select-existing-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ios">iOS (App Store)</SelectItem>
                      <SelectItem value="android">Android (Play Store)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-bundle-id">
                    {platform === "ios" ? "Bundle ID *" : "Package Name *"}
                  </Label><InfoTooltip content="The unique identifier of your existing app in the app store." testId="info-existing-bundle-id" /></div>
                  <Input
                    id="existing-bundle-id"
                    placeholder={platform === "ios" ? "e.g., com.company.app" : "e.g., com.company.app"}
                    value={bundleId}
                    onChange={(e) => setBundleId(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-bundle-id"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-mobile-version">Version *</Label><InfoTooltip content="The specific version of your app to download and scan." testId="info-existing-mobile-version" /></div>
                  <Input
                    id="existing-mobile-version"
                    placeholder="e.g., 1.0.0"
                    value={mobileVersion}
                    onChange={(e) => setMobileVersion(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-mobile-version"
                  />
                </div>
              </div>

              <Collapsible open={workflowAdvancedOpen} onOpenChange={setWorkflowAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between px-0" disabled={workflowStatus !== "idle"}>
                    <span className="text-sm font-medium">Advanced (optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${workflowAdvancedOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="existing-mobile-backend-api">Backend API (optional)</Label><InfoTooltip content="Optional. The URL of your app's backend API for additional security testing." testId="info-existing-mobile-backend-api" /></div>
                      <Input
                        id="existing-mobile-backend-api"
                        placeholder="e.g., https://api.myapp.com"
                        value={mobileBackendApi}
                        onChange={(e) => setMobileBackendApi(e.target.value)}
                        disabled={workflowStatus !== "idle"}
                        data-testid="input-existing-mobile-backend-api"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="existing-mobile-cloud-provider">Cloud provider (optional)</Label><InfoTooltip content="Optional. The cloud provider hosting your app's backend services." testId="info-existing-mobile-cloud-provider" /></div>
                      <Input
                        id="existing-mobile-cloud-provider"
                        placeholder="e.g., AWS, Azure, Google Cloud"
                        value={mobileCloudProvider}
                        onChange={(e) => setMobileCloudProvider(e.target.value)}
                        disabled={workflowStatus !== "idle"}
                        data-testid="input-existing-mobile-cloud-provider"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            <TabsContent value="web" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Download className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Download your web app from the live domain, scan for vulnerabilities, and re-upload with fixes
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-web-app-name">App Name *</Label><InfoTooltip size="wide" content="This label is only used inside this app: it appears in your scan history, lists, and reports so you can find this scan later. It does not need to match your site’s public name or domain. The live URL below is what we scan." testId="info-existing-web-app-name" /></div>
                  <Input
                    id="existing-web-app-name"
                    placeholder="e.g., My Web App"
                    value={webAppName}
                    onChange={(e) => setWebAppName(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-web-app-name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-web-app-url">Live App URL *</Label><InfoTooltip content="The full URL of your live web application to download and scan." testId="info-existing-web-app-url" /></div>
                  <Input
                    id="existing-web-app-url"
                    placeholder="e.g., https://myapp.com"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="input-existing-web-app-url"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-web-cloud-hosting">Cloud hosting (optional)</Label><InfoTooltip content="Where the site runs; defaults to Other if unset." testId="info-existing-web-cloud-hosting" /></div>
                  <Select value={webCloudHosting || "other"} onValueChange={setWebCloudHosting} disabled={workflowStatus !== "idle"}>
                    <SelectTrigger id="existing-web-cloud-hosting" data-testid="select-existing-web-cloud-hosting">
                      <SelectValue placeholder="Hosting platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replit">Replit</SelectItem>
                      <SelectItem value="vercel">Vercel</SelectItem>
                      <SelectItem value="netlify">Netlify</SelectItem>
                      <SelectItem value="heroku">Heroku</SelectItem>
                      <SelectItem value="aws">AWS</SelectItem>
                      <SelectItem value="azure">Azure</SelectItem>
                      <SelectItem value="google-cloud">Google Cloud</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="existing-web-scan-depth">Scan Depth *</Label><InfoTooltip content="Controls how thorough the security scan will be. Shallow is fastest, Deep is most comprehensive." testId="info-existing-web-scan-depth" /></div>
                  <Select value={webScanDepth} onValueChange={(v) => setWebScanDepth(v as any)} disabled={workflowStatus !== "idle"}>
                    <SelectTrigger id="existing-web-scan-depth" data-testid="select-existing-web-scan-depth">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shallow">Shallow (Quick scan)</SelectItem>
                      <SelectItem value="moderate">Moderate (Standard scan)</SelectItem>
                      <SelectItem value="deep">Deep (Comprehensive scan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="existing-web-auth-required"
                    checked={webAuthRequired}
                    onCheckedChange={(checked) => setWebAuthRequired(checked as boolean)}
                    disabled={workflowStatus !== "idle"}
                    data-testid="checkbox-existing-web-auth-required"
                  />
                  <Label htmlFor="existing-web-auth-required" className="cursor-pointer">
                    Authentication Required
                  </Label>
                  <InfoTooltip content="Check this if your web app requires login credentials for the scanner to access protected pages." testId="info-existing-web-auth-required" />
                </div>

                {/* Authentication Credentials Section */}
                {webAuthRequired && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30" data-testid="section-auth-credentials">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="existing-web-auth-type">Authentication Type *</Label><InfoTooltip content="The method used to authenticate with your web application during scanning." testId="info-existing-web-auth-type" /></div>
                      <Select value={webAuthType} onValueChange={(v) => setWebAuthType(v as any)} disabled={workflowStatus !== "idle"}>
                        <SelectTrigger id="existing-web-auth-type" data-testid="select-existing-web-auth-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic Authentication</SelectItem>
                          <SelectItem value="form">Form-Based Login</SelectItem>
                          <SelectItem value="api-key">API Key</SelectItem>
                          <SelectItem value="oauth">OAuth 2.0</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Basic Auth / Form Login Fields */}
                    {(webAuthType === "basic" || webAuthType === "form") && (
                      <>
                        {webAuthType === "form" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1"><Label htmlFor="existing-web-auth-login-url">Login URL *</Label><InfoTooltip content="The URL of your app's login page for form-based authentication." testId="info-existing-web-auth-login-url" /></div>
                            <Input
                              id="existing-web-auth-login-url"
                              placeholder="e.g., https://myapp.com/login"
                              value={webAuthLoginUrl}
                              onChange={(e) => setWebAuthLoginUrl(e.target.value)}
                              disabled={workflowStatus !== "idle"}
                              data-testid="input-existing-web-auth-login-url"
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1"><Label htmlFor="existing-web-auth-username">Username *</Label><InfoTooltip content="The test username for authentication during scanning. Never use production credentials." testId="info-existing-web-auth-username" /></div>
                            <Input
                              id="existing-web-auth-username"
                              placeholder="Enter username"
                              value={webAuthUsername}
                              onChange={(e) => setWebAuthUsername(e.target.value)}
                              disabled={workflowStatus !== "idle"}
                              data-testid="input-existing-web-auth-username"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-1"><Label htmlFor="existing-web-auth-password">Password *</Label><InfoTooltip content="The test password for authentication during scanning. Never use production credentials." testId="info-existing-web-auth-password" /></div>
                            <Input
                              id="existing-web-auth-password"
                              type="password"
                              placeholder="Enter password"
                              value={webAuthPassword}
                              onChange={(e) => setWebAuthPassword(e.target.value)}
                              disabled={workflowStatus !== "idle"}
                              data-testid="input-existing-web-auth-password"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* API Key Field */}
                    {webAuthType === "api-key" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1"><Label htmlFor="existing-web-auth-api-key">API Key *</Label><InfoTooltip content="The API key for authenticating requests during scanning." testId="info-existing-web-auth-api-key" /></div>
                        <Input
                          id="existing-web-auth-api-key"
                          type="password"
                          placeholder="Enter your API key"
                          value={webAuthApiKey}
                          onChange={(e) => setWebAuthApiKey(e.target.value)}
                          disabled={workflowStatus !== "idle"}
                          data-testid="input-existing-web-auth-api-key"
                        />
                      </div>
                    )}

                    {/* OAuth Notice */}
                    {webAuthType === "oauth" && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                          OAuth 2.0 authentication will prompt you to authorize access during the scan process.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label>Security modules (optional)</Label><InfoTooltip content="Defaults to all if none selected. Stored on the scan record." testId="info-existing-security-modules" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    {["SAST", "DAST", "SCA", "Secrets"].map((module) => {
                      const moduleDescriptions: Record<string, string> = {
                        "SAST": "Static Application Security Testing analyzes source code for vulnerabilities.",
                        "DAST": "Dynamic Application Security Testing tests your running application.",
                        "SCA": "Software Composition Analysis checks dependencies for known vulnerabilities.",
                        "Secrets": "Scans for accidentally exposed passwords, API keys, and tokens.",
                      };
                      return (
                      <div key={module} className="flex items-center space-x-2">
                        <Checkbox
                          id={`existing-web-module-${module}`}
                          checked={webSecurityModules.includes(module)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setWebSecurityModules([...webSecurityModules, module]);
                            } else {
                              setWebSecurityModules(webSecurityModules.filter((m) => m !== module));
                            }
                          }}
                          disabled={workflowStatus !== "idle"}
                          data-testid={`checkbox-existing-web-module-${module}`}
                        />
                        <Label htmlFor={`existing-web-module-${module}`} className="cursor-pointer">
                          {module}
                        </Label>
                        <InfoTooltip content={moduleDescriptions[module]} testId={`info-existing-web-module-${module.toLowerCase()}`} />
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Download & Scan Button */}
          {workflowStatus === "idle" && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} data-testid="button-existing-cancel">
                Cancel
              </Button>
              <InfoTooltip content="Downloads your app from the source and begins a security scan. This may take a few minutes." testId="info-existing-download-scan" />
              <Button onClick={handleDownloadAndScan} data-testid="button-download">
                <Download className="w-4 h-4 mr-2" />
                Download & Scan
              </Button>
            </div>
          )}

          {/* Scanning Progress */}
          {workflowStatus === "scanning" && (
            <Card className="p-6 bg-blue-500/10 border-blue-500/20">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-700 dark:text-blue-400">Scanning in Progress</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Analyzing your app for security vulnerabilities...
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>✓ Download complete</p>
                    <p>• Running security analysis...</p>
                    <p>• Checking dependencies...</p>
                    <p>• Detecting secrets...</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Upload Progress */}
          {workflowStatus === "uploading" && (
            <Card className="p-6 bg-green-500/10 border-green-500/20">
              <div className="flex items-start gap-3">
                <Upload className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-700 dark:text-green-400">Uploading to Destination</h3>
                  
                  {/* Destination Display */}
                  <div className="mt-2 p-3 bg-background/50 rounded-md border">
                    <p className="text-xs text-muted-foreground mb-1">Destination:</p>
                    <p className="text-sm font-medium break-all" data-testid="text-upload-destination">
                      {appType === "mvp" 
                        ? repositoryUrl || `${sourceRepo.charAt(0).toUpperCase() + sourceRepo.slice(1)} Repository`
                        : appType === "mobile"
                        ? `${platform === "ios" ? "iOS" : "Android"} App Store (${bundleId})`
                        : webAppUrl || "Live Domain"}
                    </p>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-3">
                    {uploadStatus}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold text-green-700 dark:text-green-400">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Upload Details */}
                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    <p>✓ Security scan completed</p>
                    <p className="flex items-center gap-1">
                      {uploadProgress >= 35 ? "✓" : "•"} {uploadProgress >= 35 ? "Fixes applied" : "Applying fixes..."}
                    </p>
                    <p className="flex items-center gap-1">
                      {uploadProgress >= 55 ? "✓" : "•"} {uploadProgress >= 55 ? "Files uploaded" : "Uploading files..."}
                    </p>
                    <p className="flex items-center gap-1">
                      {uploadProgress >= 90 ? "✓" : "•"} {uploadProgress >= 90 ? "Deployment finalized" : "Finalizing..."}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Scan Results */}
          {workflowStatus === "completed" && (
            <div className="space-y-4">
              <Card className="p-6 bg-orange-500/10 border-orange-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-700 dark:text-orange-400">Scan Complete</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Found {scanResults.total} security issues across all severity levels
                    </p>
                  </div>
                </div>
              </Card>

              {/* Severity Summary */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Severity Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="px-2" data-testid="badge-critical">{scanResults.critical}</Badge>
                    <span className="text-sm">Critical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="px-2 bg-orange-500 hover:bg-orange-600" data-testid="badge-high">{scanResults.high}</Badge>
                    <span className="text-sm">High</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="px-2 bg-yellow-500 hover:bg-yellow-600" data-testid="badge-medium">{scanResults.medium}</Badge>
                    <span className="text-sm">Medium</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-2" data-testid="badge-low">{scanResults.low}</Badge>
                    <span className="text-sm">Low</span>
                  </div>
                </div>
              </div>

              {/* Issue Details Toggle */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDetails(!showDetails)}
                data-testid="button-toggle-details"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Hide Issue Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show Issue Details ({issues.length} issues)
                  </>
                )}
              </Button>

              {/* Issue List */}
              {showDetails && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">All Issues Found</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {findingsStatus === "loading" ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading security issues...
                      </div>
                    ) : findingsStatus === "error" ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-destructive mb-2">Failed to load security issues</p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => currentScanId && appType && fetchFindings(currentScanId, appType)}
                          data-testid="button-retry-findings"
                        >
                          Retry
                        </Button>
                      </div>
                    ) : issues.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No security issues found
                      </p>
                    ) : (
                      issues.map((issue) => (
                        <div key={issue.id} className="border rounded-lg p-3 hover-elevate" data-testid={`issue-${issue.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-medium">{issue.title}</h4>
                            <Badge variant={getSeverityColor(issue.severity)} className="capitalize">
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">{issue.description}</p>
                          {issue.cwe && <p className="text-xs text-muted-foreground">CWE-{issue.cwe}</p>}
                          {issue.location && <p className="text-xs text-muted-foreground font-mono mt-1">{issue.location}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              )}

              {appType === "mvp" && (
                <Card className="p-4 border-dashed bg-muted/20">
                  <h3 className="font-semibold mb-1">Deployment destination (optional)</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set before re-upload so we record the correct App Store, Play Store, or web URL.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="existing-post-mvp-deploy-kind">Target</Label>
                      <Select value={mvpDeployKind} onValueChange={(v) => setMvpDeployKind(v as "none" | "ios" | "android" | "web")}>
                        <SelectTrigger id="existing-post-mvp-deploy-kind" data-testid="select-existing-post-mvp-deploy-kind">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Scan only (no deploy target yet)</SelectItem>
                          <SelectItem value="ios">iOS App Store</SelectItem>
                          <SelectItem value="android">Android Play Store</SelectItem>
                          <SelectItem value="web">Web URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(mvpDeployKind === "ios" || mvpDeployKind === "android") && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="existing-post-mvp-bundle-id">
                          {mvpDeployKind === "ios" ? "Bundle ID" : "Package Name"}
                        </Label>
                        <Input
                          id="existing-post-mvp-bundle-id"
                          placeholder="e.g., com.company.app"
                          value={mvpBundleId}
                          onChange={(e) => setMvpBundleId(e.target.value)}
                          data-testid="input-existing-post-mvp-bundle-id"
                        />
                      </div>
                    )}
                    {mvpDeployKind === "web" && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="existing-post-mvp-web-deploy">Web deployment URL</Label>
                        <Input
                          id="existing-post-mvp-web-deploy"
                          placeholder="https://app.example.com"
                          value={mvpWebDeployUrl}
                          onChange={(e) => setMvpWebDeployUrl(e.target.value)}
                          data-testid="input-existing-post-mvp-web-deploy"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Re-upload Options */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} data-testid="button-close">
                  Cancel
                </Button>
                <InfoTooltip content="Re-deploys your app as-is without applying security fixes. Not recommended if critical issues were found." testId="info-existing-reupload-without-fixes" />
                <Button variant="outline" onClick={() => setShowUploadWithoutFixesWarning(true)} data-testid="button-reupload-without-fixes">
                  <Upload className="w-4 h-4 mr-2" />
                  Re-upload without Fixes
                </Button>
                <InfoTooltip content="Applies AI-powered security fixes before re-deploying. Issues older than 30 days cost $2.00 each." testId="info-existing-reupload-with-fixes" />
                <Button onClick={() => setShowPostFixValidation(true)} data-testid="button-reupload-with-fixes">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Re-upload with Fixes (Paid)
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* Upload Warning Dialogs */}
      {currentScanId && (
        <>
          <UploadWithoutFixesWarningDialog
            open={showUploadWithoutFixesWarning}
            onOpenChange={setShowUploadWithoutFixesWarning}
            scanType={appType === "mvp" ? "mvp" : appType === "mobile" ? "mobile" : "web"}
            scanId={currentScanId}
            destination={getUploadDestinationShortLabel()}
            onProceedAnyway={() => {
              setShowUploadWithoutFixesWarning(false);
              handleReUpload(false);
            }}
            onResolveIssues={() => {
              setShowUploadWithoutFixesWarning(false);
              setShowPostFixValidation(true);
            }}
          />
          
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
            scanType={appType === "mvp" ? "mvp" : appType === "mobile" ? "mobile" : "web"}
            scanId={currentScanId}
            destination={getUploadDestinationShortLabel()}
            onProceedWithUpload={async (runTests = false) => {
              // Don't close dialog immediately - let it show loading state
              // Start the upload process
              await handleReUpload(true, runTests);
              // Close dialog after upload initiated
              setShowUploadWithFixesOptions(false);
            }}
          />
          
          <PostFixValidationDialog
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
            scanType={appType === "mvp" ? "mvp" : appType === "mobile" ? "mobile" : "web"}
            scanId={currentScanId}
            onValidationComplete={() => {
              setShowPostFixValidation(false);
            }}
            onRequestUpload={() => {
              setShowPostFixValidation(false);
              setShowUploadWithFixesOptions(true);
            }}
          />
        </>
      )}
    </Dialog>
  );
}
