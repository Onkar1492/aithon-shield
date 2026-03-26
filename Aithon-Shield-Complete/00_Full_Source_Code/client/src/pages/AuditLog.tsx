import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Shield, User, Settings, FileText, AlertTriangle, Database, Download, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type AuditEventRow = {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type AuditListResponse = { events: AuditEventRow[]; limit: number; offset: number };

const getIconForAction = (action: string) => {
  if (action.startsWith("auth.")) return <User className="h-4 w-4" />;
  if (action.includes("scan")) return <Shield className="h-4 w-4" />;
  if (action.startsWith("api_key.")) return <Settings className="h-4 w-4" />;
  if (action.startsWith("user.")) return <Settings className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
};

const badgeVariantForAction = (action: string): "default" | "secondary" | "destructive" | "outline" => {
  if (action.includes("delete")) return "destructive";
  if (action.startsWith("auth.")) return "secondary";
  return "outline";
};

export default function AuditLog() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useQuery<AuditListResponse>({
    queryKey: ["/api/audit-events"],
  });

  const filtered = useMemo(() => {
    const events = data?.events ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.resourceType.toLowerCase().includes(q) ||
        (e.resourceId && e.resourceId.toLowerCase().includes(q)),
    );
  }, [data?.events, search]);

  const downloadCsv = async () => {
    try {
      const res = await fetch("/api/audit-events/export.csv", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aithon-audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export started", description: "Your audit log CSV download should begin shortly." });
    } catch {
      toast({ title: "Export failed", description: "Could not download CSV. Try again while signed in.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Immutable history of security-relevant actions on your account (append-only).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => void downloadCsv()}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action, resource type, or ID…"
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-logs"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audit events…
        </div>
      )}

      {isError && (
        <Card className="p-6 border-destructive/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Could not load audit log</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as Error)?.message ?? "Sign in and ensure the database migration has been applied."}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {!isLoading && !isError && filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {data?.events?.length === 0 ? "No Audit Events Yet" : "No Matching Events"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {data?.events?.length === 0
                ? "Events appear when you sign in, change settings, create scans, or use API keys."
                : "Try a different search term."}
            </p>
          </Card>
        ) : (
          filtered.map((log) => (
            <Card key={log.id} className="p-4 hover-elevate shadow-sm" data-testid={`log-${log.id}`}>
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 ${
                    log.action.includes("delete") ? "bg-red-500/10" : ""
                  }`}
                >
                  <div className={log.action.includes("delete") ? "text-red-500" : "text-primary"}>
                    {getIconForAction(log.action)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-mono text-sm font-semibold">{log.action}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {log.resourceType}
                        {log.resourceId ? ` · ${log.resourceId}` : ""}
                        {log.ipAddress ? ` · IP ${log.ipAddress}` : ""}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="text-xs mt-2 p-2 rounded-md bg-muted/50 overflow-x-auto max-h-24">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                    <Badge variant={badgeVariantForAction(log.action)}>{log.resourceType}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
