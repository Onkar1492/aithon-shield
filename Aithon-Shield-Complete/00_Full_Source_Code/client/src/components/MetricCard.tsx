import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "danger" | "cyan";
  onClick?: () => void;
}

export function MetricCard({ title, value, trend, icon: Icon, iconColor = "primary", onClick }: MetricCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    danger: "bg-red-500/10 text-red-500",
    cyan: "bg-cyan-500/10 text-cyan-500"
  };

  const glowColors = {
    primary: "group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    success: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    warning: "group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    danger: "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    cyan: "group-hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
  };

  return (
    <Card 
      className={`group relative overflow-hidden p-6 transition-all duration-300 ${glowColors[iconColor]} ${onClick ? 'cursor-pointer hover-elevate active-elevate-2 hover:scale-[1.02]' : ''}`}
      onClick={onClick}
      data-testid={`card-metric-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-label text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold tabular-nums tracking-tight animate-count-up">{value}</p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-3">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                trend.direction === "up" 
                  ? "bg-red-500/10 text-red-500" 
                  : "bg-emerald-500/10 text-emerald-500"
              }`}>
                {trend.direction === "up" ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>{trend.value}%</span>
              </div>
              <span className="text-xs text-muted-foreground">vs last week</span>
            </div>
          )}
        </div>
        <div className={`flex-shrink-0 h-14 w-14 rounded-xl ${colorClasses[iconColor]} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </Card>
  );
}
