import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MvpCodeScan, ScheduledScan } from "@shared/schema";
import { parseScheduledScanConfig, type ScheduledRunLastSummary } from "@shared/scheduledScanUtils";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

function fmtTs(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "—";
    return format(dt, "MMM d, yyyy HH:mm");
  } catch {
    return "—";
  }
}

function parseSummary(raw: string | null | undefined): ScheduledRunLastSummary | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.skipped === true || j.error != null) return null;
    if (typeof j.findingsCount !== "number") return null;
    return j as unknown as ScheduledRunLastSummary;
  } catch {
    return null;
  }
}

function driftLine(s: ScheduledRunLastSummary | null): string {
  if (!s?.driftFromPrevious) return "—";
  const d = s.driftFromPrevious;
  const parts: string[] = [];
  if (d.findingsDelta !== 0) parts.push(`Δ findings ${d.findingsDelta >= 0 ? "+" : ""}${d.findingsDelta}`);
  if (d.criticalDelta !== 0) parts.push(`CRIT ${d.criticalDelta >= 0 ? "+" : ""}${d.criticalDelta}`);
  if (d.highDelta !== 0) parts.push(`HIGH ${d.highDelta >= 0 ? "+" : ""}${d.highDelta}`);
  return parts.length ? parts.join(" · ") : "No change";
}

export default function ScheduledScansPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [cronExpression, setCronExpression] = useState("");
  const [targetScanId, setTargetScanId] = useState("");

  const { data: schedules = [], isPending } = useQuery<ScheduledScan[]>({
    queryKey: ["/api/scheduled-scans"],
  });

  const { data: mvpScans = [], isPending: mvpPending } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scheduled-scans", {
        name: name.trim() || "Scheduled MVP scan",
        scanType: "mvp",
        scanConfig: JSON.stringify({ targetScanId, scanType: "mvp" }),
        frequency,
        cronExpression: frequency === "custom" ? cronExpression.trim() || null : null,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-scans"] });
      setCreateOpen(false);
      setName("");
      setFrequency("daily");
      setCronExpression("");
      setTargetScanId("");
      toast({ title: "Schedule created" });
    },
    onError: (e: Error) => toast({ title: "Could not create schedule", description: e.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<ScheduledScan> }) => {
      await apiRequest("PATCH", `/api/scheduled-scans/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-scans"] });
      toast({ title: "Saved" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scheduled-scans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-scans"] });
      setDeleteId(null);
      toast({ title: "Schedule removed" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-8 w-8 text-primary" aria-hidden />
            Scheduled scans
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
            Run MVP code scans on a recurring cadence. The server compares each run to the previous one and stores
            drift deltas on the schedule record.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={mvpPending || mvpScans.length === 0}
          data-testid="button-new-scheduled-scan"
        >
          <Plus className="h-4 w-4 mr-2" />
          New schedule
        </Button>
      </div>

      {mvpScans.length === 0 && !mvpPending && (
        <Card>
          <CardHeader>
            <CardTitle>No MVP scans yet</CardTitle>
            <CardDescription>Create an MVP code scan first, then you can attach a schedule to it.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your schedules</CardTitle>
          <CardDescription>
            Web and mobile targets are accepted in the API but not executed by the scheduler yet (skipped with a note
            in the last-run summary).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled scans. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Drift</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((row) => {
                  const cfg = parseScheduledScanConfig(row.scanConfig);
                  const mvp = cfg ? mvpScans.find((m) => m.id === cfg.targetScanId) : undefined;
                  const summary = parseSummary(row.lastRunSummaryJson);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {mvp?.projectName ?? cfg?.targetScanId ?? "—"}
                      </TableCell>
                      <TableCell className="capitalize">{row.frequency}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtTs(row.nextRunAt)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtTs(row.lastRunAt)}</TableCell>
                      <TableCell className="text-sm">{driftLine(summary)}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={row.isActive}
                          onCheckedChange={(v) => patchMutation.mutate({ id: row.id, body: { isActive: v } })}
                          aria-label={`Active ${row.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New scheduled scan</DialogTitle>
            <DialogDescription>
              Pick an MVP scan and how often to re-run it. The first run is scheduled about one minute after you save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sched-name">Name</Label>
              <Input
                id="sched-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nightly main branch"
              />
            </div>
            <div className="space-y-2">
              <Label>MVP scan</Label>
              <Select value={targetScanId} onValueChange={setTargetScanId}>
                <SelectTrigger aria-label="Target MVP scan">
                  <SelectValue placeholder="Select scan" />
                </SelectTrigger>
                <SelectContent>
                  {mvpScans.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.projectName || m.repositoryUrl || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom (daily cadence placeholder)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {frequency === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="sched-cron">Cron expression (optional)</Label>
                <Input
                  id="sched-cron"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="Not fully parsed yet — treated as daily"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!targetScanId || createMutation.isPending}
              data-testid="button-submit-schedule"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops future runs. It does not delete the MVP scan or its findings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
