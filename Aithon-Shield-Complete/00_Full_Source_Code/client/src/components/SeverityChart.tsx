import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Finding } from "@shared/schema";

export function SeverityChart() {
  const { data: allFindings = [] } = useQuery<Finding[]>({
    queryKey: ["/api/findings"],
  });

  // If no findings, show empty state
  if (allFindings.length === 0) {
    return (
      <Card className="p-6 shadow-sm" data-testid="card-severity-chart">
        <h3 className="font-semibold text-base mb-4">Findings Trend</h3>
        <div className="flex flex-col items-center justify-center h-[300px] text-center">
          <TrendingDown className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground mb-1">No findings data yet</p>
          <p className="text-xs text-muted-foreground">
            Run your first security scan to see trends
          </p>
        </div>
      </Card>
    );
  }

  // Calculate weekly trends from actual findings data
  const now = new Date();
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekFindings = allFindings.filter(f => {
      const detectedDate = new Date(f.detected);
      return detectedDate >= weekStart && detectedDate < weekEnd;
    });

    return {
      name: `Week ${4 - i}`,
      critical: weekFindings.filter(f => f.severity === "CRITICAL").length,
      high: weekFindings.filter(f => f.severity === "HIGH").length,
      medium: weekFindings.filter(f => f.severity === "MEDIUM").length,
      low: weekFindings.filter(f => f.severity === "LOW").length,
    };
  }).reverse();

  return (
    <Card className="p-6 shadow-sm" data-testid="card-severity-chart">
      <h3 className="font-semibold text-base mb-4">Findings Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={weeks}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.375rem",
            }}
          />
          <Bar dataKey="critical" fill="hsl(0 85% 60%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="high" fill="hsl(25 90% 55%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="medium" fill="hsl(45 85% 60%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="low" fill="hsl(220 20% 65%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
