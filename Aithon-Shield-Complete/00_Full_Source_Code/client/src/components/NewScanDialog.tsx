import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Code, Smartphone, Globe, ChevronRight, ArrowLeft, Database } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  ContainerScan,
  InsertMvpCodeScan,
  InsertMobileAppScan,
  InsertWebAppScan,
  InsertContainerScan,
} from "@shared/schema";
import { addSessionScan } from "@/hooks/useScanNotifications";
import { useLocation } from "wouter";

type ScanType = "mvp" | "mobile" | "web" | "container" | null;

// Validation schemas for each scan type
const mvpRepoUrlProd = z
  .string()
  .min(1, "Repository URL is required")
  .refine(
    (url) => /demo/i.test(url) || /^https?:\/\//.test(url),
    'Repository URL must start with http:// or https://, or contain "demo" for trial use.',
  )
  .refine(
    (url) =>
      /demo/i.test(url) ||
      /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|.*\/.*\.git|.*\/.*\/.*)/.test(url),
    "Repository URL must be a valid Git repository URL (e.g., https://github.com/user/repo), or contain \"demo\" for trial use.",
  );

const mvpRepoUrlDev = z.string().min(1, "Repository URL is required");

function buildMvpScanSchema(strictProdScanUrls: boolean) {
  return z.object({
    projectName: z.string().min(1, "Project name is required"),
    sourcePlatform: z.string().min(1, "Source platform is required"),
    repoUrl: strictProdScanUrls ? mvpRepoUrlProd : mvpRepoUrlDev,
    branch: z.string().optional(),
    techStack: z.string().min(1, "Tech stack is required"),
    cloudProvider: z.string().optional(),
  });
}

function buildMobileScanSchema(strictProdScanUrls: boolean) {
  return z.object({
    appName: z.string().min(1, "App name is required"),
    platform: z.enum(["ios", "android"], {
      required_error: "Platform is required",
    }),
    appId: z.string().min(1, "App Store URL or Bundle ID is required"),
    version: z.string().min(1, "Version is required"),
    apiEndpoint: z
      .string()
      .optional()
      .refine(
        (url) => {
          if (!url) return true;
          if (!strictProdScanUrls) return true;
          return /^https?:\/\//.test(url);
        },
        "API endpoint must be a valid URL starting with http:// or https://",
      ),
    cloudProvider: z.string().optional(),
    notes: z.string().optional(),
  });
}

function buildWebScanSchema(strictProdScanUrls: boolean) {
  return z.object({
    appName: z.string().min(1, "Application name is required"),
    url: strictProdScanUrls
      ? z.string().min(1, "Application URL is required").url("Must be a valid URL")
      : z.string().min(1, "Application URL is required"),
    scanDepth: z.string().min(1, "Scan depth is required"),
    cloudProvider: z.string().optional(),
    authRequired: z.enum(["yes", "no"], {
      required_error: "Please specify if authentication is required",
    }),
  });
}

type MvpScanFormData = z.infer<ReturnType<typeof buildMvpScanSchema>>;
type MobileScanFormData = z.infer<ReturnType<typeof buildMobileScanSchema>>;
type WebScanFormData = z.infer<ReturnType<typeof buildWebScanSchema>>;

interface NewScanDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preselectedType?: ScanType;
}

