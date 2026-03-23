import { Card } from "@/components/ui/card";
import { Shield, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SecurityHealthScoreProps {
  score: number; // 0-100
  trend?: { value: number; direction: "up" | "down" | "neutral" };
  onClick?: () => void;
  totalFindings?: number;
  resolvedCount?: number;
  inProgressCount?: number;
  openCount?: number;
}

export function SecurityHealthScore({ 
  score, 
  trend, 
  onClick,
  totalFindings = 0,
  resolvedCount = 0,
  inProgressCount = 0,
  openCount = 0
}: SecurityHealthScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Card 
      className={`p-6 shadow-sm ${onClick ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
      onClick={onClick}
      data-testid="card-security-health-score"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground">
              Security Health Score
            </h3>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score}
              </span>
              <span className="text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend.direction === "up" ? "text-green-500" : "text-red-500"
            }`}
          >
            <TrendingUp
              className={`w-4 h-4 ${
                trend.direction === "down" ? "rotate-180" : ""
              }`}
            />
            {trend.value}%
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${getProgressColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`font-medium ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </span>
          <span className="text-muted-foreground">
            Based on {totalFindings} finding{totalFindings !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 grid grid-cols-3 gap-4 text-center">
        <div className="col-span-3 h-[1px] w-full bg-border -mt-4 mb-4" />
        <div>
          <div className="text-2xl font-bold text-green-500">{resolvedCount}</div>
          <div className="text-xs text-muted-foreground">Resolved</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-500">{inProgressCount}</div>
          <div className="text-xs text-muted-foreground">In Progress</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-500">{openCount}</div>
          <div className="text-xs text-muted-foreground">Open</div>
        </div>
      </div>
    </Card>
  );
}
