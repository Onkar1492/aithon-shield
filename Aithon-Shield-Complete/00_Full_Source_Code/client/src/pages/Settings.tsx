import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import SsoConfiguration from "@/components/SsoConfiguration";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { profileSettingsFormSchema, type User } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ApiKeyScope = "read" | "write" | "admin";

type ApiKeyListItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type WebhookListItem = {
  id: string;
  name: string;
  url: string;
  format: string;
  hasSecret: boolean;
  eventFilter: string | null;
  enabled: boolean;
  lastDeliveredAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
};

type GitConnectionRow = {
  id: string;
  provider: string;
  externalUsername: string | null;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
};

type AppConfigPayload = {
  demoMode: boolean;
  demoStrictScanTargets?: boolean;
  demoBannerTitle: string | null;
  demoBannerBody: string | null;
  demoSignupDisabled: boolean;
  demoApiKeysDisabled: boolean;
  demoScanHint: string | null;
};
import {
  requestNotificationPermission as requestPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationPermission,
} from "@/lib/pushNotifications";
import { Loader2, FileCode2, CheckCircle2, XCircle, Plus, Trash2, Send, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AITHON_SHIELD_YML_EXAMPLE } from "@shared/aithonShieldConfig";

type ProfileFormData = z.infer<typeof profileSettingsFormSchema>;

