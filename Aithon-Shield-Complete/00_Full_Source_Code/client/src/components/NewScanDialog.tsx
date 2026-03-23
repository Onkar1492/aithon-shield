import { useState, useEffect } from "react";
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
import { Plus, Code, Smartphone, Globe, ChevronRight, ArrowLeft } from "lucide-react";
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
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InsertMvpCodeScan, InsertMobileAppScan, InsertWebAppScan } from "@shared/schema";
import { addSessionScan } from "@/hooks/useScanNotifications";
import { useLocation } from "wouter";

type ScanType = "mvp" | "mobile" | "web" | null;

// Validation schemas for each scan type
const mvpScanSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  sourcePlatform: z.string().min(1, "Source platform is required"),
  repoUrl: z.string().min(1, "Repository URL is required")
    .refine((url) => {
      // Must start with http:// or https://
      return /^https?:\/\//.test(url);
    }, "Repository URL must be a valid URL starting with http:// or https://")
    .refine((url) => {
      // Must be a valid Git repository URL
      return /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|.*\/.*\.git|.*\/.*\/.*)/.test(url);
    }, "Repository URL must be a valid Git repository URL (e.g., https://github.com/user/repo)"),
  branch: z.string().optional(),
  techStack: z.string().min(1, "Tech stack is required"),
  cloudProvider: z.string().optional(),
});

const mobileScanSchema = z.object({
  appName: z.string().min(1, "App name is required"),
  platform: z.enum(["ios", "android"], {
    required_error: "Platform is required",
  }),
  appId: z.string().min(1, "App Store URL or Bundle ID is required"),
  version: z.string().min(1, "Version is required"),
  apiEndpoint: z.string().optional()
    .refine((url) => {
      if (!url) return true; // Optional field
      return /^https?:\/\//.test(url);
    }, "API endpoint must be a valid URL starting with http:// or https://"),
  cloudProvider: z.string().optional(),
  notes: z.string().optional(),
});

const webScanSchema = z.object({
  appName: z.string().min(1, "Application name is required"),
  url: z.string().min(1, "Application URL is required").url("Must be a valid URL"),
  scanDepth: z.string().min(1, "Scan depth is required"),
  cloudProvider: z.string().optional(),
  authRequired: z.enum(["yes", "no"], {
    required_error: "Please specify if authentication is required",
  }),
});

type MvpScanFormData = z.infer<typeof mvpScanSchema>;
type MobileScanFormData = z.infer<typeof mobileScanSchema>;
type WebScanFormData = z.infer<typeof webScanSchema>;

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

  // Mutations for creating scans
  const mvpMutation = useMutation({
    mutationFn: async (data: InsertMvpCodeScan) => {
      return await apiRequest("POST", "/api/mvp-scans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mvp-scans"] });
    },
  });

  const mobileMutation = useMutation({
    mutationFn: async (data: InsertMobileAppScan) => {
      return await apiRequest("POST", "/api/mobile-scans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans"] });
    },
  });

  const webMutation = useMutation({
    mutationFn: async (data: InsertWebAppScan) => {
      return await apiRequest("POST", "/api/web-scans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-scans"] });
    },
  });

  // Form instances for each scan type
  const mvpForm = useForm<MvpScanFormData>({
    resolver: zodResolver(mvpScanSchema),
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
    resolver: zodResolver(mobileScanSchema),
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
    resolver: zodResolver(webScanSchema),
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

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setStep("select");
      setScanType(null);
      mvpForm.reset();
      mobileForm.reset();
      webForm.reset();
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
                        <span className="font-medium">Includes:</span> SAST, SCA, secrets detection, cloud/infra misconfiguration scan
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
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {scanType === "mvp" && "Configure MVP Code Scan"}
                {scanType === "mobile" && "Configure Mobile App Scan"}
                {scanType === "web" && "Configure Web App Scan"}
              </DialogTitle>
              <DialogDescription>
                {scanType === "mvp" && "Provide your code repository details for pre-launch security analysis"}
                {scanType === "mobile" && "Provide your mobile app details for security testing"}
                {scanType === "web" && "Provide your web application URL for comprehensive vulnerability assessment"}
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
                }}
                data-testid="button-start-scan"
              >
                Start {scanType === "mvp" ? "Code" : scanType === "mobile" ? "Mobile" : "Web"} Scan
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
