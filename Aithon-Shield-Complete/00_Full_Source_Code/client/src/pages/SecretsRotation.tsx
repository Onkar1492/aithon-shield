import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  KeyRound,
  Trash2,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface SecretsRotationTicket {
  id: string;
  userId: string;
  findingId: string | null;
  secretName: string;
  secretType: string;
  location: string | null;
  severity: string;
  status: string;
  stepRemovedFromCode: boolean;
  stepNewSecretGenerated: boolean;
  stepStoredInManager: boolean;
  stepAppConfigUpdated: boolean;
  stepOldSecretRevoked: boolean;
  stepVerified: boolean;
  notes: string | null;
  secretsManager: string | null;
  rotatedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function fmtDate(iso: string | Date | null): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? parseISO(iso) : iso;
    if (Number.isNaN(d.getTime())) return String(iso);
    return format(d, "MMM d, yyyy HH:mm");
  } catch {
    return String(iso);
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const colors: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-500 text-black",
    low: "bg-blue-500 text-white",
  };
  return (
    <Badge className={colors[s] ?? "bg-muted text-muted-foreground"}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-red-500/20 text-red-400 border-red-500/30",
    in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    rotated: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    verified: "bg-green-500/20 text-green-400 border-green-500/30",
    dismissed: "bg-muted text-muted-foreground border-muted",
  };
  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    rotated: "Rotated",
    verified: "Verified",
    dismissed: "Dismissed",
  };
  return (
    <Badge variant="outline" className={colors[status] ?? ""}>
      {labels[status] ?? status}
    </Badge>
  );
}

const SECRET_TYPES = [
  { value: "api_key", label: "API Key" },
  { value: "aws_credential", label: "AWS Credential" },
  { value: "database_url", label: "Database URL" },
  { value: "jwt_token", label: "JWT Token" },
  { value: "oauth_token", label: "OAuth Token" },
  { value: "private_key", label: "Private Key" },
  { value: "certificate_key", label: "Certificate Key" },
  { value: "stripe_api_key", label: "Stripe API Key" },
  { value: "github_token", label: "GitHub Token" },
  { value: "slack_token", label: "Slack Token" },
  { value: "google_api_key", label: "Google API Key" },
  { value: "other", label: "Other" },
];

const SECRETS_MANAGERS = [
  { value: "vault", label: "HashiCorp Vault" },
  { value: "aws_sm", label: "AWS Secrets Manager" },
  { value: "gcp_sm", label: "GCP Secret Manager" },
  { value: "azure_kv", label: "Azure Key Vault" },
  { value: "dotenv", label: ".env file (local)" },
  { value: "1password", label: "1Password" },
  { value: "other", label: "Other" },
];

const ROTATION_STEPS = [
  { key: "stepRemovedFromCode" as const, label: "Remove hardcoded secret from code", icon: "1" },
  { key: "stepNewSecretGenerated" as const, label: "Generate a new secret / credential", icon: "2" },
  { key: "stepStoredInManager" as const, label: "Store in secrets manager", icon: "3" },
  { key: "stepAppConfigUpdated" as const, label: "Update app config to reference manager", icon: "4" },
  { key: "stepOldSecretRevoked" as const, label: "Revoke / invalidate the old secret", icon: "5" },
  { key: "stepVerified" as const, label: "Verify app works with the new secret", icon: "6" },
];

type StepKey = (typeof ROTATION_STEPS)[number]["key"];

