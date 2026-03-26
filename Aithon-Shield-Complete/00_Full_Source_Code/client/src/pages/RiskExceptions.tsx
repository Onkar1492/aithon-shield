import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RiskException } from "@shared/schema";
import { Loader2, Undo2, Scale, ArrowRight, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";

type Row = RiskException & { findingTitle: string; findingSeverity: string };

function fmtDate(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  try {
    const d = typeof iso === "string" ? parseISO(iso) : iso;
    if (Number.isNaN(d.getTime())) return String(iso);
    return format(d, "MMM d, yyyy HH:mm");
  } catch {
    return String(iso);
  }
}

export default function RiskExceptionsPage() {
  const { toast } = useToast();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ exceptions: Row[] }>({
    queryKey: ["/api/risk-exceptions"],
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/risk-exceptions/${id}/revoke`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk-exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sla/summary"] });
      toast({ title: "Exception revoked" });
    },
    onError: (e: Error) => {
      toast({ title: "Revoke failed", description: e.message, variant: "destructive" });
    },
  });

  const rows = data?.exceptions ?? [];
  const active = rows.filter((r) => r.status === "active");
  const history = rows.filter((r) => r.status !== "active");
  const isEmpty = !isLoading && !isError && active.length === 0 && history.length === 0;

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary shrink-0" aria-hidden />
            Risk exceptions
          </h1>
          <p className="text-muted-foreground mt-1 leading-relaxed max-w-3xl text-sm md:text-base">
            Accepted risks are documented with justification. Active exceptions are excluded from SLA breach lists.
            Revoke to return the finding to open remediation. To <strong>create</strong> an exception, use{" "}
            <strong>Findings</strong> → <strong>More</strong> (⋮) → <strong>Accept risk</strong>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="shrink-0"
          data-testid="button-risk-exceptions-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <span>Loading exceptions…</span>
          </div>
        </Card>
      ) : isError ? (
        <Alert variant="destructive" className="max-w-3xl">
          <AlertTitle>Could not load risk exceptions</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error instanceof Error ? error.message : "Request failed"}</p>
            <p className="text-sm opacity-90">
              If you recently updated the app, restart the dev server so new API routes are registered, then reload
              this page. The browser URL port must match the server (see <code className="text-xs bg-background/50 px-1 rounded">GET /api/health</code> — default dev port is 5001 unless PORT is set).
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()} className="mt-1">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
      <Card className="p-6">
        {isEmpty ? (
          <div className="py-8 px-2 text-center space-y-6 max-w-lg mx-auto">
            <div className="rounded-full bg-muted w-16 h-16 mx-auto flex items-center justify-center">
              <Scale className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">No risk exceptions yet</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Exceptions are created from the Findings list, not on this page. Open a finding, use the menu{" "}
                <strong>More</strong> → <strong>Accept risk</strong>, enter a justification, and submit. This page will
                list active and past exceptions here.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <Button asChild data-testid="button-risk-exceptions-go-findings">
                <Link href="/findings" className="inline-flex items-center justify-center gap-2">
                  Go to Findings
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/sla">View SLA</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/settings">Settings</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Security onboarding (if not completed) opens automatically after sign-in and links here from the
              governance step.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-medium mb-4">Active</h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No active risk exceptions.</p>
            ) : (
              <div className="rounded-md border" data-testid="table-risk-exceptions-active">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Justification</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium max-w-[220px]">{r.findingTitle}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.findingSeverity}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md whitespace-pre-wrap">
                          {r.justification}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {r.expiresAt ? fmtDate(r.expiresAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeMutation.mutate(r.id)}
                            disabled={revokeMutation.isPending}
                            data-testid={`button-revoke-exception-${r.id}`}
                          >
                            <Undo2 className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <h2 className="text-lg font-medium mt-10 mb-4">History</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No past exceptions.</p>
            ) : (
              <div className="rounded-md border" data-testid="table-risk-exceptions-history">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Justification</TableHead>
                      <TableHead>Ended</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium max-w-[220px]">{r.findingTitle}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md whitespace-pre-wrap">
                          {r.justification}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {r.revokedAt ? fmtDate(r.revokedAt) : fmtDate(r.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </Card>
      )}
    </div>
  );
}