export function NewScanDialog({ open: controlledOpen, onOpenChange, preselectedType }: NewScanDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [scanType, setScanType] = useState<ScanType>(null);
  const [preselectionConsumed, setPreselectionConsumed] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const { data: appConfig } = useQuery<{ demoMode: boolean }>({
    queryKey: ["/api/app-config"],
  });
  const strictProdScanUrls = import.meta.env.PROD && appConfig?.demoMode !== true;
  const mvpScanSchema = useMemo(() => buildMvpScanSchema(strictProdScanUrls), [strictProdScanUrls]);
  const mobileScanSchema = useMemo(() => buildMobileScanSchema(strictProdScanUrls), [strictProdScanUrls]);
  const webScanSchema = useMemo(() => buildWebScanSchema(strictProdScanUrls), [strictProdScanUrls]);

  const mvpResolver = useMemo(() => zodResolver(mvpScanSchema), [mvpScanSchema]);
  const mobileResolver = useMemo(() => zodResolver(mobileScanSchema), [mobileScanSchema]);
  const webResolver = useMemo(() => zodResolver(webScanSchema), [webScanSchema]);

  // Mutations for creating scans
  const mvpMutation = useMutation({
    mutationFn: async (data: InsertMvpCodeScan) => {
      const res = await apiRequest("POST", "/api/mvp-scans", data);
      return (await res.json()) as InsertMvpCodeScan & { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mvp-scans"] });
    },
  });

  const mobileMutation = useMutation({
    mutationFn: async (data: InsertMobileAppScan) => {
      const res = await apiRequest("POST", "/api/mobile-scans", data);
      return (await res.json()) as InsertMobileAppScan & { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans"] });
    },
  });

  const webMutation = useMutation({
    mutationFn: async (data: InsertWebAppScan) => {
      const res = await apiRequest("POST", "/api/web-scans", data);
      return (await res.json()) as InsertWebAppScan & { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-scans"] });
    },
  });

  const containerMutation = useMutation({
    mutationFn: async (data: Omit<InsertContainerScan, "userId">) => {
      const res = await apiRequest("POST", "/api/container-scans", data);
      return (await res.json()) as ContainerScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/container-scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
    },
  });

  const [containerImageName, setContainerImageName] = useState("");
  const [containerImageTag, setContainerImageTag] = useState("latest");
  const [containerRegistry, setContainerRegistry] = useState("docker-hub");
  const [containerRegistryUrl, setContainerRegistryUrl] = useState("");

  // Form instances for each scan type
  const mvpForm = useForm<MvpScanFormData>({
    resolver: mvpResolver,
    defaultValues: {
      projectName: "",
      sourcePlatform: "github",
      repoUrl: "",
      branch: "main",
      techStack: "auto",
      cloudProvider: "none",
    },
  });

  const mobileForm = useForm<MobileScanFormData>({
    resolver: mobileResolver,
    defaultValues: {
      appName: "",
      platform: "ios",
      appId: "",
      version: "1.0.0",
      apiEndpoint: "",
      cloudProvider: "none",
      notes: "",
    },
  });

  const webForm = useForm<WebScanFormData>({
    resolver: webResolver,
    defaultValues: {
      appName: "",
      url: "",
      scanDepth: "comprehensive",
      cloudProvider: "none",
      authRequired: "no",
    },
  });

  useEffect(() => {
    if (!open) {
      setPreselectionConsumed(false);
    } else if (preselectedType && !preselectionConsumed) {
      setScanType(preselectedType);
      setStep("configure");
      setPreselectionConsumed(true);
    } else if (!preselectedType && preselectionConsumed) {
      setStep("select");
      setScanType(null);
      setPreselectionConsumed(false);
    }
  }, [preselectedType, open, preselectionConsumed]);

  const handleScanTypeSelect = (type: ScanType) => {
    setScanType(type);
    setStep("configure");
  };

  const handleBack = () => {
    setStep("select");
    setScanType(null);
  };

  const onMvpSubmit = async (data: MvpScanFormData) => {
    try {
      const scanData = {
        projectName: data.projectName,
        platform: data.sourcePlatform,
        repositoryUrl: data.repoUrl,
        branch: data.branch || "main",
        scanStatus: "pending",
        uploadStatus: "none",
        uploadProgress: "idle",
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };

      const result: any = await mvpMutation.mutateAsync(scanData as any);
      
      // Track scan in session for notifications
      if (result && result.id) {
        addSessionScan(result.id, "mvp", data.projectName);
        
        // Trigger the scan to start
        await apiRequest("POST", `/api/mvp-scans/${result.id}/scan`);
      }

      toast({
        title: "MVP Scan Started",
        description: `Security scan initiated for ${data.projectName}`,
        action: (
          <ToastAction
            altText="View scan progress"
            onClick={() => setLocation(`/scan-details/mvp/${result.id}`)}
          >
            View Scan
          </ToastAction>
        ),
      });
      setOpen(false);
      setStep("select");
      setScanType(null);
      mvpForm.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start scan",
        variant: "destructive",
      });
    }
  };

  const onMobileSubmit = async (data: MobileScanFormData) => {
    try {
      const scanData = {
        platform: data.platform,
        appId: data.appId,
        appName: data.appName,
        version: data.version,
        scanStatus: "pending",
        uploadStatus: "none",
        uploadProgress: "idle",
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };

      const result: any = await mobileMutation.mutateAsync(scanData as any);
      
      // Track scan in session for notifications
      if (result && result.id) {
        addSessionScan(result.id, "mobile", data.appName);
        
        // Trigger the scan to start
        await apiRequest("POST", `/api/mobile-scans/${result.id}/scan`);
      }

      toast({
        title: "Mobile Scan Started",
        description: `Security scan initiated for ${data.appName}`,
        action: (
          <ToastAction
            altText="View scan progress"
            onClick={() => setLocation(`/scan-details/mobile/${result.id}`)}
          >
            View Scan
          </ToastAction>
        ),
      });
      setOpen(false);
      setStep("select");
      setScanType(null);
      mobileForm.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start scan",
        variant: "destructive",
      });
    }
  };

  const onWebSubmit = async (data: WebScanFormData) => {
    try {
      const scanData = {
        appUrl: data.url,
        appName: data.appName,
        hostingPlatform: "other",
        scanDepth: data.scanDepth,
        scanStatus: "pending",
        uploadStatus: "none",
        uploadProgress: "idle",
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };

      const result: any = await webMutation.mutateAsync(scanData as any);
      
      // Track scan in session for notifications
      if (result && result.id) {
        addSessionScan(result.id, "web", data.appName);
        
        // Trigger the scan to start
        await apiRequest("POST", `/api/web-scans/${result.id}/scan`);
      }

      toast({
        title: "Web Scan Started",
        description: `Security scan initiated for ${data.appName}`,
        action: (
          <ToastAction
            altText="View scan progress"
            onClick={() => setLocation(`/scan-details/web/${result.id}`)}
          >
            View Scan
          </ToastAction>
        ),
      });
      setOpen(false);
      setStep("select");
      setScanType(null);
      webForm.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start scan",
        variant: "destructive",
      });
    }
  };

  const submitContainerScan = async () => {
    if (!containerImageName.trim()) {
      toast({
        title: "Image name required",
        description: "Enter a repository name (e.g. nginx or bitnami/redis).",
        variant: "destructive",
      });
      return;
    }
    if (containerRegistry === "custom" && !containerRegistryUrl.trim()) {
      toast({
        title: "Registry URL required",
        description: "For custom registry, enter the base URL (OCI v2, e.g. https://registry.example.io).",
        variant: "destructive",
      });
      return;
    }
    try {
      const payload: Omit<InsertContainerScan, "userId"> = {
        scanType: "docker-image",
        imageName: containerImageName.trim(),
        imageTag: (containerImageTag.trim() || "latest") as string,
        registry: containerRegistry,
        registryUrl:
          containerRegistry === "custom" ? containerRegistryUrl.trim() || null : null,
        scanStatus: "pending",
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };
      const result = await containerMutation.mutateAsync(payload);
      if (result?.id) {
        addSessionScan(result.id, "container", `${payload.imageName}:${payload.imageTag}`);
      }
      toast({
        title: "Container layer scan started",
        description: `Analyzing manifest for ${payload.imageName}:${payload.imageTag}`,
        action: (
          <ToastAction
            altText="View scan"
            onClick={() => setLocation(`/scan-details/container/${result.id}`)}
          >
            View scan
          </ToastAction>
        ),
      });
      setOpen(false);
      setStep("select");
      setScanType(null);
      setContainerImageName("");
      setContainerImageTag("latest");
      setContainerRegistry("docker-hub");
      setContainerRegistryUrl("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start container scan";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setStep("select");
      setScanType(null);
      mvpForm.reset();
      mobileForm.reset();
      webForm.reset();
      setContainerImageName("");
      setContainerImageTag("latest");
      setContainerRegistry("docker-hub");
      setContainerRegistryUrl("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-scan">
          <Plus className="w-4 h-4 mr-2" />
          New Scan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Start Security Scan</DialogTitle>
              <DialogDescription>
                Choose your scan type based on your application stage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto">
              <Card
                className="p-6 cursor-pointer hover-elevate active-elevate-2 shadow-sm"
                onClick={() => handleScanTypeSelect("mvp")}
                data-testid="card-scan-mvp"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Code className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">MVP Code Scan</h3>
                      <p className="text-sm text-muted-foreground">
                        Scan your MVP codebase before launch. Perfect for code from Replit, Bolt, v0, Lovable, or any development platform.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Includes:</span> SAST, SCA, IaC (Terraform, Docker, K8s YAML), secrets detection
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>

              <Card
                className="p-6 cursor-pointer hover-elevate active-elevate-2 shadow-sm"
                onClick={() => handleScanTypeSelect("mobile")}
                data-testid="card-scan-mobile"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Mobile App Scan</h3>
                      <p className="text-sm text-muted-foreground">
                        Scan your live mobile app from Apple App Store or Google Play Store for security vulnerabilities.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Includes:</span> Binary analysis, API security, data storage checks, cloud/infra scan
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>

              <Card
                className="p-6 cursor-pointer hover-elevate active-elevate-2 shadow-sm"
                onClick={() => handleScanTypeSelect("web")}
                data-testid="card-scan-web"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Web App Scan</h3>
                      <p className="text-sm text-muted-foreground">
                        Comprehensive security scan for your live web application against all known cyber attacks.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Includes:</span> DAST, OWASP Top 10, SSL/TLS validation, WAF config, cloud/infra scan
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>

              <Card
                className="p-6 cursor-pointer hover-elevate active-elevate-2 shadow-sm"
                onClick={() => handleScanTypeSelect("container")}
                data-testid="card-scan-container"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Container image (layers)</h3>
                      <p className="text-sm text-muted-foreground">
                        Inspect registry manifest metadata: layer count, sizes, and tag hygiene (Docker Hub or public custom OCI v2).
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Note:</span> Registry metadata only — use CI image scanners for CVE depth.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>

            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {scanType === "mvp" && "Configure MVP Code Scan"}
                {scanType === "mobile" && "Configure Mobile App Scan"}
                {scanType === "web" && "Configure Web App Scan"}
                {scanType === "container" && "Configure container image scan"}
              </DialogTitle>
              <DialogDescription>
                {scanType === "mvp" && "Provide your code repository details for pre-launch security analysis"}
                {scanType === "mobile" && "Provide your mobile app details for security testing"}
                {scanType === "web" && "Provide your web application URL for comprehensive vulnerability assessment"}
                {scanType === "container" &&
                  "Uses anonymous registry APIs. Official images use short names (e.g. nginx → library/nginx)."}
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto flex-1">
              {scanType === "mvp" && (
                <Form {...mvpForm}>
                  <form onSubmit={mvpForm.handleSubmit(onMvpSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={mvpForm.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="My Awesome MVP"
                              data-testid="input-project-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mvpForm.control}
                      name="sourcePlatform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source Platform</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-source-platform">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="github">GitHub</SelectItem>
                              <SelectItem value="gitlab">GitLab</SelectItem>
                              <SelectItem value="replit">Replit</SelectItem>
                              <SelectItem value="bolt">Bolt.new</SelectItem>
                              <SelectItem value="v0">v0.dev</SelectItem>
                              <SelectItem value="lovable">Lovable</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mvpForm.control}
                      name="repoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repository URL or Code Location</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://github.com/username/repo"
                              data-testid="input-repo-url"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mvpForm.control}
                      name="branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="main"
                              data-testid="input-branch"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mvpForm.control}
                      name="techStack"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tech Stack</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tech-stack">
                                <SelectValue placeholder="Select tech stack" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="auto">Auto-detect</SelectItem>
                              <SelectItem value="javascript">JavaScript/Node.js</SelectItem>
                              <SelectItem value="python">Python</SelectItem>
                              <SelectItem value="java">Java</SelectItem>
                              <SelectItem value="dotnet">.NET/C#</SelectItem>
                              <SelectItem value="php">PHP</SelectItem>
                              <SelectItem value="ruby">Ruby</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mvpForm.control}
                      name="cloudProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cloud/Infrastructure Provider (optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-cloud-provider">
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None / Not applicable</SelectItem>
                              <SelectItem value="aws">AWS</SelectItem>
                              <SelectItem value="azure">Microsoft Azure</SelectItem>
                              <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                              <SelectItem value="vercel">Vercel</SelectItem>
                              <SelectItem value="netlify">Netlify</SelectItem>
                              <SelectItem value="replit">Replit</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            We'll scan for cloud misconfigurations and infrastructure vulnerabilities
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}

              {scanType === "mobile" && (
                <Form {...mobileForm}>
                  <form onSubmit={mobileForm.handleSubmit(onMobileSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={mobileForm.control}
                      name="appName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>App Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="My Mobile App"
                              data-testid="input-app-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mobileForm.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              data-testid="radio-platform"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ios" id="ios" />
                                <Label htmlFor="ios" className="font-normal">Apple App Store (iOS)</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="android" id="android" />
                                <Label htmlFor="android" className="font-normal">Google Play Store (Android)</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mobileForm.control}
                      name="appId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>App Store URL or Bundle ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://apps.apple.com/... or com.company.app"
                              data-testid="input-app-id"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mobileForm.control}
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Version</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="1.0.0"
                              data-testid="input-version"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mobileForm.control}
                      name="apiEndpoint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Backend API Endpoint (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://api.yourapp.com"
                              data-testid="input-api-endpoint"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mobileForm.control}
                      name="cloudProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cloud/Backend Provider (optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-mobile-cloud-provider">
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None / Not applicable</SelectItem>
                              <SelectItem value="aws">AWS (API Gateway, Lambda, etc.)</SelectItem>
                              <SelectItem value="firebase">Firebase</SelectItem>
                              <SelectItem value="azure">Microsoft Azure</SelectItem>
                              <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                              <SelectItem value="supabase">Supabase</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            We'll scan backend infrastructure for security misconfigurations
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mobileForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any specific areas of concern or authentication details..."
                              className="resize-none"
                              rows={3}
                              data-testid="textarea-notes"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}

              {scanType === "web" && (
                <Form {...webForm}>
                  <form onSubmit={webForm.handleSubmit(onWebSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={webForm.control}
                      name="appName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Application Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="My Web Application"
                              data-testid="input-web-app-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={webForm.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Live Application URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://app.example.com"
                              data-testid="input-web-url"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={webForm.control}
                      name="scanDepth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scan Depth</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-scan-depth">
                                <SelectValue placeholder="Select scan depth" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="quick">Quick Scan (15-30 min)</SelectItem>
                              <SelectItem value="standard">Standard Scan (1-2 hours)</SelectItem>
                              <SelectItem value="comprehensive">Comprehensive Scan (4-8 hours)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={webForm.control}
                      name="cloudProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cloud/Hosting Provider (optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-web-cloud-provider">
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None / Not applicable</SelectItem>
                              <SelectItem value="aws">AWS</SelectItem>
                              <SelectItem value="azure">Microsoft Azure</SelectItem>
                              <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                              <SelectItem value="vercel">Vercel</SelectItem>
                              <SelectItem value="netlify">Netlify</SelectItem>
                              <SelectItem value="cloudflare">Cloudflare</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Infrastructure and cloud configuration will be analyzed for security issues
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={webForm.control}
                      name="authRequired"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authentication Required?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              data-testid="radio-auth"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="no" id="auth-no" />
                                <Label htmlFor="auth-no" className="font-normal">No authentication needed</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yes" id="auth-yes" />
                                <Label htmlFor="auth-yes" className="font-normal">Yes, provide test credentials</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="security-modules">Security Modules (All Enabled)</Label>
                      <Textarea
                        id="security-modules"
                        defaultValue="✓ DAST • ✓ OWASP Top 10 • ✓ SQL Injection/XSS/CSRF • ✓ API Security • ✓ SSL/TLS Configuration • ✓ WAF Validation • ✓ Cloud/Infrastructure Scan • ✓ Authentication Bypass • ✓ Session Management • ✓ Business Logic Flaws"
                        className="resize-none"
                        rows={3}
                        data-testid="textarea-attack-types"
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">Complete enterprise security coverage - all modules run automatically</p>
                    </div>
                  </form>
                </Form>
              )}

              {scanType === "container" && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="container-image-name">Image repository</Label>
                    <Input
                      id="container-image-name"
                      placeholder="e.g. nginx or bitnami/redis"
                      value={containerImageName}
                      onChange={(e) => setContainerImageName(e.target.value)}
                      data-testid="input-container-image-name"
                    />
                    <p className="text-xs text-muted-foreground">
                      Docker Hub: short names map to library/* (e.g. nginx → library/nginx).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="container-image-tag">Tag</Label>
                    <Input
                      id="container-image-tag"
                      placeholder="latest"
                      value={containerImageTag}
                      onChange={(e) => setContainerImageTag(e.target.value)}
                      data-testid="input-container-image-tag"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Registry</Label>
                    <Select value={containerRegistry} onValueChange={setContainerRegistry}>
                      <SelectTrigger data-testid="select-container-registry">
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
                      <Label htmlFor="container-registry-url">Registry base URL</Label>
                      <Input
                        id="container-registry-url"
                        placeholder="https://registry.example.io"
                        value={containerRegistryUrl}
                        onChange={(e) => setContainerRegistryUrl(e.target.value)}
                        data-testid="input-container-registry-url"
                      />
                    </div>
                  )}
                </div>
              )}

            </div>

            <DialogFooter className="gap-2 flex-row justify-between">
              <Button variant="outline" onClick={handleBack} data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (scanType === "mvp") mvpForm.handleSubmit(onMvpSubmit)();
                  if (scanType === "mobile") mobileForm.handleSubmit(onMobileSubmit)();
                  if (scanType === "web") webForm.handleSubmit(onWebSubmit)();
                  if (scanType === "container") void submitContainerScan();
                }}
                data-testid="button-start-scan"
                disabled={scanType === "container" && containerMutation.isPending}
              >
                {scanType === "container"
                  ? containerMutation.isPending
                    ? "Starting…"
                    : "Start container scan"
                  : `Start ${scanType === "mvp" ? "Code" : scanType === "mobile" ? "Mobile" : "Web"} Scan`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
