import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { StatusIndicator } from "@/components/ScanningAnimation";

interface ScanProgressCardProps {
  projectName: string;
  status: "running" | "completed" | "failed";
  progress: number;
  currentPhase: string;
  startedAt: string;
  scanType?: "mvp" | "mobile" | "web";
  onClick?: () => void;
}

export function ScanProgressCard({
  projectName,
  status,
  progress,
  currentPhase,
  startedAt,
  scanType = "mvp",
  onClick,
}: ScanProgressCardProps) {
  const statusConfig = {
    running: {
      bgClass: "bg-primary/5 border-primary/20",
      badgeClass: "bg-primary/10 text-primary",
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      glowClass: "shadow-[0_0_15px_rgba(59,130,246,0.15)]"
    },
    completed: {
      bgClass: "bg-emerald-500/5 border-emerald-500/20",
      badgeClass: "bg-emerald-500/10 text-emerald-500",
      icon: <CheckCircle className="w-4 h-4" />,
      glowClass: ""
    },
    failed: {
      bgClass: "bg-red-500/5 border-red-500/20",
      badgeClass: "bg-red-500/10 text-red-500",
      icon: <XCircle className="w-4 h-4" />,
      glowClass: ""
    },
  };

  const config = statusConfig[status];

  return (
    <Card 
      className={`relative overflow-hidden p-6 transition-all duration-300 ${config.bgClass} ${config.glowClass} ${onClick ? 'hover-elevate cursor-pointer hover:scale-[1.02]' : ''}`}
      data-testid={`card-scan-${projectName.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
    >
      {status === "running" && (
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
            style={{
              animation: "shimmer 2s ease-in-out infinite",
              transform: "translateX(-100%)"
            }}
          />
        </div>
      )}
      
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status === "running" ? "bg-primary/10" : status === "completed" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <Shield className={`w-5 h-5 ${status === "running" ? "text-primary" : status === "completed" ? "text-emerald-500" : "text-red-500"}`} />
            </div>
            <div>
              <h3 className="font-semibold text-base tracking-tight">{projectName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Started {startedAt}</p>
            </div>
          </div>
          <Badge className={`${config.badgeClass} gap-1.5`}>
            <StatusIndicator 
              status={status === "running" ? "active" : status === "completed" ? "success" : "error"} 
              size="sm" 
            />
            <span className="font-medium">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              {config.icon}
              <span>{currentPhase}</span>
            </span>
            <span className="font-semibold tabular-nums text-foreground">{progress}%</span>
          </div>
          <div className="relative">
            <Progress value={progress} className="h-2" />
            {status === "running" && progress > 0 && (
              <div 
                className="absolute top-0 h-2 bg-primary/30 rounded-full"
                style={{
                  width: `${progress}%`,
                  animation: "pulse 1.5s ease-in-out infinite"
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
