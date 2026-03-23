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
import { Code, Smartphone, Globe, Upload, CheckCircle, GitBranch, Loader2, ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UploadWithoutFixesWarningDialog } from "@/components/UploadWithoutFixesWarningDialog";
import { UploadWithFixesOptionsDialog } from "@/components/UploadWithFixesOptionsDialog";
import { PostFixValidationDialog } from "@/components/PostFixValidationDialog";
import type { ScanType } from "@/hooks/use-scan-findings";
import type { Finding } from "@shared/schema";

interface NewAppWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAppType?: "mvp" | "mobile" | "web";
  hideTabs?: boolean;
}

export function NewAppWorkflowDialog({ open, onOpenChange, defaultAppType, hideTabs = false }: NewAppWorkflowDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [appType, setAppType] = useState<"mvp" | "mobile" | "web">(defaultAppType || "mvp");
  
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
  
  // MVP deployment fields (App Store destination)
  const [mvpTargetStore, setMvpTargetStore] = useState<"ios" | "android">("ios");
  const [mvpBundleId, setMvpBundleId] = useState("");
  const [mvpTechStack, setMvpTechStack] = useState("");
  const [mvpCloudInfra, setMvpCloudInfra] = useState("");
  
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
                
                setScanStatus("completed");
                toast({
                  title: "Scan Complete",
                  description: `Found ${scanData.findingsCount || 0} security issues. Check Findings page for details.`,
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
              // Timeout after 60 seconds
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
        }, 1000); // Poll every second
        
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to start scan",
          variant: "destructive",
        });
        setScanStatus("idle");
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create scan",
        variant: "destructive",
      });
      setScanStatus("idle");
    },
  });

  const handleStartScan = () => {
    // Validate common fields
    if (!projectName && !mobileAppName && !webAppName) {
      toast({
        title: "Missing Information",
        description: "Please provide app/project name",
        variant: "destructive",
      });
      return;
    }

    if (!repositoryUrl) {
      toast({
        title: "Missing Information",
        description: "Please provide repository URL",
        variant: "destructive",
      });
      return;
    }

    // Validate app-specific fields
    if (appType === "mvp") {
      if (!mvpBundleId) {
        toast({
          title: "Missing Information",
          description: "Please provide the target App Store bundle/package ID",
          variant: "destructive",
        });
        return;
      }
      if (!mvpTechStack) {
        toast({
          title: "Missing Information",
          description: "Please provide the tech stack",
          variant: "destructive",
        });
        return;
      }
    }
    if (appType === "mobile") {
      if (!mobileAppId) {
        toast({
          title: "Missing Information",
          description: "Please provide bundle/package ID",
          variant: "destructive",
        });
        return;
      }
      if (!mobileVersion) {
        toast({
          title: "Missing Information",
          description: "Please provide version number",
          variant: "destructive",
        });
        return;
      }
    }
    if (appType === "web") {
      if (!webDomainUrl) {
        toast({
          title: "Missing Information",
          description: "Please provide live domain URL",
          variant: "destructive",
        });
        return;
      }
      if (webSecurityModules.length === 0) {
        toast({
          title: "Missing Information",
          description: "Please select at least one security module",
          variant: "destructive",
        });
        return;
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

    setScanStatus("scanning");
    
    // Prepare scan data
    const scanData = appType === "mvp" 
      ? { 
          projectName, 
          repositoryUrl, 
          platform: sourceRepo,
          branch,
          targetAppStore: mvpTargetStore,
          appStoreBundleId: mvpBundleId
        }
      : appType === "mobile"
      ? { 
          appName: mobileAppName, 
          platform: mobilePlatform, 
          appId: mobileAppId,
          version: mobileVersion
        }
      : { 
          appName: webAppName, 
          appUrl: webDomainUrl,
          hostingPlatform: webCloudHosting || "other",
          scanDepth: webScanDepth === "shallow" ? "quick" : webScanDepth === "moderate" ? "standard" : "comprehensive",
          authRequired: webAuthRequired,
          authType: webAuthRequired ? webAuthType : null,
          authUsername: webAuthRequired ? webAuthUsername : null,
          authPassword: webAuthRequired ? webAuthPassword : null,
          authLoginUrl: webAuthRequired && webAuthType === "form" ? webAuthLoginUrl : null,
          authApiKey: webAuthRequired && webAuthType === "api-key" ? webAuthApiKey : null,
          authTokenHeader: webAuthRequired && webAuthType === "api-key" ? webAuthTokenHeader : null
        };

    // Capture scan type to prevent race conditions
    const currentScanType = appType;
    
    // Simulate scan delay
    setTimeout(() => {
      createScanMutation.mutate({ scanType: currentScanType, scanData });
    }, 2000);
  };

  const handleUpload = async (withFixes: boolean, runTests: boolean = false) => {
    const destination = appType === "mvp" 
      ? `${mvpTargetStore === "ios" ? "iOS" : "Android"} App Store (${mvpBundleId})`
      : appType === "mobile"
      ? `${mobilePlatform === "ios" ? "iOS" : "Android"} App Store (${mobileAppId})`
      : webDomainUrl;
    
    // Update scan record with fix preference BEFORE upload using tracked scan ID
    if (currentScanId) {
      try {
        await apiRequest("PATCH", `/api/${appType}-scans/${currentScanId}`, {
          fixesApplied: withFixes,
          uploadPreference: withFixes ? 'fix-and-upload' : 'upload-without-fixes',
          autoUploadDestination: destination
        });
        
        // Trigger backend upload process (with or without tests)
        const endpoint = runTests 
          ? `/api/${appType}-scans/${currentScanId}/upload-and-test`
          : `/api/${appType}-scans/${currentScanId}/upload`;
        
        await apiRequest("POST", endpoint, {
          withFixes
        });
        
        setScanStatus("uploading");
        
        // CRITICAL: Invalidate scan queries immediately so the list updates
        queryClient.invalidateQueries({ queryKey: [`/api/${appType}-scans`] });
        queryClient.invalidateQueries({ queryKey: ['/api/findings'] });
        
        // Show success toast with short duration (5 seconds) so it doesn't persist
        toast({
          title: runTests ? "Upload & Testing Initiated" : "Upload Initiated",
          description: runTests
            ? `Your ${withFixes ? "scanned and fixed" : "scanned"} app is being uploaded to ${destination} and comprehensive tests will run automatically.`
            : `Your ${withFixes ? "scanned and fixed" : "scanned"} app is being uploaded to ${destination}. Check the scan details for progress.`,
          duration: 5000, // Dismiss after 5 seconds
        });
        
        // Close dialog immediately after upload initiated - no delay
        onOpenChange(false);
        resetForm();
        
      } catch (error) {
        console.error("Error uploading scan:", error);
        toast({
          title: "Upload Failed",
          description: "Failed to initiate upload. Please try again.",
          variant: "destructive",
        });
      }
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
    setMvpBundleId("");
    setMvpTechStack("");
    setMvpCloudInfra("");
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
          <Tabs value={appType} onValueChange={(v) => setAppType(v as any)}>
            {!hideTabs && (
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mvp" data-testid="tab-mvp" disabled={scanStatus !== "idle"}>
                  <Code className="w-4 h-4 mr-2" />
                  MVP Code
                </TabsTrigger>
                <TabsTrigger value="mobile" data-testid="tab-mobile" disabled={scanStatus !== "idle"}>
                  <Smartphone className="w-4 h-4 mr-2" />
                  Mobile App
                </TabsTrigger>
                <TabsTrigger value="web" data-testid="tab-web" disabled={scanStatus !== "idle"}>
                  <Globe className="w-4 h-4 mr-2" />
                  Web App
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
                  <div className="flex items-center gap-1"><Label htmlFor="project-name">Project Name *</Label><InfoTooltip content="A descriptive name for your project to help identify it across scans and reports." testId="info-project-name" /></div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="mvp-tech-stack">Tech Stack *</Label><InfoTooltip content="The primary technologies and frameworks used in your project, e.g. React, Node.js, PostgreSQL." testId="info-mvp-tech-stack" /></div>
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
                  <div className="flex items-center gap-1"><Label htmlFor="mvp-cloud-infra">Cloud/Infrastructure (Optional)</Label><InfoTooltip content="Optional. The cloud platform or infrastructure your app uses for deployment." testId="info-mvp-cloud-infra" /></div>
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

              <div className="border-t pt-4">
                <div className="flex items-center gap-1 mb-3"><h3 className="font-semibold">Deployment Destination</h3><InfoTooltip content="Where your scanned and fixed code will be deployed after the scan." testId="info-mvp-deployment-destination" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="target-store">Target App Store *</Label><InfoTooltip content="The app store where your MVP will be published after scanning." testId="info-target-store" /></div>
                    <Select value={mvpTargetStore} onValueChange={(v) => setMvpTargetStore(v as any)} disabled={scanStatus !== "idle"}>
                      <SelectTrigger id="target-store" data-testid="select-target-store">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ios">iOS App Store</SelectItem>
                        <SelectItem value="android">Android Play Store</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-1"><Label htmlFor="mvp-bundle-id">
                      {mvpTargetStore === "ios" ? "Bundle ID *" : "Package Name *"}
                    </Label><InfoTooltip content="The unique identifier for your app in the app store, e.g. com.company.app." testId="info-mvp-bundle-id" /></div>
                    <Input
                      id="mvp-bundle-id"
                      placeholder="e.g., com.company.app"
                      value={mvpBundleId}
                      onChange={(e) => setMvpBundleId(e.target.value)}
                      disabled={scanStatus !== "idle"}
                      data-testid="input-mvp-bundle-id"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-4 mt-4">
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scan app code from repository and deploy to App Store
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-app-name">App Name *</Label><InfoTooltip content="The display name of your mobile application." testId="info-mobile-app-name" /></div>
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
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-source-repo">Code Source *</Label><InfoTooltip content="The repository platform where your mobile app source code is hosted." testId="info-mobile-source-repo" /></div>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-repo-url">Repository URL *</Label><InfoTooltip content="The full URL to your mobile app code repository." testId="info-mobile-repo-url" /></div>
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
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-branch">Branch</Label><InfoTooltip content="The specific branch to scan. Defaults to 'main' if left empty." testId="info-mobile-branch" /></div>
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
                
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="mobile-backend-api">Backend API Endpoint (Optional)</Label><InfoTooltip content="Optional. The URL of your app's backend API for additional security testing." testId="info-mobile-backend-api" /></div>
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
                <div className="flex items-center gap-1"><Label htmlFor="mobile-cloud-provider">Cloud/Backend Provider (Optional)</Label><InfoTooltip content="Optional. The cloud provider hosting your app's backend services." testId="info-mobile-cloud-provider" /></div>
                <Input
                  id="mobile-cloud-provider"
                  placeholder="e.g., AWS, Firebase, Azure"
                  value={mobileCloudProvider}
                  onChange={(e) => setMobileCloudProvider(e.target.value)}
                  disabled={scanStatus !== "idle"}
                  data-testid="input-mobile-cloud-provider"
                />
              </div>

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
                  <GitBranch className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scan code from repository and deploy to your live domain
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="web-app-name">App Name *</Label><InfoTooltip content="The display name of your web application." testId="info-web-app-name" /></div>
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
                  <div className="flex items-center gap-1"><Label htmlFor="web-source-repo">Code Source *</Label><InfoTooltip content="The repository platform where your web app source code is hosted." testId="info-web-source-repo" /></div>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="web-repo-url">Repository URL *</Label><InfoTooltip content="The full URL to your web app code repository." testId="info-web-repo-url" /></div>
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
                  <div className="flex items-center gap-1"><Label htmlFor="web-branch">Branch</Label><InfoTooltip content="The specific branch to scan. Defaults to 'main' if left empty." testId="info-web-branch" /></div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
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
                
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="web-cloud-hosting">Cloud Hosting Provider (Optional)</Label><InfoTooltip content="Optional. The hosting platform where your web app is deployed." testId="info-web-cloud-hosting" /></div>
                  <Input
                    id="web-cloud-hosting"
                    placeholder="e.g., Vercel, AWS, Azure, Google Cloud"
                    value={webCloudHosting}
                    onChange={(e) => setWebCloudHosting(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-web-cloud-hosting"
                  />
                </div>
              </div>

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
                  <div className="flex items-center gap-1"><Label>Security Modules *</Label><InfoTooltip content="Select which security analysis modules to run during the scan." testId="info-web-security-modules" /></div>
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

              <div className="border-t pt-4">
                <div className="flex items-center gap-1 mb-3"><h3 className="font-semibold">Deployment Destination</h3><InfoTooltip content="Where your scanned web app will be deployed." testId="info-web-deployment-destination" /></div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1"><Label htmlFor="web-domain-url">Live Domain URL *</Label><InfoTooltip content="The live URL where your web application is hosted or will be deployed." testId="info-web-domain-url" /></div>
                  <Input
                    id="web-domain-url"
                    placeholder="e.g., https://myapp.com"
                    value={webDomainUrl}
                    onChange={(e) => setWebDomainUrl(e.target.value)}
                    disabled={scanStatus !== "idle"}
                    data-testid="input-web-domain-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    The live URL where your web app will be deployed
                  </p>
                </div>
              </div>
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
                  <p className="text-sm text-muted-foreground mt-1">
                    Analyzing your code for security vulnerabilities...
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>✓ Retrieved code from repository</p>
                    <p>• Running SAST analysis...</p>
                    <p>• Checking dependencies...</p>
                    <p>• Detecting secrets...</p>
                  </div>
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
                      {appType === "mvp" 
                        ? `${mvpTargetStore === "ios" ? "iOS" : "Android"} App Store (${mvpBundleId})`
                        : appType === "mobile"
                        ? `${mobilePlatform === "ios" ? "iOS" : "Android"} App Store (${mobileAppId})`
                        : webDomainUrl}
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

              {/* Upload Options */}
              <div className="flex justify-end items-center gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} data-testid="button-close">
                  Cancel
                </Button>
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
            destination={
              appType === "mvp" 
                ? `${mvpTargetStore === "ios" ? "iOS App Store" : "Google Play Store"}`
                : appType === "mobile"
                ? `${mobilePlatform === "ios" ? "iOS App Store" : "Google Play Store"}`
                : "production server"
            }
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
            destination={
              appType === "mvp" 
                ? `${mvpTargetStore === "ios" ? "iOS App Store" : "Google Play Store"}`
                : appType === "mobile"
                ? `${mobilePlatform === "ios" ? "iOS App Store" : "Google Play Store"}`
                : "production server"
            }
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
