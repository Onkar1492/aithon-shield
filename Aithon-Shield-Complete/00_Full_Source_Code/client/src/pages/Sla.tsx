import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Timer, AlertTriangle, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";
import type { SlaFindingEvaluation } from "@shared/slaPolicy";

type SlaSummary = {
  policyHours: Record<string, number>;
  breaches: SlaFindingEvaluation[];
  upcoming: SlaFindingEvaluation[];
  openFindingsConsidered: number;
};

function fmt(iso: string) {
  try {
    return format(parseISO(iso), "MMM d, yyyy HH:mm");
  } catch {
    return iso;
  }
}

function severityBadge(sev: string) {
  const s = sev.toLowerCase();
  if (s === "critical") return <Badge variant="destructive">Critical</Badge>;
  if (s === "high") return <Badge className="bg-orange-600 hover:bg-orange-600">High</Badge>;
  if (s === "medium") return <Badge variant="secondary">Medium</Badge>;
  return <Badge variant="outline">Low</Badge>;
}

function scanDetailsPath(scanType: string | null, scanId: string | null): string | null {
  if (!scanType || !scanId) return null;
  return `/scan-details/${encodeURIComponent(scanType)}/${encodeURIComponent(scanId)}`;
}

export default function SlaPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<SlaSummary>({
    queryKey: ["/api/sla/summary"],
  });

  const hasPolicy = data && Object.keys(data.policyHours ?? {}).length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Timer className="h-8 w-8 text-primary" aria-hidden />
            SLA enforcement
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-3xl">
            Compare open findings to your remediation targets (hours from first seen). Breaches are past due;
            at-risk items are in the last 25% of the window. Configure targets in{" "}
            <Link href="/settings" className="text-primary underline underline-offset-2">
              Settings
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-sla-refresh">
          Refresh
        </Button>
      </div>

      {!hasPolicy && !isLoading && (
        <Card className="p-4 border-dashed">
          <p className="text-sm text-muted-foreground">
            No SLA hours configured yet. Set <strong>Critical / High / Medium / Low</strong> targets in{" "}
            <Link href="/settings" className="text-primary underline">
              Settings → SLA targets
            </Link>{" "}
            (aligned with <code className="text-xs bg-muted px-1 rounded">.aithonshield.yml</code>{" "}
            <code className="text-xs bg-muted px-1">policy.sla</code>).
          </p>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading SLA summary…</p>
      ) : isError ? (
        <Card className="p-4 border-destructive/50">
          <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load"}</p>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Breaches</p>
              <p className="text-3xl font-semibold text-destructive">{data.breaches.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">On track / at risk</p>
              <p className="text-3xl font-semibold">{data.upcoming.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Open findings</p>
              <p className="text-3xl font-semibold tabular-nums">{data.openFindingsConsidered}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-semibold">Breaches (past due)</h2>
            </div>
            {data.breaches.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No SLA breaches for configured severities.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Finding</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Overdue (h)</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.breaches.map((r) => (
                    <TableRow key={r.findingId}>
                      <TableCell>{severityBadge(r.severity)}</TableCell>
                      <TableCell className="max-w-md truncate font-medium" title={r.title}>
                        {r.title}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmt(r.dueAt)}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.overdueHours != null ? r.overdueHours.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell>
                        {scanDetailsPath(r.scanType, r.scanId) ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={scanDetailsPath(r.scanType, r.scanId)!}>
                              Scan <ExternalLink className="h-3 w-3 ml-1 inline" />
                            </a>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" asChild>
                            <a href="/findings">Findings</a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Upcoming deadlines</h2>
              <p className="text-xs text-muted-foreground">Soonest due first (within SLA window).</p>
            </div>
            {data.upcoming.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No tracked open findings with SLA, or none upcoming.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Finding</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcoming.map((r) => (
                    <TableRow key={r.findingId}>
                      <TableCell>{severityBadge(r.severity)}</TableCell>
                      <TableCell className="max-w-md truncate" title={r.title}>
                        {r.title}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(r.dueAt)}</TableCell>
                      <TableCell>
                        {r.status === "at_risk" ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                            At risk
                          </Badge>
                        ) : (
                          <Badge variant="secondary">On track</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