export default function SecretsRotationPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [typeInput, setTypeInput] = useState("api_key");
  const [locationInput, setLocationInput] = useState("");
  const [severityInput, setSeverityInput] = useState("high");
  const [notesInput, setNotesInput] = useState("");

  const { data, isLoading } = useQuery<{ tickets: SecretsRotationTicket[] }>({
    queryKey: ["/api/secrets-rotation"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/secrets-rotation", {
        secretName: nameInput.trim(),
        secretType: typeInput,
        location: locationInput.trim() || null,
        severity: severityInput,
        notes: notesInput.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setNameInput("");
      setTypeInput("api_key");
      setLocationInput("");
      setSeverityInput("high");
      setNotesInput("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/secrets-rotation"] });
      toast({ title: "Rotation ticket created" });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to create ticket", description: e.message, variant: "destructive" });
    },
  });

  const autoCreateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/secrets-rotation/auto-create", {});
      return res.json() as Promise<{ created: number; skipped: number }>;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/secrets-rotation"] });
      toast({
        title: "Auto-import complete",
        description: `Created ${r.created} ticket${r.created !== 1 ? "s" : ""} from scan findings. ${r.skipped} already existed.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Auto-import failed", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/secrets-rotation/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secrets-rotation"] });
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/secrets-rotation/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/secrets-rotation"] });
      toast({ title: "Ticket deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const tickets = data?.tickets ?? [];
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const rotatedCount = tickets.filter((t) => t.status === "rotated" || t.status === "verified").length;
  const dismissedCount = tickets.filter((t) => t.status === "dismissed").length;

  function handleStepToggle(ticket: SecretsRotationTicket, stepKey: StepKey, checked: boolean) {
    const updates: Record<string, unknown> = { [stepKey]: checked };
    const allSteps = ROTATION_STEPS.map((s) => s.key);
    const currentSteps = { ...ticket, [stepKey]: checked };
    const allDone = allSteps.every((k) => currentSteps[k]);
    if (allDone && ticket.status !== "verified") {
      updates.status = "verified";
    } else if (checked && ticket.status === "open") {
      updates.status = "in_progress";
    }
    updateMutation.mutate({ id: ticket.id, data: updates });
  }

  function handleStatusChange(ticket: SecretsRotationTicket, newStatus: string) {
    updateMutation.mutate({ id: ticket.id, data: { status: newStatus } });
  }

  function handleManagerChange(ticket: SecretsRotationTicket, manager: string) {
    updateMutation.mutate({ id: ticket.id, data: { secretsManager: manager } });
  }

  function completedStepCount(ticket: SecretsRotationTicket): number {
    return ROTATION_STEPS.filter((s) => ticket[s.key]).length;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-8 w-8 text-primary" aria-hidden />
            Secrets Rotation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
            Track and rotate hardcoded secrets found in your scans. Each ticket walks you through a
            6-step checklist: remove from code, generate new secret, store in a manager, update config,
            revoke the old one, and verify.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => autoCreateMutation.mutate()}
            disabled={autoCreateMutation.isPending}
            data-testid="button-secrets-auto-import"
          >
            {autoCreateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Import from Scans
          </Button>
          <Button onClick={() => setShowCreate(!showCreate)} data-testid="button-secrets-create">
            <Plus className="h-4 w-4 mr-2" />
            Add Ticket
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{tickets.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{openCount}</div>
          <div className="text-xs text-muted-foreground">Need Rotation</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{rotatedCount}</div>
          <div className="text-xs text-muted-foreground">Rotated / Verified</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{dismissedCount}</div>
          <div className="text-xs text-muted-foreground">Dismissed</div>
        </Card>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="p-6 shadow-sm border-primary/30">
          <h2 className="text-lg font-semibold mb-4">Create Rotation Ticket</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="secret-name">Secret Name</Label>
              <Input
                id="secret-name"
                placeholder="e.g. AWS_SECRET_ACCESS_KEY in config.ts"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                data-testid="input-secret-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-type">Secret Type</Label>
              <Select value={typeInput} onValueChange={setTypeInput}>
                <SelectTrigger id="secret-type" data-testid="select-secret-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECRET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-location">Location (optional)</Label>
              <Input
                id="secret-location"
                placeholder="e.g. src/config.ts:42"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                data-testid="input-secret-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-severity">Severity</Label>
              <Select value={severityInput} onValueChange={setSeverityInput}>
                <SelectTrigger id="secret-severity" data-testid="select-secret-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secret-notes">Notes (optional)</Label>
              <Textarea
                id="secret-notes"
                placeholder="Any context about this secret..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={2}
                data-testid="textarea-secret-notes"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!nameInput.trim() || createMutation.isPending}
              data-testid="button-secrets-submit"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Ticket
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Tickets table */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Rotation Tickets</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-lg font-medium">No secrets to rotate</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Import from Scans" to auto-detect hardcoded secrets from your scan findings,
              or "Add Ticket" to create one manually.
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]" />
                  <TableHead>Secret</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const isExpanded = expandedId === ticket.id;
                  const done = completedStepCount(ticket);
                  return (
                    <>
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm max-w-[250px] truncate" title={ticket.secretName}>
                            {ticket.secretName}
                          </div>
                          {ticket.location && (
                            <div className="text-xs text-muted-foreground font-mono truncate max-w-[250px]">
                              {ticket.location}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {SECRET_TYPES.find((t) => t.value === ticket.secretType)?.label ?? ticket.secretType}
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={ticket.severity} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={ticket.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(done / 6) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{done}/6</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(ticket.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(ticket.id);
                            }}
                            disabled={deleteMutation.isPending}
                            aria-label={`Delete ${ticket.secretName}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${ticket.id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="p-4 space-y-4">
                              {/* Rotation checklist */}
                              <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                  Rotation Checklist
                                </h3>
                                <div className="space-y-2">
                                  {ROTATION_STEPS.map((step) => (
                                    <label
                                      key={step.key}
                                      className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded-md"
                                    >
                                      <Checkbox
                                        checked={ticket[step.key]}
                                        onCheckedChange={(checked) =>
                                          handleStepToggle(ticket, step.key, !!checked)
                                        }
                                        disabled={updateMutation.isPending}
                                      />
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                        {step.icon}
                                      </span>
                                      <span className={ticket[step.key] ? "line-through text-muted-foreground" : ""}>
                                        {step.label}
                                      </span>
                                      {ticket[step.key] && (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                                      )}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Controls row */}
                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Status</Label>
                                  <Select
                                    value={ticket.status}
                                    onValueChange={(v) => handleStatusChange(ticket, v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="open">Open</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="rotated">Rotated</SelectItem>
                                      <SelectItem value="verified">Verified</SelectItem>
                                      <SelectItem value="dismissed">Dismissed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Secrets Manager</Label>
                                  <Select
                                    value={ticket.secretsManager ?? ""}
                                    onValueChange={(v) => handleManagerChange(ticket, v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Choose…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SECRETS_MANAGERS.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>
                                          {m.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Linked Finding</Label>
                                  <div className="text-xs text-muted-foreground pt-1">
                                    {ticket.findingId ? (
                                      <span className="font-mono">{ticket.findingId.slice(0, 12)}…</span>
                                    ) : (
                                      "Manual ticket"
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Notes */}
                              {ticket.notes && (
                                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                                  <strong>Notes:</strong> {ticket.notes}
                                </div>
                              )}

                              {/* Timestamps */}
                              <div className="flex gap-6 text-xs text-muted-foreground">
                                {ticket.rotatedAt && <span>Rotated: {fmtDate(ticket.rotatedAt)}</span>}
                                {ticket.verifiedAt && <span>Verified: {fmtDate(ticket.verifiedAt)}</span>}
                              </div>

                              {/* Guidance */}
                              {ticket.status === "open" && (
                                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-md text-sm">
                                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                  <div>
                                    <strong>This secret needs rotation.</strong> Follow the 6-step checklist
                                    above. Start by removing the hardcoded value from your source code and
                                    replacing it with an environment variable or secrets manager reference.
                                  </div>
                                </div>
                              )}
                              {ticket.status === "verified" && (
                                <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 p-3 rounded-md text-sm">
                                  <ShieldCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                  <div>
                                    <strong>Rotation complete and verified.</strong> The old secret has been
                                    revoked and the application is running with the new credential.
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
