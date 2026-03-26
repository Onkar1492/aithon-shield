import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import type { CveWatchlistEntry } from "@shared/schema";
import { normalizeCveId } from "@shared/cveWatchlistUtils";
import { Loader2, Radar, Trash2, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtDate(iso: string | Date): string {
  try {
    const d = typeof iso === "string" ? parseISO(iso) : iso;
    if (Number.isNaN(d.getTime())) return String(iso);
    return format(d, "MMM d, yyyy HH:mm");
  } catch {
    return String(iso);
  }
}

export default function CveWatchlistPage() {
  const { toast } = useToast();
  const [cveInput, setCveInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const { data, isLoading } = useQuery<{ entries: CveWatchlistEntry[] }>({
    queryKey: ["/api/cve-watchlist"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeCveId(cveInput.trim());
      if (!normalized) {
        throw new Error(
          "Invalid CVE ID. Use the form CVE-YYYY-NNNN (for example CVE-2024-12345), not a date or other text.",
        );
      }
      const res = await apiRequest("POST", "/api/cve-watchlist", {
        cveId: normalized,
        note: noteInput.trim() || null,
      });
      return res.json() as Promise<CveWatchlistEntry>;
    },
    onSuccess: () => {
      setCveInput("");
      setNoteInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/cve-watchlist"] });
      toast({ title: "CVE added to watchlist" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not add CVE", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cve-watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cve-watchlist"] });
      toast({ title: "Removed from watchlist" });
    },
    onError: (e: Error) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/cve-watchlist/${id}`, { enabled });
      return res.json() as Promise<CveWatchlistEntry>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cve-watchlist"] });
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const rescanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cve-watchlist/rescan-findings", {});
      return res.json() as Promise<{ processed: number; newAlerts: number }>;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Rescan complete",
        description: `Checked ${r.processed} ${r.processed === 1 ? "finding" : "findings"}; ${r.newAlerts} new ${r.newAlerts === 1 ? "alert" : "alerts"}.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Rescan failed", description: e.message, variant: "destructive" });
    },
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-8 w-8 text-primary" aria-hidden />
            CVE watchlist
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
            Add CVE IDs you care about. When a scan produces a finding whose title or description matches a watched
            CVE, you get an in-app notification (and an optional push alert from Settings). This does not call
            external NVD APIs in the background—matching happens when findings are created or when you rescan.
          </p>
        </div>
      </div>

      <Card className="p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Add a CVE</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cve-id">CVE ID</Label>
            <Input
              id="cve-id"
              placeholder="CVE-2024-12345 (not a date or timestamp)"
              value={cveInput}
              onChange={(e) => setCveInput(e.target.value)}
              data-testid="input-cve-watchlist-id"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="cve-note">Note (optional)</Label>
            <Textarea
              id="cve-note"
              placeholder="Why this CVE matters to your team"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={2}
              data-testid="textarea-cve-watchlist-note"
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => addMutation.mutate()}
          disabled={!cveInput.trim() || addMutation.isPending}
          data-testid="button-cve-watchlist-add"
        >
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Add to watchlist
        </Button>
      </Card>

      <Card className="p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Watched CVEs</h2>
            <p className="text-sm text-muted-foreground">
              Toggle alerts on or off per entry. Remove entries you no longer need.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => rescanMutation.mutate()}
            disabled={rescanMutation.isPending}
            data-testid="button-cve-watchlist-rescan"
          >
            {rescanMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Scan existing findings
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No CVEs on your watchlist yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CVE</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-[100px]">Alerts</TableHead>
                  <TableHead className="w-[180px]">Added</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.cveId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={row.note ?? ""}>
                      {row.note || "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: row.id, enabled: checked })}
                        disabled={toggleMutation.isPending}
                        aria-label={`Toggle alerts for ${row.cveId}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(row.id)}
                        disabled={deleteMutation.isPending}
                        aria-label={`Remove ${row.cveId}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
