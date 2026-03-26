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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Code,
  Smartphone,
  Globe,
  Upload,
  CheckCircle,
  GitBranch,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Database,
} from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pollScanUploadProgress } from "@/lib/uploadScanPoll";
import { UploadWithoutFixesWarningDialog } from "@/components/UploadWithoutFixesWarningDialog";
import { UploadWithFixesOptionsDialog } from "@/components/UploadWithFixesOptionsDialog";
import { PostFixValidationDialog } from "@/components/PostFixValidationDialog";
import type { ScanType } from "@/hooks/use-scan-findings";
import type { Finding } from "@shared/schema";

type WorkflowAppType = "mvp" | "mobile" | "web" | "container";

interface NewAppWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAppType?: WorkflowAppType;
  hideTabs?: boolean;
}

type AppConfigPayload = {
  demoMode: boolean;
  demoStrictScanTargets?: boolean;
  demoScanHint: string | null;
};

export function NewAppWorkflowDialog({ open, onOpenChange, defaultAppType, hideTabs = false }: NewAppWorkflowDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: appConfig } = useQuery<AppConfigPayload>({
    queryKey: ["/api/app-config"],
  });
  /** Production build + non-demo: enforce parseable URLs. Dev or demo mode: any non-empty target text. */
  const strictProdScanUrls = import.meta.env.PROD && appConfig?.demoMode !== true;
  const [appType, setAppType] = useState<WorkflowAppType>(defaultAppType || "mvp");
  
  // Reset state when dialog opens or defaultAppType changes
  useEffect(() => {
    if (open && defaultAppType) {
      setAppType(defaultAppType);
    }
  }, [open, defaultAppType]);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "completed" | "uploading">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  
  // Source repository fields (where code comes from)
  const [sourceRepo, setSourceRepo] = useState<"github" | "gitlab" | "bitbucket" | "custom">("github");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("main");
  
  // Common fields
  const [projectName, setProjectName] = useState("");
  
  // MVP deployment (optional): none = scan only; ios/android = store; web = deploy URL
  const [mvpDeployKind, setMvpDeployKind] = useState<"none" | "ios" | "android" | "web">("none");
  const [mvpBundleId, setMvpBundleId] = useState("");
  const [mvpWebDeployUrl, setMvpWebDeployUrl] = useState("");
  const [mvpTechStack, setMvpTechStack] = useState("");
  const [mvpCloudInfra, setMvpCloudInfra] = useState("");
  const [mvpSecurityModules, setMvpSecurityModules] = useState<string[]>(["SAST", "SCA", "IaC", "Secrets"]);
  const [workflowAdvancedOpen, setWorkflowAdvancedOpen] = useState(false);
  
  // Mobile fields
  const [mobileAppName, setMobileAppName] = useState("");
  const [mobilePlatform, setMobilePlatform] = useState<"ios" | "android">("ios");
  const [mobileAppId, setMobileAppId] = useState("");
  const [mobileVersion, setMobileVersion] = useState("");
  const [mobileBackendApi, setMobileBackendApi] = useState("");
  const [mobileCloudProvider, setMobileCloudProvider] = useState("");
  
  // Web deployment fields
  const [webAppName, setWebAppName] = useState("");
  const [webDomainUrl, setWebDomainUrl] = useState("");
  const [webScanDepth, setWebScanDepth] = useState<"shallow" | "moderate" | "deep">("moderate");
  const [webCloudHosting, setWebCloudHosting] = useState("");
  const [webAuthRequired, setWebAuthRequired] = useState(false);
  const [webAuthType, setWebAuthType] = useState<"basic" | "form" | "api-key">("basic");
  const [webAuthUsername, setWebAuthUsername] = useState("");
  const [webAuthPassword, setWebAuthPassword] = useState("");
  const [webAuthLoginUrl, setWebAuthLoginUrl] = useState("");
  const [webAuthApiKey, setWebAuthApiKey] = useState("");
  const [webAuthTokenHeader, setWebAuthTokenHeader] = useState("Authorization");
  const [webSecurityModules, setWebSecurityModules] = useState<string[]>(["SAST", "DAST"]);
  const [mobileSecurityModules, setMobileSecurityModules] = useState<string[]>(["SAST", "SCA", "Secrets"]);

  const [containerImageName, setContainerImageName] = useState("");
  const [containerImageTag, setContainerImageTag] = useState("latest");
  const [containerRegistry, setContainerRegistry] = useState("docker-hub");
  const [containerRegistryUrl, setContainerRegistryUrl] = useState("");

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
    mutationFn: async ({
      scanType,
      scanData,
    }: {
      scanType: WorkflowAppType;
      scanData: Record<string, unknown>;
    }) => {
      let response: Response;
      if (scanType === "mvp") {
        response = await apiRequest("POST", "/api/mvp-scans", scanData);
      } else if (scanType === "mobile") {
        response = await apiRequest("POST", "/api/mobile-scans", scanData);
      } else if (scanType === "container") {
        response = await apiRequest("POST", "/api/container-scans", scanData);
      } else {
        response = await apiRequest("POST", "/api/web-scans", scanData);
      }
      const result = await response.json();
      return { ...result, scanType };
    },
    onSuccess: async (data: { id: string; scanType: WorkflowAppType }) => {
      const scanId = data.id;
      const scanType = data.scanType;
      setCurrentScanId(scanId);

      const pollScanUntilDone = (
        apiPath: string,
        invalidateKey: string,
        findingsScanType: string,
        maxPollAttempts: number,
      ) => {
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          try {
            pollCount++;
            const response = await apiRequest("GET", `${apiPath}/${scanId}`);
            const scanRow = await response.json();

            if (scanRow.scanStatus === "completed" || scanRow.scanStatus === "failed") {
              clearInterval(pollInterval);
              queryClient.invalidateQueries({ queryKey: [invalidateKey] });
              queryClient.invalidateQueries({ queryKey: ["/api/findings"] });

              if (scanRow.scanStatus === "completed") {
                setScanResults({
                  total: scanRow.findingsCount || 0,
                  critical: scanRow.criticalCount || 0,
                  high: scanRow.highCount || 0,
                  medium: scanRow.mediumCount || 0,
                  low: scanRow.lowCount || 0,
                });
                await fetchFindings(scanId, findingsScanType);
                setScanStatus("completed");
                toast({
                  title: "Scan Complete",
                  description: `Found ${scanRow.findingsCount || 0} security issues. Check Findings page for details.`,
                });
              } else {
                setScanStatus("idle");
                toast({
                  title: "Scan Failed",
                  description: "The security scan failed to complete",
                  variant: "destructive",
                });
              }
            } else if (pollCount >= maxPollAttempts) {
              clearInterval(pollInterval);
              setScanStatus("idle");
              toast({
                title: "Scan Timeout",
                description: "The scan is taking longer than expected. Please check All Scans page for status.",
                variant: "destructive",
              });
            }
          } catch (error) {
            clearInterval(pollInterval);
            setScanStatus("idle");
            console.error("Error polling scan status:", error);
            toast({
              title: "Polling Error",
              description: "Failed to check scan status",
              variant: "destructive",
            });
          }
        }, 1000);
      };

      try {
        if (scanType === "container") {
          pollScanUntilDone("/api/container-scans", "/api/container-scans", "container", 120);
          return;
        }

        await apiRequest("POST", `/api/${scanType}-scans/${scanId}/scan`);
        pollScanUntilDone(`/api/${scanType}-scans`, `/api/${scanType}-scans`, scanType, 60);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to start scan";
        toast({
          title: "Could not start scan",
          description: msg,
          variant: "destructive",
        });
        setScanStatus("idle");
      }
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to create scan";
      toast({
        title: "Could not create scan",
        description: msg,
        variant: "destructive",
      });
      setScanStatus("idle");
    },
  });

  const branchNormalized = branch.trim() || "main";

  const getUploadDestinationDisplay = () => {
    if (appType === "container") {
      const tag = containerImageTag.trim() || "latest";
      return `${containerImageName.trim() || "image"}:${tag}`;
    }
    if (appType === "mvp") {
      if (mvpDeployKind === "web" && mvpWebDeployUrl.trim()) return `Web: ${mvpWebDeployUrl.trim()}`;
      if (mvpDeployKind === "ios" || mvpDeployKind === "android") {
        return `${mvpDeployKind === "ios" ? "iOS" : "Android"} App Store (${mvpBundleId || "bundle TBD"})`;
      }
      return repositoryUrl.trim() ? `Repository: ${repositoryUrl.trim()}` : "Scan only (no deploy target)";
    }
    if (appType === "mobile") {
      return `${mobilePlatform === "ios" ? "iOS" : "Android"} App Store (${mobileAppId})`;
    }
    return webDomainUrl.trim() || "Web app";
  };

  const getUploadDestinationShortLabel = () => {
    if (appType === "container") return "container image";
    if (appType === "mvp") {
      if (mvpDeployKind === "web") return "Web URL";
      if (mvpDeployKind === "ios") return "iOS App Store";
      if (mvpDeployKind === "android") return "Google Play Store";
      return "repository";
    }
    if (appType === "mobile") {
      return mobilePlatform === "ios" ? "iOS App Store" : "Google Play Store";
    }
    return "production server";
  };

  const handleStartScan = () => {
    if (appType === "mvp") {
      if (!projectName.trim()) {
        toast({ title: "Missing Information", description: "Please provide a project name", variant: "destructive" });
        return;
      }
      if (!repositoryUrl.trim()) {
        toast({ title: "Missing Information", description: "Please provide a repository URL to scan", variant: "destructive" });
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
      if (!mobileAppName.trim()) {
        toast({ title: "Missing Information", description: "Please provide an app name", variant: "destructive" });
        return;
      }
      if (!mobileAppId.trim() || !mobileVersion.trim()) {
        toast({
          title: "Missing Information",
          description: "Please provide bundle/package ID and version",
          variant: "destructive",
        });
        return;
      }
    }

    if (appType === "web") {
      if (!webAppName.trim()) {
        toast({ title: "Missing Information", description: "Please provide an app name", variant: "destructive" });
        return;
      }
      if (!webDomainUrl.trim()) {
        toast({ title: "Missing Information", description: "Please provide the live domain URL to scan", variant: "destructive" });
        return;
      }
      if (strictProdScanUrls) {
        try {
          // eslint-disable-next-line no-new
          new URL(webDomainUrl.trim());
        } catch {
          toast({
            title: "Invalid application URL",
            description: "Use a full URL starting with https:// (e.g. https://example.com).",
            variant: "destructive",
          });
          return;
        }
      }
      if (webAuthRequired) {
        if (webAuthType === "basic" || webAuthType === "form") {
          if (!webAuthUsername || !webAuthPassword) {
            toast({
              title: "Missing Authentication Credentials",
              description: "Please provide username and password for authentication",
              variant: "destructive",
            });
            return;
          }
          if (webAuthType === "form" && !webAuthLoginUrl) {
            toast({
              title: "Missing Login URL",
              description: "Please provide the login page URL for form-based authentication",
              variant: "destructive",
            });
            return;
          }
        }
        if (webAuthType === "api-key") {
          if (!webAuthApiKey || !webAuthTokenHeader) {
            toast({
              title: "Missing API Credentials",
              description: "Please provide API key and header name",
              variant: "destructive",
            });
            return;
          }
        }
      }
    }

    if (appType === "container") {
      if (!containerImageName.trim()) {
        toast({
          title: "Missing Information",
          description: "Enter an image repository (e.g. nginx or bitnami/redis).",
          variant: "destructive",
        });
        return;
      }
      if (containerRegistry === "custom" && !containerRegistryUrl.trim()) {
        toast({
          title: "Missing Information",
          description: "For a custom registry, enter the base URL (OCI v2, e.g. https://registry.example.io).",
          variant: "destructive",
        });
        return;
      }
    }

    setScanStatus("scanning");

    const webMods = webSecurityModules.length > 0 ? webSecurityModules : ["SAST", "DAST", "SCA", "Secrets"];
    const mvpMods = mvpSecurityModules.length > 0 ? mvpSecurityModules : ["SAST", "SCA", "IaC", "Secrets"];
    const mobMods = mobileSecurityModules.length > 0 ? mobileSecurityModules : ["SAST", "SCA", "Secrets"];

    const scanData: Record<string, unknown> =
      appType === "mvp"
        ? {
            projectName,
            repositoryUrl: repositoryUrl.trim(),
            platform: sourceRepo,
            branch: branchNormalized,
            targetAppStore: null,
            appStoreBundleId: null,
            workflowMetadata: {
              techStackHint: mvpTechStack.trim() || undefined,
              cloudInfraHint: mvpCloudInfra.trim() || undefined,
              securityModules: mvpMods,
              mvpDeployKind: "none" as const,
            },
          }
        : appType === "mobile"
          ? {
              appName: mobileAppName,
              platform: mobilePlatform,
              appId: mobileAppId,
              version: mobileVersion,
              workflowMetadata: {
                sourceRepositoryUrl: repositoryUrl.trim() || undefined,
                sourceBranch: branchNormalized,
                backendApiUrl: mobileBackendApi.trim() || undefined,
                cloudProviderHint: mobileCloudProvider.trim() || undefined,
                securityModules: mobMods,
              },
            }
          : appType === "container"
            ? {
                scanType: "docker-image",
                imageName: containerImageName.trim(),
                imageTag: containerImageTag.trim() || "latest",
                registry: containerRegistry,
                registryUrl:
                  containerRegistry === "custom" ? containerRegistryUrl.trim() || null : null,
                scanStatus: "pending",
                findingsCount: 0,
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0,
              }
            : {
                appName: webAppName,
                appUrl: webDomainUrl.trim(),
                hostingPlatform: webCloudHosting || "other",
                scanDepth:
                  webScanDepth === "shallow" ? "quick" : webScanDepth === "moderate" ? "standard" : "comprehensive",
                authRequired: webAuthRequired,
                authType: webAuthRequired ? webAuthType : null,
                authUsername: webAuthRequired ? webAuthUsername : null,
                authPassword: webAuthRequired ? webAuthPassword : null,
                authLoginUrl: webAuthRequired && webAuthType === "form" ? webAuthLoginUrl : null,
                authApiKey: webAuthRequired && webAuthType === "api-key" ? webAuthApiKey : null,
                authTokenHeader: webAuthRequired && webAuthType === "api-key" ? webAuthTokenHeader : null,
                workflowMetadata: {
                  sourceRepositoryUrl: repositoryUrl.trim() || undefined,
                  sourceBranch: branchNormalized,
                  securityModules: webMods,
                },
              };

    createScanMutation.mutate({ scanType: appType, scanData });
  };

  const handleUpload = async (withFixes: boolean, runTests: boolean = false) => {
    if (!currentScanId) {
      toast({
        title: "Upload unavailable",
        description: "No active scan ID. Try running the scan again.",
        variant: "destructive",
      });
      return;
    }

    if (appType === "container") {
      toast({
        title: "Not applicable",
        description: "Container image scans do not use fix-and-upload. View findings or scan details instead.",
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

      setScanStatus("uploading");
      setUploadProgress(0);
      setUploadStatus("Queued…");

      await apiRequest("POST", endpoint, {
        withFixes,
      });

      queryClient.invalidateQueries({ queryKey: [`/api/${appType}-scans`] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });

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
        setScanStatus("completed");
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
      setScanStatus("completed");
      toast({
        title: "Upload Failed",
        description: "Failed to initiate upload. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setScanStatus("idle");
    setUploadProgress(0);
    setUploadStatus("");
    setCurrentScanId(null); // Reset scan ID
    setProjectName("");
    setRepositoryUrl("");
    setBranch("main");
    setMvpDeployKind("none");
    setMvpBundleId("");
    setMvpWebDeployUrl("");
    setMvpTechStack("");
    setMvpCloudInfra("");
    setMvpSecurityModules(["SAST", "SCA", "IaC", "Secrets"]);
    setMobileSecurityModules(["SAST", "SCA", "Secrets"]);
    setWorkflowAdvancedOpen(false);
    setMobileAppName("");
    setMobileAppId("");
    setMobileVersion("");
    setMobileBackendApi("");
    setMobileCloudProvider("");
    setWebAppName("");
    setWebDomainUrl("");
    setWebScanDepth("moderate");
    setWebCloudHosting("");
    setWebAuthRequired(false);
    setWebSecurityModules(["SAST", "DAST"]);
    setContainerImageName("");
    setContainerImageTag("latest");
    setContainerRegistry("docker-hub");
    setContainerRegistryUrl("");
    setScanResults({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    setIssues([]);
    setShowDetails(false);
  };

  const handleClose = () => {
    if (scanStatus === "scanning") {
      toast({
        title: "Scan in Progress",
        description: "Please wait for the scan to complete",
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
          <DialogTitle>New App Workflow</DialogTitle>
          <DialogDescription>
            Scan code from your repository and deploy to your chosen platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs value={appType} onValueChange={(v) => setAppType(v as WorkflowAppType)}>
            {!hideTabs && (
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-1 p-1">
                <TabsTrigger value="mvp" className="text-xs sm:text-sm" data-testid="tab-mvp" disabled={scanStatus !== "idle"}>
                  <Code className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                  MVP Code
                </TabsTrigger>
                <TabsTrigger value="mobile" className="text-xs sm:text-sm" data-testid="tab-mobile" disabled={scanStatus !== "idle"}>
                  <Smartphone className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                  Mobile App
                </TabsTrigger>
                <TabsTrigger value="web" className="text-xs sm:text-sm" data-testid="tab-web" disabled={scanStatus !== "idle"}>
                  <Globe className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                  Web App
                </TabsTrigger>
                <TabsTrigger value="container" className="text-xs sm:text-sm" data-testid="tab-container" disabled={scanStatus !== "idle"}>
                  <Database className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                  Container
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="mvp" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scan code from repository and deploy to App Store
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="project-name">Project Name *</Label><InfoTooltip size="wide" content="This label is only used inside this app: it appears in your scan history, lists, and reports so you can find this scan later. It does not need to match your repository URL or folder name. The repository URL and branch below define what we scan." testId="info-project-name" /></div>
                  <Input
                    id="project-name"
                    placeholder="e.g., My Awesome MVP"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-project-name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="source-repo">Code Source *</Label><InfoTooltip content="The repository platform where your source code is hosted." testId="info-source-repo" /></div>
                  <Select value={sourceRepo} onValueChange={(v) => setSourceRepo(v as any)} disabled={scanStatus !== "idle"}>
                    <SelectTrigger id="source-repo" data-testid="select-source-repo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="bitbucket">Bitbucket</SelectItem>
                      <SelectItem value="custom">Custom Repository</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="repo-url">Repository URL *</Label><InfoTooltip content="The full URL to your code repository. Must be accessible for scanning." testId="info-repo-url" /></div>
                  <Input
                    id="repo-url"
                    placeholder="e.g., https://github.com/username/repo"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-repository-url"
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
                  <div className="flex items-center gap-1"><Label htmlFor="branch">Branch</Label><InfoTooltip content="The specific branch to scan. Defaults to 'main' if left empty." testId="info-branch" /></div>
                  <Input
                    id="branch"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-branch"
                  />
                </div>
              </div>

              <Collapsible open={workflowAdvancedOpen} onOpenChange={setWorkflowAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between px-0" disabled={scanStatus !== "idle"}>
                    <span className="text-sm font-medium">Advanced (optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${workflowAdvancedOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="mvp-tech-stack">Tech Stack (optional)</Label><InfoTooltip content="Helps tune analysis. Stored with the scan." testId="info-mvp-tech-stack" /></div>
                      <Input
                        id="mvp-tech-stack"
                        placeholder="e.g., React, Node.js, PostgreSQL"
                        value={mvpTechStack}
                        onChange={(e) => setMvpTechStack(e.target.value)}
                        disabled={scanStatus !== "idle"}
                        data-testid="input-mvp-tech-stack"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="mvp-cloud-infra">Cloud/Infrastructure (optional)</Label><InfoTooltip content="Optional. Where you plan to host or deploy." testId="info-mvp-cloud-infra" /></div>
                      <Input
                        id="mvp-cloud-infra"
                        placeholder="e.g., AWS, Azure, Google Cloud"
                        value={mvpCloudInfra}
                        onChange={(e) => setMvpCloudInfra(e.target.value)}
                        disabled={scanStatus !== "idle"}
                        data-testid="input-mvp-cloud-infra"
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
                            disabled={scanStatus !== "idle"}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      DAST applies to deployed URLs (web workflow), not the repo clone. IaC scans Terraform, Dockerfiles, Kubernetes/Helm YAML, and compose files. Stored on the scan and used by the scanner.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Identify the app build to scan. Repository details are optional and stored for reporting.
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-app-name">App Name *</Label><InfoTooltip size="wide" content="This label is only used inside this app: it appears in your scan history, lists, and notifications so you can find this scan later. It does not need to match your App Store or Play Store listing title, or your bundle or package ID. Those are entered separately below." testId="info-mobile-app-name" /></div>
                  <Input
                    id="mobile-app-name"
                    placeholder="e.g., MyApp"
                    value={mobileAppName}
                    onChange={(e) => setMobileAppName(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-mobile-app-name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-version">Version Number *</Label><InfoTooltip content="The version of your mobile app being scanned, e.g. 1.0.0." testId="info-mobile-version" /></div>
                  <Input
                    id="mobile-version"
                    placeholder="e.g., 1.0.0"
                    value={mobileVersion}
                    onChange={(e) => setMobileVersion(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-mobile-version"
                  />
                </div>
              </div>

              <Collapsible open={workflowAdvancedOpen} onOpenChange={setWorkflowAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between px-0" disabled={scanStatus !== "idle"}>
                    <span className="text-sm font-medium">Advanced (optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${workflowAdvancedOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="mobile-source-repo">Code Source</Label><InfoTooltip content="If you link a repo for reference." testId="info-mobile-source-repo" /></div>
                      <Select value={sourceRepo} onValueChange={(v) => setSourceRepo(v as any)} disabled={scanStatus !== "idle"}>
                        <SelectTrigger id="mobile-source-repo" data-testid="select-mobile-source-repo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github">GitHub</SelectItem>
                          <SelectItem value="gitlab">GitLab</SelectItem>
                          <SelectItem value="bitbucket">Bitbucket</SelectItem>
                          <SelectItem value="custom">Custom Repository</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="mobile-branch">Branch</Label><InfoTooltip content="Defaults to main when empty." testId="info-mobile-branch" /></div>
                      <Input
                        id="mobile-branch"
                        placeholder="main"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        disabled={scanStatus !== "idle"}
                        data-testid="input-mobile-branch"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="mobile-repo-url">Repository URL (optional)</Label><InfoTooltip content="Reporting only — stored on the scan; does not change scan targets." testId="info-mobile-repo-url" /></div>
                      <Input
                        id="mobile-repo-url"
                        placeholder="e.g., https://github.com/username/mobile-app"
                        value={repositoryUrl}
                        onChange={(e) => setRepositoryUrl(e.target.value)}
                        disabled={scanStatus !== "idle"}
                        data-testid="input-mobile-repository-url"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="mobile-backend-api">Backend API (optional)</Label><InfoTooltip content="Optional backend URL for context." testId="info-mobile-backend-api" /></div>
                      <Input
                        id="mobile-backend-api"
                        placeholder="e.g., https://api.myapp.com"
                        value={mobileBackendApi}
                        onChange={(e) => setMobileBackendApi(e.target.value)}
                        disabled={scanStatus !== "idle"}
                        data-testid="input-mobile-backend-api"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="mobile-cloud-provider">Cloud/Backend provider (optional)</Label><InfoTooltip content="Optional. Where backend services run." testId="info-mobile-cloud-provider" /></div>
                    <Input
                      id="mobile-cloud-provider"
                      placeholder="e.g., AWS, Firebase, Azure"
                      value={mobileCloudProvider}
                      onChange={(e) => setMobileCloudProvider(e.target.value)}
                      disabled={scanStatus !== "idle"}
                      data-testid="input-mobile-cloud-provider"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Security modules (optional)</Label>
                    <div className="flex flex-wrap gap-4">
                      {["SAST", "SCA", "Secrets"].map((m) => (
                        <label key={m} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={mobileSecurityModules.includes(m)}
                            onCheckedChange={(c) => {
                              if (c) setMobileSecurityModules([...mobileSecurityModules, m]);
                              else setMobileSecurityModules(mobileSecurityModules.filter((x) => x !== m));
                            }}
                            disabled={scanStatus !== "idle"}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="border-t pt-4">
                <div className="flex items-center gap-1 mb-3"><h3 className="font-semibold">App Store Details</h3><InfoTooltip content="Details about where your app will be published in the app store." testId="info-mobile-app-store-details" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="mobile-platform">Platform *</Label><InfoTooltip content="The target mobile platform for your app deployment." testId="info-mobile-platform" /></div>
                    <Select value={mobilePlatform} onValueChange={(v) => setMobilePlatform(v as any)} disabled={scanStatus !== "idle"}>
                      <SelectTrigger id="mobile-platform" data-testid="select-mobile-platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ios">iOS App Store</SelectItem>
                        <SelectItem value="android">Android Play Store</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="mobile-app-id">
                      {mobilePlatform === "ios" ? "Bundle ID *" : "Package Name *"}
                    </Label><InfoTooltip content="The unique identifier for your mobile app in the app store." testId="info-mobile-app-id" /></div>
                    <Input
                      id="mobile-app-id"
                      placeholder="e.g., com.company.app"
                      value={mobileAppId}
                      onChange={(e) => setMobileAppId(e.target.value)}
                      disabled={scanStatus !== "idle"}
                      data-testid="input-mobile-app-id"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="web" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scan the live URL (DAST). Linking a source repo is optional and stored for your records.
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="web-app-name">App Name *</Label><InfoTooltip size="wide" content="This label is only used inside this app: it appears in your scan history, lists, and reports so you can find this scan later. It does not need to match your site’s public name or domain. The live URL below is what we scan." testId="info-web-app-name" /></div>
                  <Input
                    id="web-app-name"
                    placeholder="e.g., My Web App"
                    value={webAppName}
                    onChange={(e) => setWebAppName(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-web-app-name"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="web-domain-url">Live URL to scan *</Label><InfoTooltip content="The deployed site URL to run dynamic checks against." testId="info-web-domain-url" /></div>
                  <Input
                    id="web-domain-url"
                    placeholder="e.g., https://myapp.com"
                    value={webDomainUrl}
                    onChange={(e) => setWebDomainUrl(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-web-domain-url"
                  />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <div className="flex items-center gap-1"><Label htmlFor="web-scan-depth">Scan Depth *</Label><InfoTooltip content="Controls how thorough the security scan will be. Shallow is fastest, Deep is most comprehensive." testId="info-web-scan-depth" /></div>
                <Select value={webScanDepth} onValueChange={(v) => setWebScanDepth(v as any)} disabled={scanStatus !== "idle"}>
                  <SelectTrigger id="web-scan-depth" data-testid="select-web-scan-depth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shallow">Shallow - Quick scan of critical areas</SelectItem>
                    <SelectItem value="moderate">Moderate - Standard comprehensive scan</SelectItem>
                    <SelectItem value="deep">Deep - Exhaustive security testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Collapsible open={workflowAdvancedOpen} onOpenChange={setWorkflowAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between px-0" disabled={scanStatus !== "idle"}>
                    <span className="text-sm font-medium">Advanced (optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${workflowAdvancedOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="web-source-repo">Code source</Label><InfoTooltip content="If you want to record where source lives." testId="info-web-source-repo" /></div>
                      <Select value={sourceRepo} onValueChange={(v) => setSourceRepo(v as any)} disabled={scanStatus !== "idle"}>
                        <SelectTrigger id="web-source-repo" data-testid="select-web-source-repo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github">GitHub</SelectItem>
                          <SelectItem value="gitlab">GitLab</SelectItem>
                          <SelectItem value="bitbucket">Bitbucket</SelectItem>
                          <SelectItem value="custom">Custom Repository</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="web-branch">Branch</Label><InfoTooltip content="Defaults to main when empty." testId="info-web-branch" /></div>
                      <Input
                        id="web-branch"
                        placeholder="main"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        disabled={scanStatus !== "idle"}
                        data-testid="input-web-branch"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="web-repo-url">Repository URL (optional)</Label><InfoTooltip content="Stored with the scan; not required for DAST." testId="info-web-repo-url" /></div>
                    <Input
                      id="web-repo-url"
                      placeholder="e.g., https://github.com/username/web-app"
                      value={repositoryUrl}
                      onChange={(e) => setRepositoryUrl(e.target.value)}
                      disabled={scanStatus !== "idle"}
                      data-testid="input-web-repository-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="web-cloud-hosting">Cloud / infrastructure (optional)</Label><InfoTooltip content="Optional. Where the app is hosted; stored for reporting only." testId="info-web-cloud-hosting" /></div>
                    <Input
                      id="web-cloud-hosting"
                      placeholder="e.g., Vercel, AWS, Azure, Google Cloud"
                      value={webCloudHosting}
                      onChange={(e) => setWebCloudHosting(e.target.value)}
                      disabled={scanStatus !== "idle"}
                      data-testid="input-web-cloud-hosting"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="web-auth-required"
                    checked={webAuthRequired}
                    onCheckedChange={(checked) => setWebAuthRequired(checked as boolean)}
                    disabled={scanStatus !== "idle"}
                    data-testid="checkbox-web-auth-required"
                  />
                  <Label htmlFor="web-auth-required" className="cursor-pointer">
                    Authentication Required
                  </Label>
                  <InfoTooltip content="Check this if your web app requires login credentials for the scanner to access protected pages." testId="info-web-auth-required" />
                </div>

                {webAuthRequired && (
                  <Card className="p-4 space-y-3 bg-blue-500/5 border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Credentials are encrypted and used only for security testing. Never use production credentials.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1"><Label htmlFor="web-auth-type">Authentication Type *</Label><InfoTooltip content="The method used to authenticate with your web application during scanning." testId="info-web-auth-type" /></div>
                      <Select value={webAuthType} onValueChange={(v) => setWebAuthType(v as any)} disabled={scanStatus !== "idle"}>
                        <SelectTrigger id="web-auth-type" data-testid="select-web-auth-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">HTTP Basic Auth</SelectItem>
                          <SelectItem value="form">Form-Based Login</SelectItem>
                          <SelectItem value="api-key">API Key / Bearer Token</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {webAuthType === "basic" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1"><Label htmlFor="web-auth-username">Username *</Label><InfoTooltip content="The test username for authentication during the scan. Never use production credentials." testId="info-web-auth-username" /></div>
                          <Input
                            id="web-auth-username"
                            placeholder="test-user"
                            value={webAuthUsername}
                            onChange={(e) => setWebAuthUsername(e.target.value)}
                            disabled={scanStatus !== "idle"}
                            data-testid="input-web-auth-username"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1"><Label htmlFor="web-auth-password">Password *</Label><InfoTooltip content="The test password for authentication during the scan. Never use production credentials." testId="info-web-auth-password" /></div>
                          <Input
                            id="web-auth-password"
                            type="password"
                            placeholder="••••••••"
                            value={webAuthPassword}
                            onChange={(e) => setWebAuthPassword(e.target.value)}
                            disabled={scanStatus !== "idle"}
                            data-testid="input-web-auth-password"
                          />
                        </div>
                      </div>
                    )}

                    {webAuthType === "form" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1"><Label htmlFor="web-auth-login-url">Login Page URL *</Label><InfoTooltip content="The URL of your app's login page for form-based authentication." testId="info-web-auth-login-url" /></div>
                          <Input
                            id="web-auth-login-url"
                            placeholder="https://myapp.com/login"
                            value={webAuthLoginUrl}
                            onChange={(e) => setWebAuthLoginUrl(e.target.value)}
                            disabled={scanStatus !== "idle"}
                            data-testid="input-web-auth-login-url"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1"><Label htmlFor="web-auth-form-username">Username *</Label><InfoTooltip content="The test username for authentication during the scan. Never use production credentials." testId="info-web-auth-form-username" /></div>
                            <Input
                              id="web-auth-form-username"
                              placeholder="test-user"
                              value={webAuthUsername}
                              onChange={(e) => setWebAuthUsername(e.target.value)}
                              disabled={scanStatus !== "idle"}
                              data-testid="input-web-auth-form-username"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-1"><Label htmlFor="web-auth-form-password">Password *</Label><InfoTooltip content="The test password for authentication during the scan. Never use production credentials." testId="info-web-auth-form-password" /></div>
                            <Input
                              id="web-auth-form-password"
                              type="password"
                              placeholder="••••••••"
                              value={webAuthPassword}
                              onChange={(e) => setWebAuthPassword(e.target.value)}
                              disabled={scanStatus !== "idle"}
                              data-testid="input-web-auth-form-password"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {webAuthType === "api-key" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1"><Label htmlFor="web-auth-token-header">Header Name *</Label><InfoTooltip content="The HTTP header name used for API key authentication, e.g. Authorization." testId="info-web-auth-token-header" /></div>
                          <Input
                            id="web-auth-token-header"
                            placeholder="Authorization"
                            value={webAuthTokenHeader}
                            onChange={(e) => setWebAuthTokenHeader(e.target.value)}
                            disabled={scanStatus !== "idle"}
                            data-testid="input-web-auth-token-header"
                          />
                          <p className="text-xs text-muted-foreground">e.g., "Authorization", "X-API-Key"</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1"><Label htmlFor="web-auth-api-key">API Key / Token *</Label><InfoTooltip content="The API key or bearer token for authenticating API requests during scanning." testId="info-web-auth-api-key" /></div>
                          <Input
                            id="web-auth-api-key"
                            type="password"
                            placeholder="Bearer sk-..."
                            value={webAuthApiKey}
                            onChange={(e) => setWebAuthApiKey(e.target.value)}
                            disabled={scanStatus !== "idle"}
                            data-testid="input-web-auth-api-key"
                          />
                          <p className="text-xs text-muted-foreground">Include "Bearer" prefix if required</p>
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label>Security modules (optional)</Label><InfoTooltip content="Defaults to all modules if none selected. Selections are stored on the scan record." testId="info-web-security-modules" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="module-sast"
                        checked={webSecurityModules.includes("SAST")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWebSecurityModules([...webSecurityModules, "SAST"]);
                          } else {
                            setWebSecurityModules(webSecurityModules.filter(m => m !== "SAST"));
                          }
                        }}
                        disabled={scanStatus !== "idle"}
                        data-testid="checkbox-module-sast"
                      />
                      <Label htmlFor="module-sast" className="cursor-pointer">SAST (Static Analysis)</Label>
                      <InfoTooltip content="Static Application Security Testing analyzes your source code for vulnerabilities without running it." testId="info-module-sast" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="module-dast"
                        checked={webSecurityModules.includes("DAST")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWebSecurityModules([...webSecurityModules, "DAST"]);
                          } else {
                            setWebSecurityModules(webSecurityModules.filter(m => m !== "DAST"));
                          }
                        }}
                        disabled={scanStatus !== "idle"}
                        data-testid="checkbox-module-dast"
                      />
                      <Label htmlFor="module-dast" className="cursor-pointer">DAST (Dynamic Analysis)</Label>
                      <InfoTooltip content="Dynamic Application Security Testing tests your running application for vulnerabilities." testId="info-module-dast" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="module-sca"
                        checked={webSecurityModules.includes("SCA")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWebSecurityModules([...webSecurityModules, "SCA"]);
                          } else {
                            setWebSecurityModules(webSecurityModules.filter(m => m !== "SCA"));
                          }
                        }}
                        disabled={scanStatus !== "idle"}
                        data-testid="checkbox-module-sca"
                      />
                      <Label htmlFor="module-sca" className="cursor-pointer">SCA (Dependency Scan)</Label>
                      <InfoTooltip content="Software Composition Analysis checks your third-party dependencies for known vulnerabilities." testId="info-module-sca" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="module-secrets"
                        checked={webSecurityModules.includes("Secrets")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWebSecurityModules([...webSecurityModules, "Secrets"]);
                          } else {
                            setWebSecurityModules(webSecurityModules.filter(m => m !== "Secrets"));
                          }
                        }}
                        disabled={scanStatus !== "idle"}
                        data-testid="checkbox-module-secrets"
                      />
                      <Label htmlFor="module-secrets" className="cursor-pointer">Secrets Detection</Label>
                      <InfoTooltip content="Scans your codebase for accidentally exposed passwords, API keys, and tokens." testId="info-module-secrets" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="container" className="space-y-4 mt-4">
              <Card className="p-4 bg-slate-500/10 border-slate-500/20">
                <div className="flex items-start gap-2">
                  <Database className="w-4 h-4 text-slate-600 dark:text-slate-400 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Analyze a public image manifest and layers (Docker Hub or anonymous OCI v2). This is not a full CVE image scan.
                  </p>
                </div>
              </Card>
              <div className="space-y-2">
                <Label htmlFor="workflow-container-image">Image repository *</Label>
                <Input
                  id="workflow-container-image"
                  placeholder="e.g. nginx or bitnami/redis"
                  value={containerImageName}
                  onChange={(e) => setContainerImageName(e.target.value)}
                  disabled={scanStatus !== "idle"}
                  data-testid="input-workflow-container-image"
                />
                <p className="text-xs text-muted-foreground">
                  Docker Hub: short names map to library/* (e.g. nginx → library/nginx).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="workflow-container-tag">Tag</Label>
                <Input
                  id="workflow-container-tag"
                  placeholder="latest"
                  value={containerImageTag}
                  onChange={(e) => setContainerImageTag(e.target.value)}
                  disabled={scanStatus !== "idle"}
                  data-testid="input-workflow-container-tag"
                />
              </div>
              <div className="space-y-2">
                <Label>Registry</Label>
                <Select value={containerRegistry} onValueChange={setContainerRegistry} disabled={scanStatus !== "idle"}>
                  <SelectTrigger data-testid="select-workflow-container-registry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docker-hub">Docker Hub</SelectItem>
                    <SelectItem value="custom">Custom (public OCI v2 URL)</SelectItem>
                    <SelectItem value="gcr">Google GCR (manifest pull not enabled)</SelectItem>
                    <SelectItem value="ecr">AWS ECR (manifest pull not enabled)</SelectItem>
                    <SelectItem value="acr">Azure ACR (manifest pull not enabled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {containerRegistry === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="workflow-container-registry-url">Registry base URL *</Label>
                  <Input
                    id="workflow-container-registry-url"
                    placeholder="https://registry.example.io"
                    value={containerRegistryUrl}
                    onChange={(e) => setContainerRegistryUrl(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-workflow-container-registry-url"
                  />
                </div>
              )}
            </TabsContent>

          </Tabs>

          {/* Scan Button */}
          {scanStatus === "idle" && (
            <div className="flex justify-end items-center gap-2">
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
                Cancel
              </Button>
              <InfoTooltip content="Begins the security scan using the settings above. This may take a few minutes." testId="info-start-scan" />
              <Button onClick={handleStartScan} data-testid="button-start-scan">
                Start Scan
              </Button>
            </div>
          )}

          {/* Scanning Progress */}
          {scanStatus === "scanning" && (
            <Card className="p-6 bg-blue-500/10 border-blue-500/20">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-700 dark:text-blue-400">Scanning in Progress</h3>
                  {appType === "container" ? (
                    <>
                      <p className="text-sm text-muted-foreground mt-1">
                        Fetching registry manifest and analyzing image layers...
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        <p>• Resolving image reference</p>
                        <p>• Pulling manifest metadata</p>
                        <p>• Evaluating layer policy</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mt-1">
                        Analyzing your code for security vulnerabilities...
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        <p>✓ Retrieved code from repository</p>
                        <p>• Running SAST analysis...</p>
                        <p>• Checking dependencies...</p>
                        <p>• Detecting secrets...</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Upload Progress */}
          {scanStatus === "uploading" && (
            <Card className="p-6 bg-green-500/10 border-green-500/20">
              <div className="flex items-start gap-3">
                <Upload className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-700 dark:text-green-400">Uploading to Destination</h3>
                  
                  {/* Destination Display */}
                  <div className="mt-2 p-3 bg-background/50 rounded-md border">
                    <p className="text-xs text-muted-foreground mb-1">Destination:</p>
                    <p className="text-sm font-medium break-all" data-testid="text-upload-destination">
                      {getUploadDestinationDisplay()}
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
          {scanStatus === "completed" && (
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
                    Set before upload so we record the correct App Store, Play Store, or web URL. Scan-only is fine if you are not deploying yet.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="post-mvp-deploy-kind">Target</Label>
                        <InfoTooltip content="Choose where the fixed build should be published." testId="info-post-mvp-deploy-kind" />
                      </div>
                      <Select value={mvpDeployKind} onValueChange={(v) => setMvpDeployKind(v as "none" | "ios" | "android" | "web")}>
                        <SelectTrigger id="post-mvp-deploy-kind" data-testid="select-post-mvp-deploy-kind">
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
                        <Label htmlFor="post-mvp-bundle-id">
                          {mvpDeployKind === "ios" ? "Bundle ID" : "Package Name"}
                        </Label>
                        <Input
                          id="post-mvp-bundle-id"
                          placeholder="e.g., com.company.app"
                          value={mvpBundleId}
                          onChange={(e) => setMvpBundleId(e.target.value)}
                          data-testid="input-post-mvp-bundle-id"
                        />
                      </div>
                    )}
                    {mvpDeployKind === "web" && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="post-mvp-web-deploy">Web deployment URL</Label>
                        <Input
                          id="post-mvp-web-deploy"
                          placeholder="https://app.example.com"
                          value={mvpWebDeployUrl}
                          onChange={(e) => setMvpWebDeployUrl(e.target.value)}
                          data-testid="input-post-mvp-web-deploy"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Upload options — not applicable for container scans */}
              <div className="flex flex-wrap justify-end items-center gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} data-testid="button-close">
                  {appType === "container" ? "Close" : "Cancel"}
                </Button>
                {appType === "container" && currentScanId && (
                  <Button
                    onClick={() => {
                      setLocation(`/scan-details/container/${currentScanId}`);
                      handleClose();
                    }}
                    data-testid="button-container-view-details"
                  >
                    Open scan details
                  </Button>
                )}
                {appType !== "container" && (
                  <>
                    <InfoTooltip content="Deploys your app as-is without applying any security fixes. Not recommended if critical issues were found." testId="info-upload-without-fixes" />
                    <Button variant="outline" onClick={() => setShowUploadWithoutFixesWarning(true)} data-testid="button-upload-without-fixes">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload without Fixes
                    </Button>
                    <InfoTooltip content="Applies AI-powered security fixes before deploying. Recommended for a more secure release." testId="info-upload-with-fixes" />
                    <Button onClick={() => setShowPostFixValidation(true)} data-testid="button-upload-with-fixes">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Upload with Fixes
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* Upload Warning Dialogs */}
      {currentScanId && appType !== "container" && (
        <>
          <UploadWithoutFixesWarningDialog
            open={showUploadWithoutFixesWarning}
            onOpenChange={setShowUploadWithoutFixesWarning}
            scanType={appType === "mvp" ? "mvp" : appType === "mobile" ? "mobile" : "web"}
            scanId={currentScanId}
            destination={getUploadDestinationShortLabel()}
            onProceedAnyway={() => {
              setShowUploadWithoutFixesWarning(false);
              handleUpload(false);
            }}
            onResolveIssues={() => {
              setShowUploadWithoutFixesWarning(false);
              setShowPostFixValidation(true);
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
              await handleUpload(true, runTests);
              // Close dialog after upload initiated
              setShowUploadWithFixesOptions(false);
            }}
          />
        </>
      )}
    </Dialog>
  );
}
