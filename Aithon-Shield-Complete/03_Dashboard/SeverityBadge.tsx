import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, AlertTriangle, Info } from "lucide-react";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface SeverityBadgeProps {
  severity: Severity;
  showIcon?: boolean;
}

const severityConfig = {
  CRITICAL: {
    color: "bg-severity-critical/10 text-severity-critical border-severity-critical/20",
    icon: ShieldAlert,
  },
  HIGH: {
    color: "bg-severity-high/10 text-severity-high border-severity-high/20",
    icon: AlertTriangle,
  },
  MEDIUM: {
    color: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
    icon: AlertTriangle,
  },
  LOW: {
    color: "bg-severity-low/10 text-severity-low border-severity-low/20",
    icon: Info,
  },
};

export function SeverityBadge({ severity, showIcon = true }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Badge
      className={`${config.color} font-semibold uppercase text-xs tracking-wide border`}
      data-testid={`badge-severity-${severity.toLowerCase()}`}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {severity}
    </Badge>
  );
}
