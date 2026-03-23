import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "./SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RotateCw, Sparkles, Shield, Bug, AlertTriangle, CheckCircle2 } from "lucide-react";
import { isFindingResolved } from "@/lib/findings";
import { ReuploadReminder } from "./ReuploadReminder";

interface FindingCardProps {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cwe: string;
  owasp: string[];
  affectedAsset: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  detectedDate: string;
  riskScore?: number;
  aiRemediation?: boolean;
  scanName?: string;
  fixesApplied?: boolean;
  onRemediation?: () => void;
  onRescan?: () => void;
}

export function FindingCard({
  id,
  title,
  severity,
  cwe,
  owasp,
  affectedAsset,
  status,
  detectedDate,
  riskScore = 8.5,
  aiRemediation = true,
  scanName,
  fixesApplied = false,
  onRemediation,
  onRescan,
}: FindingCardProps) {
  const isResolved = isFindingResolved({ fixesApplied, status });
  
  const severityConfig = {
    CRITICAL: { color: "hsl(0 85% 60%)", bgClass: "bg-red-500/5", icon: AlertTriangle, iconClass: "text-red-500" },
    HIGH: { color: "hsl(25 90% 55%)", bgClass: "bg-orange-500/5", icon: Bug, iconClass: "text-orange-500" },
    MEDIUM: { color: "hsl(45 85% 60%)", bgClass: "bg-amber-500/5", icon: Shield, iconClass: "text-amber-500" },
    LOW: { color: "hsl(220 20% 65%)", bgClass: "bg-blue-500/5", icon: Shield, iconClass: "text-blue-500" }
  };

  const config = severityConfig[severity];
  const SeverityIcon = config.icon;

  return (
    <Card
      className={`group relative overflow-hidden p-6 hover-elevate border-l-4 shadow-sm transition-all duration-300 hover:shadow-md ${isResolved ? 'bg-emerald-500/5' : config.bgClass}`}
      style={{ borderLeftColor: isResolved ? "hsl(160 75% 45%)" : config.color }}
      data-testid={`card-finding-${id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-shrink-0 hidden sm:flex">
          <div className={`p-2.5 rounded-xl ${isResolved ? 'bg-emerald-500/10' : config.bgClass} transition-transform duration-300 group-hover:scale-110`}>
            {isResolved ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <SeverityIcon className={`w-6 h-6 ${config.iconClass}`} />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SeverityBadge severity={severity} />
            <Badge variant="outline" className="font-mono text-xs">
              {cwe}
            </Badge>
            {owasp.map((item) => (
              <Badge key={item} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
            <Badge 
              variant="outline" 
              className="font-semibold text-xs border-primary/40 text-primary"
              data-testid={`badge-risk-score-${id}`}
            >
              Risk: {riskScore}/10
            </Badge>
          </div>
          <h3 className="font-semibold text-base mb-2">{title}</h3>
          {scanName && (
            <div className="text-xs text-muted-foreground mb-2" data-testid={`scan-name-${id}`}>
              <span className="font-medium">From:</span> {scanName}
            </div>
          )}
          {isResolved ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium">Fixes Applied - Resolved</span>
              </div>
              <ReuploadReminder findingId={id} className="mb-3" />
            </>
          ) : aiRemediation && (
            <div className="flex items-center gap-1.5 text-xs text-primary mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-medium">AI-powered fix available</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="font-mono truncate">{affectedAsset}</span>
            </span>
            <span>•</span>
            <span>{detectedDate}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isResolved && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRemediation}
                data-testid={`button-view-remediation-${id}`}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Fix
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRescan}
                data-testid={`button-rescan-${id}`}
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Re-scan
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => console.log("View finding:", id)}
            data-testid={`button-view-finding-${id}`}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
