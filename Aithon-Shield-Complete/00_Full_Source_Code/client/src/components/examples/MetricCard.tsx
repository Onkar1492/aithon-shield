import { MetricCard } from "../MetricCard";
import { Shield, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export default function MetricCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-background">
      <MetricCard
        title="Open Findings"
        value={127}
        trend={{ value: 12, direction: "up" }}
        icon={Shield}
      />
      <MetricCard
        title="Critical Issues"
        value={8}
        trend={{ value: 3, direction: "down" }}
        icon={AlertTriangle}
      />
      <MetricCard
        title="Avg MTTR"
        value="3.2d"
        icon={Clock}
      />
      <MetricCard
        title="Scan Success"
        value="96%"
        trend={{ value: 4, direction: "up" }}
        icon={CheckCircle}
      />
    </div>
  );
}
