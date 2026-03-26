import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SecurityHealthSummary } from "@shared/securityHealthMetrics";
import { Activity, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtMttrHours(h: number | null): string {
  if (h === null || Number.isNaN(h)) return "—";
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function safeChartLabel(isoDate: string): string {
  try {
    const d = parseISO(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return format(d, "MMM d");
  } catch {
    return isoDate;
  }
}

export default function SecurityHealth() {
  const [days, setDays] = useState(30);
  const { data, isPending, isError, error, refetch, isSuccess } = useQuery<SecurityHealthSummary>({
    queryKey: ["/api/security-health", days],
    queryFn: async () => {
      const res = await fetch(`/api/security-health?days=${days}`, { credentials: "include" });
      const ct = res.headers.get("content-type") ?? "";
      const raw = await res.text();
      if (!res.ok) {
        const msg =
          ct.includes("application/json") && raw.trim().startsWith("{")
            ? (JSON.parse(raw) as { message?: string }).message ?? raw
            : raw.slice(0, 280) || res.statusText;
        throw new Error(msg);
      }
      if (!ct.includes("application/json")) {
        throw new Error(
          `Expected JSON from /api/security-health; got ${ct || "unknown"}. Restart the dev server after pulling the latest server code.`,
        );
      }
      return JSON.parse(raw) as SecurityHealthSummary;
    },
  });

  /** Must use `timeline?.map` — `data?.timeline.map` throws when timeline is undefined. */
  const chartData =
    data?.timeline?.map((p) => ({
      ...p,
      label: safeChartLabel(p.date),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Security health</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Timeline, mean time to remediate (MTTR), and regression signals for your findings
          </p>
        </div>
        <div className="w-full sm:w-[200px]">
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(parseInt(v, 10))}
          >
            <SelectTrigger aria-label="Chart window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending && (
        <p className="text-sm text-foreground">Loading security metrics…</p>
      )}

      {isError && (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Could not load security metrics</p>
          <p className="text-xs text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      )}

      {isSuccess && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                <TrendingUp className="h-4 w-4" />
                Health score
              </div>
              <p className="text-3xl font-bold mt-2 tabular-nums text-primary">
                {data.currentHealthScore}
                <span className="text-lg font-normal text-muted-foreground">/100</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.openFindings} open · {data.resolvedFindings} resolved
              </p>
            </Card>
            <Card className="p-4 border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                <Clock className="h-4 w-4" />
                MTTR (overall)
              </div>
              <p className="text-2xl font-semibold mt-2 tabular-nums">
                {fmtMttrHours(data.mttrHours.overall)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.mttrHours.sampleSize} finding{data.mttrHours.sampleSize !== 1 ? "s" : ""} with
                resolution time
              </p>
            </Card>
            <Card className="p-4 border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                <AlertTriangle className="h-4 w-4" />
                Regressions
              </div>
              <p className="text-3xl font-bold mt-2 tabular-nums">
                {data.regressionCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Open duplicate of a resolved issue (same scan + CWE + title)
              </p>
            </Card>
            <Card className="p-4 border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                <Activity className="h-4 w-4" />
                Window
              </div>
              <p className="text-2xl font-semibold mt-2">{data.windowDays} days</p>
              <p className="text-xs text-muted-foreground mt-1">UTC day buckets</p>
            </Card>
          </div>

          <Card className="p-6 shadow-sm">
            <h2 className="font-semibold text-base mb-4">Activity &amp; health trend</h2>
            <p className="text-xs text-muted-foreground mb-4">
              New vs resolved findings per day; line uses the same health formula as the dashboard,
              evaluated at each day end (UTC).
            </p>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.375rem",
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="newFindings"
                    name="New findings"
                    fill="hsl(215 85% 45%)"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={24}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="resolvedFindings"
                    name="Resolved"
                    fill="hsl(160 75% 38%)"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={24}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="healthScore"
                    name="Health score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h2 className="font-semibold text-base mb-4">MTTR by severity</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Average hours from finding creation to <code className="text-xs">resolvedAt</code> when
              set. Legacy rows without a timestamp are excluded.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              {(
                [
                  ["Critical", data.mttrHours.critical],
                  ["High", data.mttrHours.high],
                  ["Medium", data.mttrHours.medium],
                  ["Low", data.mttrHours.low],
                  ["Overall", data.mttrHours.overall],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="rounded-lg border border-border p-3">
                  <div className="text-muted-foreground text-xs">{label}</div>
                  <div className="text-lg font-semibold tabular-nums mt-1">{fmtMttrHours(val)}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