/** Strip accidental quotes; trim. */
function normalizeMergeGateField(s: string): string {
  return s.trim().replace(/^['"`]+|['"`]+$/g, "").trim();
}

/** GitHub repo slug: owner/repo (at least one slash, two non-empty segments). */
function isValidGithubRepoFullName(s: string): boolean {
  const t = normalizeMergeGateField(s);
  if (!t.includes("/")) return false;
  const parts = t
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length >= 2;
}

export default function Settings() {
  const { toast } = useToast();
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyScopes, setApiKeyScopes] = useState<Record<ApiKeyScope, boolean>>({
    read: true,
    write: true,
    admin: false,
  });
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null);
  const [mgRepo, setMgRepo] = useState("");
  const [mgSha, setMgSha] = useState("");
  const [mgConclusion, setMgConclusion] = useState("success");
  const [mgSummary, setMgSummary] = useState("Aithon Shield merge gate test from Settings.");
  const [mgPr, setMgPr] = useState("");
  const [mgDryRun, setMgDryRun] = useState(true);
  const [aithonYaml, setAithonYaml] = useState(AITHON_SHIELD_YML_EXAMPLE);
  const [evalCrit, setEvalCrit] = useState(0);
  const [evalHigh, setEvalHigh] = useState(6);
  const [evalMed, setEvalMed] = useState(0);
  const [evalLow, setEvalLow] = useState(0);
  const [slaCrit, setSlaCrit] = useState("");
  const [slaHighIn, setSlaHighIn] = useState("");
  const [slaMedIn, setSlaMedIn] = useState("");
  const [slaLowIn, setSlaLowIn] = useState("");
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);
  const [linearDialogOpen, setLinearDialogOpen] = useState(false);
  const [jiraSite, setJiraSite] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraProject, setJiraProject] = useState("");
  const [jiraIssueType, setJiraIssueType] = useState("Task");
  const [linearKey, setLinearKey] = useState("");
  const [linearTeam, setLinearTeam] = useState("");

  // Webhook state
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookListItem | null>(null);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whFormat, setWhFormat] = useState("json");
  const [whSecret, setWhSecret] = useState("");
  const [whEventFilter, setWhEventFilter] = useState("");
  const [whEnabled, setWhEnabled] = useState(true);

  // Update notification permission when it changes
  useEffect(() => {
    const updatePermission = () => {
      setNotificationPermission(getNotificationPermission());
    };
    
    // Listen for permission changes
    const interval = setInterval(updatePermission, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ['/api/auth/me'],
  });

  const { data: apiKeyRows, isLoading: loadingApiKeys } = useQuery<ApiKeyListItem[]>({
    queryKey: ["/api/api-keys"],
  });

  const { data: mergeGateStatus } = useQuery<{
    githubOAuthConfigured: boolean;
    githubConnected: boolean;
    githubUsername: string | null;
    demoMode: boolean;
  }>({
    queryKey: ["/api/merge-gate/status"],
  });

  const { data: appConfig } = useQuery<AppConfigPayload>({
    queryKey: ["/api/app-config"],
  });

  const { data: gitConnections, isLoading: loadingGitConnections } = useQuery<GitConnectionRow[]>({
    queryKey: ["/api/git-connections"],
  });

  type TrackerConnectionsPayload = {
    jira: {
      connected: boolean;
      siteBaseUrl: string | null;
      accountEmail: string | null;
      defaultProjectKey: string | null;
      defaultIssueTypeName: string;
    };
    linear: { connected: boolean; defaultTeamId: string | null };
  };

  const { data: trackerConnections } = useQuery<TrackerConnectionsPayload>({
    queryKey: ["/api/tracker-connections"],
  });

  const saveJiraMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/tracker-connections/jira", {
        siteBaseUrl: jiraSite.trim(),
        email: jiraEmail.trim(),
        apiToken: jiraToken,
        defaultProjectKey: jiraProject.trim() || undefined,
        defaultIssueTypeName: jiraIssueType.trim() || "Task",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracker-connections"] });
      setJiraDialogOpen(false);
      setJiraToken("");
      toast({ title: "Jira connected", description: "You can create issues from the Findings table." });
    },
    onError: (e: Error) => toast({ title: "Jira connection failed", description: e.message, variant: "destructive" }),
  });

  const disconnectJiraMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/tracker-connections/jira"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracker-connections"] });
      toast({ title: "Jira disconnected" });
    },
    onError: (e: Error) => toast({ title: "Disconnect failed", description: e.message, variant: "destructive" }),
  });

  const saveLinearMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/tracker-connections/linear", {
        apiKey: linearKey,
        defaultTeamId: linearTeam.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracker-connections"] });
      setLinearDialogOpen(false);
      setLinearKey("");
      toast({ title: "Linear connected", description: "You can create issues from the Findings table." });
    },
    onError: (e: Error) => toast({ title: "Linear connection failed", description: e.message, variant: "destructive" }),
  });

  const disconnectLinearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/tracker-connections/linear"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracker-connections"] });
      toast({ title: "Linear disconnected" });
    },
    onError: (e: Error) => toast({ title: "Disconnect failed", description: e.message, variant: "destructive" }),
  });

  // ── Webhook endpoints ──────────────────────────────────────

  const { data: webhookEndpoints, isLoading: loadingWebhooks } = useQuery<WebhookListItem[]>({
    queryKey: ["/api/webhook-endpoints"],
  });

  const saveWebhookMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name: whName, url: whUrl, format: whFormat, enabled: whEnabled };
      if (whSecret) payload.secret = whSecret;
      if (whEventFilter) payload.eventFilter = whEventFilter;
      if (editingWebhook) {
        return apiRequest("PATCH", `/api/webhook-endpoints/${editingWebhook.id}`, payload);
      }
      return apiRequest("POST", "/api/webhook-endpoints", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhook-endpoints"] });
      toast({ title: editingWebhook ? "Webhook updated" : "Webhook created" });
      closeWebhookDialog();
    },
    onError: (e: Error) => toast({ title: "Webhook save failed", description: e.message, variant: "destructive" }),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/webhook-endpoints/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhook-endpoints"] });
      toast({ title: "Webhook deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/webhook-endpoints/${id}/test`);
      return res.json() as Promise<{ ok: boolean; status: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhook-endpoints"] });
      toast({ title: data.ok ? "Ping succeeded" : "Ping failed", description: data.status, variant: data.ok ? "default" : "destructive" });
    },
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  function openWebhookDialog(ep?: WebhookListItem) {
    setEditingWebhook(ep ?? null);
    setWhName(ep?.name ?? "");
    setWhUrl(ep?.url ?? "");
    setWhFormat(ep?.format ?? "json");
    setWhSecret("");
    setWhEventFilter(ep?.eventFilter ?? "");
    setWhEnabled(ep?.enabled ?? true);
    setWebhookDialogOpen(true);
  }

  function closeWebhookDialog() {
    setWebhookDialogOpen(false);
    setEditingWebhook(null);
    setWhName("");
    setWhUrl("");
    setWhFormat("json");
    setWhSecret("");
    setWhEventFilter("");
    setWhEnabled(true);
  }

  const createApiKeyMutation = useMutation({
    mutationFn: async (payload: { name: string; scopes: ApiKeyScope[] }) => {
      const res = await apiRequest("POST", "/api/api-keys", payload);
      return res.json() as Promise<{
        plainKey: string;
        id: string;
        name: string;
        keyPrefix: string;
        createdAt: string;
      }>;
    },
    onSuccess: (data) => {
      setNewKeyPlain(data.plainKey);
      setApiKeyName("");
      setApiKeyScopes({ read: true, write: true, admin: false });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "API key created",
        description: "Copy the secret now. It is not stored in full and cannot be shown again.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not create key", description: error.message, variant: "destructive" });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not revoke key", description: error.message, variant: "destructive" });
    },
  });

  const deleteGitConnectionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/git-connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/git-connections"] });
      toast({ title: "Git account disconnected" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not disconnect", description: error.message, variant: "destructive" });
    },
  });

  const mergeGateTestMutation = useMutation({
    mutationFn: async () => {
      const repoFullName = normalizeMergeGateField(mgRepo);
      const headSha = normalizeMergeGateField(mgSha);
      const body: Record<string, unknown> = {
        repoFullName,
        headSha,
        conclusion: mgConclusion,
        summary: mgSummary,
        dryRun: mgDryRun,
      };
      const pr = mgPr.trim();
      if (pr) {
        const n = parseInt(pr, 10);
        if (!Number.isNaN(n) && n > 0) body.pullRequestNumber = n;
      }
      const res = await apiRequest("POST", "/api/merge-gate/github/report", body);
      return res.json() as Promise<{ checkRunId?: number; htmlUrl?: string | null; dryRun?: boolean }>;
    },
    onSuccess: (data) => {
      if (data.dryRun) {
        toast({
          title: "Dry run succeeded",
          description: "Request validated. No GitHub API call was made. Uncheck 'Dry run' and connect GitHub to post a real Check Run.",
        });
      } else {
        toast({
          title: "Check run created",
          description: data.htmlUrl
            ? "Open the link from the response in GitHub (Checks tab)."
            : `Check run id ${data.checkRunId ?? "?"}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Merge gate failed", description: error.message, variant: "destructive" });
    },
  });

  const validateAithonYamlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy/aithonshield/validate", { yaml: aithonYaml });
      return res.json() as Promise<{ ok: boolean; config?: unknown }>;
    },
    onSuccess: () => {
      toast({ title: "Configuration valid", description: "YAML parsed and matches the expected schema." });
    },
    onError: (error: Error) => {
      toast({ title: "Validation failed", description: error.message, variant: "destructive" });
    },
  });

  const evaluateAithonPolicyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy/aithonshield/evaluate", {
        yaml: aithonYaml,
        counts: {
          critical: evalCrit,
          high: evalHigh,
          medium: evalMed,
          low: evalLow,
        },
      });
      return res.json() as Promise<{
        ok: boolean;
        pass?: boolean;
        violations?: string[];
        failOn?: unknown;
        counts?: unknown;
      }>;
    },
    onSuccess: (data) => {
      toast({
        title: data.pass ? "Policy gate: pass" : "Policy gate: fail",
        description: data.violations?.length
          ? data.violations.join(" · ")
          : data.pass
            ? "Finding counts are within fail_on limits."
            : "",
        variant: data.pass ? undefined : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Evaluation failed", description: error.message, variant: "destructive" });
    },
  });

  const updateSlaPolicyMutation = useMutation({
    mutationFn: async () => {
      const parseHours = (s: string): number | null => {
        const t = s.trim();
        if (!t) return null;
        const n = parseFloat(t);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error("SLA hours must be positive numbers (or leave blank to clear).");
        }
        if (n > 8760) throw new Error("Maximum 8760 hours (one year) per severity.");
        return n;
      };
      const res = await apiRequest("PATCH", "/api/user/sla-policy", {
        critical: parseHours(slaCrit),
        high: parseHours(slaHighIn),
        medium: parseHours(slaMedIn),
        low: parseHours(slaLowIn),
      });
      return res.json() as Promise<{ user: User }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sla/summary"] });
      toast({ title: "SLA targets saved", description: "The SLA dashboard uses these hours." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save SLA", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("git_connected") && !params.has("git_error")) return;
    const connected = params.get("git_connected");
    const err = params.get("git_error");
    const detail = params.get("git_error_detail");
    if (connected) {
      toast({
        title: "Git connected",
        description: `Your ${connected === "github" ? "GitHub" : "GitLab"} account is linked.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/git-connections"] });
    }
    if (err) {
      toast({
        title: "Git connection failed",
        description: detail || err,
        variant: "destructive",
      });
    }
    window.history.replaceState({}, "", "/settings");
  }, []);

  const user = userData?.user;

  useEffect(() => {
    const h = user?.slaPolicyHours as Record<string, number> | null | undefined;
    if (!h || typeof h !== "object") {
      setSlaCrit("");
      setSlaHighIn("");
      setSlaMedIn("");
      setSlaLowIn("");
      return;
    }
    setSlaCrit(h.critical != null ? String(h.critical) : "");
    setSlaHighIn(h.high != null ? String(h.high) : "");
    setSlaMedIn(h.medium != null ? String(h.medium) : "");
    setSlaLowIn(h.low != null ? String(h.low) : "");
  }, [user?.slaPolicyHours]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSettingsFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      password: "",
    },
    values: user ? {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
    } : undefined,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const payload: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      };
      if (data.password && data.password.length > 0) {
        payload.password = data.password;
      }
      const response = await apiRequest('PATCH', '/api/user/profile', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      profileForm.setValue('password', '');
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateShieldAdvisorProviderMutation = useMutation({
    mutationFn: async (shieldAdvisorProvider: string) => {
      const response = await apiRequest("PATCH", "/api/user/profile", { shieldAdvisorProvider });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Shield Advisor model saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save model", description: error.message, variant: "destructive" });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await apiRequest('PATCH', '/api/user/notifications', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Notification preferences updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleNotificationToggle = (key: keyof User, value: boolean) => {
    updateNotificationsMutation.mutate({ [key]: value });
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications();
        
        if (subscription) {
          toast({
            title: "Notifications enabled",
            description: "You will now receive push notifications about your scans.",
          });
        } else {
          toast({
            title: "Subscription failed",
            description: "Failed to subscribe to push notifications. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to enable notifications. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your security platform configuration
        </p>
      </div>

      {/* User Profile Section */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">User Profile</h2>
        {isLoadingUser ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" data-testid="skeleton-profile-loading" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-first-name"
                          disabled={updateProfileMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-last-name"
                          disabled={updateProfileMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        data-testid="input-email"
                        disabled={updateProfileMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (leave blank to keep current)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-password"
                        disabled={updateProfileMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </Form>
        )}
      </Card>

      {/* Push Notification Section */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Push Notifications</h2>
        {isLoadingUser ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" data-testid="skeleton-notifications-loading" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {notificationPermission !== 'granted' && (
              <div className="p-4 shadow-sm rounded-lg flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">Browser Notifications Not Enabled</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click the button to enable push notifications in your browser
                  </p>
                </div>
                <Button
                  onClick={requestNotificationPermission}
                  variant="outline"
                  data-testid="button-request-permission"
                >
                  Request Permission
                </Button>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-enabled" className="text-base">Enable Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about your scans and security findings
                </p>
              </div>
              <Switch
                id="push-enabled"
                checked={user?.pushNotificationsEnabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('pushNotificationsEnabled', checked)}
                disabled={updateNotificationsMutation.isPending}
                data-testid="switch-push-enabled"
              />
            </div>
            
            {user?.pushNotificationsEnabled && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-scan-complete" className="text-sm font-normal">Scan Complete Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified when a scan finishes
                      </p>
                    </div>
                    <Switch
                      id="notify-scan-complete"
                      checked={user?.notifyOnScanComplete ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnScanComplete', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-scan-complete"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-fixes-applied" className="text-sm font-normal">Fixes Applied Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified when fixes are successfully applied
                      </p>
                    </div>
                    <Switch
                      id="notify-fixes-applied"
                      checked={user?.notifyOnFixesApplied ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnFixesApplied', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-fixes-applied"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-upload" className="text-sm font-normal">Upload/Re-upload Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified about upload progress and completion
                      </p>
                    </div>
                    <Switch
                      id="notify-upload"
                      checked={user?.notifyOnUpload ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnUpload', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-upload"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-cve-watchlist" className="text-sm font-normal">CVE watchlist (push)</Label>
                      <p className="text-xs text-muted-foreground">
                        Browser push when a watched CVE appears in a finding (in-app alerts always respect your watchlist entries)
                      </p>
                    </div>
                    <Switch
                      id="notify-cve-watchlist"
                      checked={user?.notifyOnCveWatchlist ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnCveWatchlist', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-cve-watchlist"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Shield Advisor</h2>
        <p className="text-sm text-muted-foreground mb-4">
          In-app security assistant (floating button, bottom-right). Pick which provider the server uses; set the matching API key or AWS credentials on the server.
        </p>
        {isLoadingUser ? (
          <Skeleton className="h-10 w-full max-w-md" />
        ) : (
          <div className="space-y-2 max-w-md">
            <Label htmlFor="shield-advisor-provider">Model provider</Label>
            <Select
              value={user?.shieldAdvisorProvider ?? "openai"}
              onValueChange={(v) => updateShieldAdvisorProviderMutation.mutate(v)}
              disabled={updateShieldAdvisorProviderMutation.isPending}
            >
              <SelectTrigger id="shield-advisor-provider" data-testid="select-shield-advisor-provider">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="mistral">Mistral</SelectItem>
                <SelectItem value="llama">Llama (OpenAI-compatible)</SelectItem>
                <SelectItem value="bedrock">AWS Bedrock</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              In demo mode, replies are canned without calling external LLMs. With keys configured, non-demo uses your selected provider.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">API keys and agents</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use keys for programmatic access, MCP, and AI tools. Send{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code>{" "}
          or header <code className="text-xs bg-muted px-1 py-0.5 rounded">X-API-Key</code>. Machine-readable API index:{" "}
          <a href="/openapi.json" className="text-primary underline" target="_blank" rel="noreferrer">
            /openapi.json
          </a>
          . MCP (stdio): set <code className="text-xs bg-muted px-1 py-0.5 rounded">AITHON_API_KEY</code> and{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">AITHON_API_URL</code>, then run{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">npm run mcp</code>.
        </p>

        {newKeyPlain && (
          <div className="mb-4 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 space-y-2">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Copy this secret once</p>
            <Input readOnly value={newKeyPlain} className="font-mono text-xs" data-testid="input-new-api-key" />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newKeyPlain);
                    toast({ title: "Copied to clipboard" });
                  } catch {
                    toast({ title: "Copy failed", variant: "destructive" });
                  }
                }}
              >
                Copy
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setNewKeyPlain(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Key label (e.g. Cursor, CI)"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              className="max-w-md"
              data-testid="input-api-key-name"
            />
            <Button
              type="button"
              disabled={
                !apiKeyName.trim() ||
                createApiKeyMutation.isPending ||
                !(apiKeyScopes.read || apiKeyScopes.write || apiKeyScopes.admin)
              }
              onClick={() => {
                const scopes: ApiKeyScope[] = (["read", "write", "admin"] as const).filter((s) => apiKeyScopes[s]);
                if (scopes.length === 0) return;
                createApiKeyMutation.mutate({ name: apiKeyName.trim(), scopes });
              }}
              data-testid="button-create-api-key"
            >
              {createApiKeyMutation.isPending ? "Creating…" : "Create API key"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                { id: "read" as const, label: "Read", hint: "GET / list resources" },
                { id: "write" as const, label: "Write", hint: "Create, update, delete, start scans" },
                { id: "admin" as const, label: "Admin", hint: "Full API access (same as both + reserved admin routes)" },
              ] as const
            ).map(({ id, label, hint }) => (
              <label key={id} className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={apiKeyScopes[id]}
                  onCheckedChange={(c) =>
                    setApiKeyScopes((prev) => ({ ...prev, [id]: c === true }))
                  }
                  data-testid={`checkbox-api-key-scope-${id}`}
                />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {loadingApiKeys ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            {(apiKeyRows?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {apiKeyRows!.map((row) => (
                  <li key={row.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{row.keyPrefix}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {row.scopes
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                              {s}
                            </Badge>
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {format(new Date(row.createdAt), "PPp")}
                        {row.lastUsedAt ? ` · Last used ${format(new Date(row.lastUsedAt), "PPp")}` : " · Never used"}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" data-testid={`button-revoke-api-key-${row.id}`}>
                          Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Agents using this key will lose access immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteApiKeyMutation.mutate(row.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Git integrations</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect GitHub or GitLab so Aithon Shield can open remediation branches and pull/merge requests from the API (
          <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /api/remediation-jobs</code>
          ). Configure OAuth apps with redirect URL{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
            {typeof window !== "undefined" ? `${window.location.origin}/api/oauth/github/callback` : "…/api/oauth/github/callback"}
          </code>{" "}
          (and the GitLab equivalent). Set{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">APP_BASE_URL</code> in production if the app is behind a proxy.
        </p>
        {appConfig?.demoMode ? (
          <p className="text-sm text-muted-foreground">
            Demo mode: linking Git accounts and remediation jobs are disabled. Merge gate (below) uses the same rule—use a
            non-demo server to connect GitHub and test CI integrations end-to-end.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-6">
            <Button type="button" variant="outline" onClick={() => { window.location.href = "/api/oauth/github/start"; }} data-testid="button-connect-github">
              Connect GitHub
            </Button>
            <Button type="button" variant="outline" onClick={() => { window.location.href = "/api/oauth/gitlab/start"; }} data-testid="button-connect-gitlab">
              Connect GitLab
            </Button>
          </div>
        )}
        {loadingGitConnections ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            {(gitConnections?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No Git accounts linked yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {gitConnections!.map((row) => (
                  <li key={row.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium capitalize">{row.provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.externalUsername ? `@${row.externalUsername}` : "Connected"}
                        {row.scope ? ` · scopes: ${row.scope}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Linked {format(new Date(row.createdAt), "PPp")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteGitConnectionMutation.mutate(row.id)}
                      disabled={deleteGitConnectionMutation.isPending}
                      data-testid={`button-disconnect-git-${row.provider}`}
                    >
                      Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">CI/CD merge gate (GitHub)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Post a <strong>GitHub Check Run</strong> on a commit (and optionally comment on the PR). Use{" "}
          <strong>Dry run</strong> to validate the request without calling GitHub.
        </p>

        {mergeGateStatus && (
          <div className="mb-4 space-y-1 text-sm">
            <p>
              GitHub OAuth:{" "}
              {mergeGateStatus.githubOAuthConfigured ? (
                <Badge variant="default" className="text-xs">configured</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">not configured (GITHUB_CLIENT_ID missing)</Badge>
              )}
            </p>
            <p>
              GitHub account:{" "}
              {mergeGateStatus.githubConnected ? (
                <Badge variant="default" className="text-xs">@{mergeGateStatus.githubUsername}</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">not linked</Badge>
              )}
            </p>
            {mergeGateStatus.demoMode && (
              <p className="text-muted-foreground text-xs">Demo mode is on — real GitHub calls are blocked, but dry run works.</p>
            )}
          </div>
        )}

        <div className="space-y-3 rounded-md border p-4">
          <p className="font-medium text-foreground">Try it (browser)</p>
          <p className="text-muted-foreground text-xs">
            Repository must be <strong>owner/repo</strong> (GitHub slug with a slash, e.g.{" "}
            <code className="bg-muted px-1 rounded">octocat/Hello-World</code>). Commit SHA needs at least 7
            characters. With <strong>Dry run</strong> checked, no GitHub token is required.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="mg-repo">Repository (owner/repo)</Label>
              <Input
                id="mg-repo"
                value={mgRepo}
                onChange={(e) => setMgRepo(e.target.value)}
                placeholder="e.g. octocat/Hello-World"
                autoComplete="off"
                data-testid="input-merge-gate-repo"
              />
              <p className="text-xs text-muted-foreground">
                Two parts separated by <code className="bg-muted px-0.5 rounded">/</code> — not a single word.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mg-sha">Commit SHA</Label>
              <Input
                id="mg-sha"
                value={mgSha}
                onChange={(e) => setMgSha(e.target.value)}
                placeholder="at least 7 hex characters"
                autoComplete="off"
                data-testid="input-merge-gate-sha"
              />
              <p className="text-xs text-muted-foreground">Paste from GitHub commit page; quotes are stripped automatically.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Conclusion</Label>
              <Select value={mgConclusion} onValueChange={setMgConclusion}>
                <SelectTrigger data-testid="select-merge-gate-conclusion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">success</SelectItem>
                  <SelectItem value="failure">failure</SelectItem>
                  <SelectItem value="neutral">neutral</SelectItem>
                  <SelectItem value="skipped">skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mg-pr">PR number (optional)</Label>
              <Input
                id="mg-pr"
                value={mgPr}
                onChange={(e) => setMgPr(e.target.value)}
                placeholder="e.g. 42"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mg-sum">Summary</Label>
            <Textarea
              id="mg-sum"
              value={mgSummary}
              onChange={(e) => setMgSummary(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="mg-dry-run"
              checked={mgDryRun}
              onCheckedChange={(v) => setMgDryRun(Boolean(v))}
            />
            <Label htmlFor="mg-dry-run" className="text-sm font-normal cursor-pointer">
              Dry run (validate only — no GitHub API call)
            </Label>
          </div>
          <Button
            type="button"
            onClick={() => {
              const sha = normalizeMergeGateField(mgSha);
              if (!isValidGithubRepoFullName(mgRepo)) {
                toast({
                  title: "Repository must be owner/repo",
                  description:
                    'Enter two names separated by a slash, like "octocat/Hello-World". A single word will not work.',
                  variant: "destructive",
                });
                return;
              }
              if (sha.length < 7) {
                toast({
                  title: "Commit SHA too short",
                  description: "Use at least 7 characters (GitHub short SHA or full hash).",
                  variant: "destructive",
                });
                return;
              }
              mergeGateTestMutation.mutate();
            }}
            disabled={
              mergeGateTestMutation.isPending ||
              !normalizeMergeGateField(mgRepo) ||
              !normalizeMergeGateField(mgSha)
            }
            data-testid="button-merge-gate-test"
          >
            {mergeGateTestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mgDryRun ? "Send dry run" : "Send check run"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <FileCode2 className="h-6 w-6 text-primary" aria-hidden />
          Security as code (<code className="text-sm font-mono bg-muted px-1 rounded">.aithonshield.yml</code>)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Commit this file at the root of a repository to describe scan modules, <strong>fail_on</strong> finding
          ceilings, suppressions, and compliance tags. Use the editor below to validate YAML and simulate whether a
          scan summary would pass your <strong>policy.fail_on</strong> rules.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aithon-yaml">YAML</Label>
            <Textarea
              id="aithon-yaml"
              value={aithonYaml}
              onChange={(e) => setAithonYaml(e.target.value)}
              rows={16}
              className="font-mono text-xs md:text-sm"
              spellCheck={false}
              data-testid="textarea-aithonshield-yml"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => validateAithonYamlMutation.mutate()}
              disabled={validateAithonYamlMutation.isPending || !aithonYaml.trim()}
              data-testid="button-aithonshield-validate"
            >
              {validateAithonYamlMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validate YAML
            </Button>
            <Button type="button" variant="outline" onClick={() => setAithonYaml(AITHON_SHIELD_YML_EXAMPLE)}>
              Reset to example
            </Button>
          </div>
          {validateAithonYamlMutation.isSuccess && validateAithonYamlMutation.data?.ok && validateAithonYamlMutation.data.config != null && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Parsed configuration</AlertTitle>
              <AlertDescription>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(validateAithonYamlMutation.data.config, null, 2)}
                </pre>
              </AlertDescription>
            </Alert>
          )}
          <div className="rounded-md border p-4 space-y-3">
            <p className="font-medium text-sm">Test policy gate (fail_on)</p>
            <p className="text-xs text-muted-foreground">
              Enter hypothetical finding counts. The example file allows up to <strong>0</strong> critical and{" "}
              <strong>5</strong> high — so 6 high findings should <strong>fail</strong> until you raise the limit or
              lower the counts.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["Critical", evalCrit, setEvalCrit],
                  ["High", evalHigh, setEvalHigh],
                  ["Medium", evalMed, setEvalMed],
                  ["Low", evalLow, setEvalLow],
                ] as const
              ).map(([label, val, setVal]) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => setVal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => evaluateAithonPolicyMutation.mutate()}
              disabled={evaluateAithonPolicyMutation.isPending || !aithonYaml.trim()}
              data-testid="button-aithonshield-evaluate"
            >
              {evaluateAithonPolicyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Evaluate gate
            </Button>
            {evaluateAithonPolicyMutation.isSuccess && evaluateAithonPolicyMutation.data?.ok === true && (
              <Alert variant={evaluateAithonPolicyMutation.data.pass ? "default" : "destructive"}>
                {evaluateAithonPolicyMutation.data.pass ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{evaluateAithonPolicyMutation.data.pass ? "Gate would pass" : "Gate would fail"}</AlertTitle>
                <AlertDescription>
                  {evaluateAithonPolicyMutation.data.violations?.length ? (
                    <ul className="list-disc pl-4 mt-1 text-sm">
                      {evaluateAithonPolicyMutation.data.violations.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm">All severities are within configured limits.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">SLA targets (hours)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Maximum hours to remediate an open finding from when it was first seen, by severity. Matches the idea of{" "}
          <code className="text-xs bg-muted px-1 rounded">policy.sla</code> in{" "}
          <code className="text-xs bg-muted px-1 rounded">.aithonshield.yml</code> (e.g. <code className="text-xs">24h</code> →{" "}
          <code className="text-xs">24</code> hours). Use the{" "}
          <a href="/sla" className="text-primary underline underline-offset-2">
            SLA
          </a>{" "}
          page to see breaches and upcoming deadlines.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
          {(
            [
              ["Critical", slaCrit, setSlaCrit],
              ["High", slaHighIn, setSlaHighIn],
              ["Medium", slaMedIn, setSlaMedIn],
              ["Low", slaLowIn, setSlaLowIn],
            ] as const
          ).map(([label, val, setVal]) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min={1}
                max={8760}
                placeholder="—"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                data-testid={`input-sla-${label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          className="mt-4"
          onClick={() => updateSlaPolicyMutation.mutate()}
          disabled={updateSlaPolicyMutation.isPending}
          data-testid="button-save-sla-policy"
        >
          {updateSlaPolicyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save SLA targets
        </Button>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">General Settings</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              defaultValue="Acme Corporation"
              data-testid="input-org-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input
              id="contact-email"
              type="email"
              defaultValue="security@acme.com"
              data-testid="input-contact-email"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Subscription Tier</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="text-lg font-bold capitalize">{userData?.user?.subscriptionTier ?? "free"}</p>
              <p className="text-xs text-muted-foreground capitalize">Status: {userData?.user?.subscriptionStatus ?? "active"}</p>
            </div>
            <a href="/plans">
              <Button data-testid="button-view-plans">View Plans & Pricing</Button>
            </a>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Scan Configuration</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-scan on Push</Label>
              <p className="text-sm text-muted-foreground">
                Automatically trigger scans when code is pushed
              </p>
            </div>
            <Switch defaultChecked data-testid="switch-auto-scan" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email alerts for critical findings
              </p>
            </div>
            <Switch defaultChecked data-testid="switch-email-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Block Deployments</Label>
              <p className="text-sm text-muted-foreground">
                Block deployments when critical issues are found
              </p>
            </div>
            <Switch data-testid="switch-block-deployments" />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Alert Notifications</h2>
        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Alert Channels</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">📧</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Email</p>
                    <p className="text-xs text-muted-foreground">security@acme.com</p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-email-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">💬</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Slack</p>
                    <p className="text-xs text-muted-foreground">#security-alerts</p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-slack-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">📱</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">SMS</p>
                    <p className="text-xs text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                </div>
                <Switch data-testid="switch-sms-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">🔔</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Microsoft Teams</p>
                    <p className="text-xs text-muted-foreground">Security Team</p>
                  </div>
                </div>
                <Switch data-testid="switch-teams-alerts" />
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <Label className="mb-3 block">Alert Thresholds</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Critical Findings</Label>
                <Switch defaultChecked data-testid="switch-critical-alerts" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">High Findings</Label>
                <Switch defaultChecked data-testid="switch-high-alerts" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Medium Findings</Label>
                <Switch data-testid="switch-medium-alerts" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Issue trackers (Jira / Linear)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect with an API token (Jira Cloud) or API key (Linear). Create issues from each finding in the Findings table.
        </p>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 shadow-sm rounded-lg border border-border/60">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="font-semibold text-primary">JR</span>
              </div>
              <div>
                <p className="font-medium">Jira Cloud</p>
                <p className="text-sm text-muted-foreground">
                  {trackerConnections?.jira.connected
                    ? `${trackerConnections.jira.siteBaseUrl ?? "—"} · ${trackerConnections.jira.accountEmail ?? ""}`
                    : "Not connected"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {trackerConnections?.jira.connected ? (
                <Button
                  variant="outline"
                  disabled={disconnectJiraMutation.isPending}
                  onClick={() => disconnectJiraMutation.mutate()}
                  data-testid="button-disconnect-jira"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  data-testid="button-connect-jira"
                  onClick={() => {
                    setJiraSite("");
                    setJiraEmail("");
                    setJiraToken("");
                    setJiraProject("");
                    setJiraIssueType("Task");
                    setJiraDialogOpen(true);
                  }}
                >
                  Connect Jira
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 shadow-sm rounded-lg border border-border/60">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="font-semibold text-primary">LN</span>
              </div>
              <div>
                <p className="font-medium">Linear</p>
                <p className="text-sm text-muted-foreground">
                  {trackerConnections?.linear.connected
                    ? `Default team: ${trackerConnections.linear.defaultTeamId ?? "(set when connecting)"}`
                    : "Not connected"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {trackerConnections?.linear.connected ? (
                <Button
                  variant="outline"
                  disabled={disconnectLinearMutation.isPending}
                  onClick={() => disconnectLinearMutation.mutate()}
                  data-testid="button-disconnect-linear"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  data-testid="button-connect-linear"
                  onClick={() => {
                    setLinearKey("");
                    setLinearTeam("");
                    setLinearDialogOpen(true);
                  }}
                >
                  Connect Linear
                </Button>
              )}
            </div>
          </div>
        </div>

        <Dialog open={jiraDialogOpen} onOpenChange={setJiraDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Connect Jira Cloud</DialogTitle>
              <DialogDescription>
                Use a Jira Cloud site (https://your-domain.atlassian.net) and an API token from Atlassian account settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Site URL</Label>
                <Input
                  className="mt-1"
                  placeholder="https://your-domain.atlassian.net"
                  value={jiraSite}
                  onChange={(e) => setJiraSite(e.target.value)}
                  data-testid="input-jira-site"
                />
              </div>
              <div>
                <Label>Atlassian account email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  autoComplete="off"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                  data-testid="input-jira-email"
                />
              </div>
              <div>
                <Label>API token</Label>
                <Input
                  className="mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={jiraToken}
                  onChange={(e) => setJiraToken(e.target.value)}
                  data-testid="input-jira-token"
                />
              </div>
              <div>
                <Label>Default project key</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. SEC"
                  value={jiraProject}
                  onChange={(e) => setJiraProject(e.target.value)}
                  data-testid="input-jira-project"
                />
              </div>
              <div>
                <Label>Issue type name</Label>
                <Input
                  className="mt-1"
                  placeholder="Task"
                  value={jiraIssueType}
                  onChange={(e) => setJiraIssueType(e.target.value)}
                  data-testid="input-jira-issue-type"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJiraDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={saveJiraMutation.isPending || !jiraSite.trim() || !jiraEmail.trim() || jiraToken.length < 8}
                onClick={() => saveJiraMutation.mutate()}
                data-testid="button-save-jira"
              >
                {saveJiraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={linearDialogOpen} onOpenChange={setLinearDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Linear</DialogTitle>
              <DialogDescription>Create a personal API key in Linear (Settings → API) with create issue access.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>API key</Label>
                <Input
                  className="mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={linearKey}
                  onChange={(e) => setLinearKey(e.target.value)}
                  data-testid="input-linear-key"
                />
              </div>
              <div>
                <Label>Default team ID</Label>
                <Input
                  className="mt-1"
                  placeholder="UUID from Linear team settings URL"
                  value={linearTeam}
                  onChange={(e) => setLinearTeam(e.target.value)}
                  data-testid="input-linear-team"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinearDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={saveLinearMutation.isPending || linearKey.length < 8}
                onClick={() => saveLinearMutation.mutate()}
                data-testid="button-save-linear"
              >
                {saveLinearMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      {/* ── Webhooks + SIEM ──────────────────────────────────── */}
      <Card className="p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Webhooks &amp; SIEM</h2>
          <Button size="sm" onClick={() => openWebhookDialog()} data-testid="button-add-webhook">
            <Plus className="w-4 h-4 mr-1" /> Add endpoint
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Receive real-time security events (scan.completed, finding.created, finding.resolved, sla.breached, risk.accepted, risk.revoked) via JSON, CEF, or syslog payloads.
        </p>

        {loadingWebhooks ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : !webhookEndpoints?.length ? (
          <p className="text-sm text-muted-foreground italic">No webhook endpoints configured.</p>
        ) : (
          <div className="space-y-3">
            {webhookEndpoints.map((ep) => (
              <div key={ep.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-lg border border-border/60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{ep.name}</span>
                    <Badge variant="outline" className="text-xs uppercase">{ep.format}</Badge>
                    {ep.enabled ? (
                      <Badge className="text-xs bg-green-500/15 text-green-500 border-green-500/40">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Disabled</Badge>
                    )}
                    {ep.hasSecret && <Badge variant="outline" className="text-xs">HMAC</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{ep.url}</p>
                  {ep.eventFilter && <p className="text-xs text-muted-foreground mt-0.5">Events: {ep.eventFilter}</p>}
                  {ep.lastDeliveryStatus && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last delivery: {ep.lastDeliveryStatus}
                      {ep.lastDeliveredAt && ` (${new Date(ep.lastDeliveredAt).toLocaleString()})`}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => testWebhookMutation.mutate(ep.id)} disabled={testWebhookMutation.isPending} data-testid={`button-test-webhook-${ep.id}`}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Ping
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openWebhookDialog(ep)} data-testid={`button-edit-webhook-${ep.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteWebhookMutation.mutate(ep.id)} disabled={deleteWebhookMutation.isPending} data-testid={`button-delete-webhook-${ep.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={webhookDialogOpen} onOpenChange={(o) => !o && closeWebhookDialog()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? "Edit webhook endpoint" : "Add webhook endpoint"}</DialogTitle>
              <DialogDescription>Events are delivered as HTTP POST with optional HMAC-SHA256 signature.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Name</Label>
                <Input className="mt-1" placeholder="e.g. Splunk prod" value={whName} onChange={(e) => setWhName(e.target.value)} data-testid="input-webhook-name" />
              </div>
              <div>
                <Label>URL (HTTPS)</Label>
                <Input className="mt-1" placeholder="https://siem.example.com/webhook" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} data-testid="input-webhook-url" />
              </div>
              <div>
                <Label>Format</Label>
                <Select value={whFormat} onValueChange={setWhFormat}>
                  <SelectTrigger className="mt-1" data-testid="select-webhook-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="cef">CEF (ArcSight / Splunk)</SelectItem>
                    <SelectItem value="syslog">Syslog (RFC 5424)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Signing secret (optional)</Label>
                <Input className="mt-1" type="password" autoComplete="new-password" placeholder={editingWebhook?.hasSecret ? "(unchanged)" : "HMAC-SHA256 secret"} value={whSecret} onChange={(e) => setWhSecret(e.target.value)} data-testid="input-webhook-secret" />
              </div>
              <div>
                <Label>Event filter (optional, comma-separated)</Label>
                <Input className="mt-1" placeholder="scan.completed,finding.created — leave empty for all" value={whEventFilter} onChange={(e) => setWhEventFilter(e.target.value)} data-testid="input-webhook-event-filter" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={whEnabled} onCheckedChange={setWhEnabled} data-testid="switch-webhook-enabled" />
                <Label>Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeWebhookDialog}>Cancel</Button>
              <Button disabled={saveWebhookMutation.isPending || !whName || !whUrl} onClick={() => saveWebhookMutation.mutate()} data-testid="button-save-webhook">
                {saveWebhookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingWebhook ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      <SsoConfiguration />

      <div className="flex justify-end">
        <Button data-testid="button-save-settings">Save Changes</Button>
      </div>
    </div>
  );
}
