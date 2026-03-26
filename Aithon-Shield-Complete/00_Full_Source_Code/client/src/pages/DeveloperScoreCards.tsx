import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, AlertTriangle, CheckCircle2, Scale, RefreshCw } from "lucide-react";
import type { DeveloperScoreCardRow } from "@shared/developerScoreCards";
import { useLocation } from "wouter";

type ScoreCardsPayload = {
  generatedAt: string;
  cards: DeveloperScoreCardRow[];
};

function gradeColor(grade: DeveloperScoreCardRow["grade"]): string {
  switch (grade) {
    case "A":
      return "bg-emerald-500/15 text-emerald-600 border-emerald-500/40";
    case "B":
      return "bg-blue-500/15 text-blue-600 border-blue-500/40";
    case "C":
      return "bg-amber-500/15 text-amber-700 border-amber-500/40";
    case "D":
      return "bg-orange-500/15 text-orange-600 border-orange-500/40";
    default:
      return "bg-destructive/15 text-destructive border-destructive/40";
  }
}

function scanPath(scanType: string, scanId: string): string {
  if (scanType === "mvp") return `/mvp-scans/${scanId}`;
  if (scanType === "mobile") return `/mobile-scans/${scanId}`;
  if (scanType === "web") return `/web-scans/${scanId}`;
  return "/findings";
}

export default function DeveloperScoreCards() {
  const [, setLocation] = useLocation();
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<ScoreCardsPayload>({
    queryKey: ["/api/developer-score-cards"],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Developer score cards</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Per-project security engagement scores from open vs resolved findings (MVP, mobile, and web scans)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-score-cards">
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="p-4 border-border/60 bg-muted/30">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Each card groups findings by scan (project). The score blends <strong>resolution progress</strong> with penalties for{" "}
          <strong>open critical and high</strong> issues. Accepted-risk items are excluded from open counts. Grades: A (90+), B (80+), C (70+), D (60+), F (&lt;60).
        </p>
      </Card>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="p-6 border-destructive/40">
          <p className="text-sm text-destructive font-medium">Could not load score cards</p>
          <p className="text-xs text-muted-foreground mt-1">{error instanceof Error ? error.message : String(error)}</p>
        </Card>
      )}

      {!isPending && !isError && data && data.cards.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <Award className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No project-level findings yet. Run an MVP, mobile, or web scan to see score cards here.</p>
        </Card>
      )}

      {!isPending && !isError && data && data.cards.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Generated {new Date(data.generatedAt).toLocaleString()} · {data.cards.length} project{data.cards.length === 1 ? "" : "s"} (lowest score first)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="grid-score-cards">
            {data.cards.map((c) => (
              <Card key={c.projectKey} className="p-5 shadow-sm border-border/60 hover-elevate flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-base leading-tight truncate" title={c.projectName}>
                      {c.projectName}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {c.scanType} scan · {c.totalFindings} finding{c.totalFindings === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-2xl font-bold tabular-nums" data-testid={`score-value-${c.projectKey}`}>
                      {c.score}
                    </span>
                    <Badge variant="outline" className={`text-xs font-bold ${gradeColor(c.grade)}`}>
                      {c.grade}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Open: {c.openFindings}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Resolved: {c.resolvedFindings}</span>
                  </div>
                  {c.acceptedRiskFindings > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <Scale className="w-3.5 h-3.5" />
                      <span>Accepted risk: {c.acceptedRiskFindings}</span>
                    </div>
                  )}
                </div>

                {(c.criticalOpen > 0 || c.highOpen > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.criticalOpen > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {c.criticalOpen} critical open
                      </Badge>
                    )}
                    {c.highOpen > 0 && (
                      <Badge className="text-xs bg-orange-500/15 text-orange-600 border-orange-500/35">
                        {c.highOpen} high open
                      </Badge>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                  Resolution rate: {(c.resolutionRate * 100).toFixed(0)}% · Open severities: C{c.criticalOpen} H{c.highOpen} M{c.mediumOpen} L{c.lowOpen}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-auto"
                  data-testid={`link-open-scan-${c.projectKey}`}
                  onClick={() => setLocation(scanPath(c.scanType, c.scanId))}
                >
                  Open scan
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
