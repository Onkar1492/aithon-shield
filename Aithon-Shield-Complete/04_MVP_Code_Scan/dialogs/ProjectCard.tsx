import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Smartphone, Code, Play, Package } from "lucide-react";

interface ProjectCardProps {
  id: string;
  name: string;
  type: "web" | "mobile" | "api" | "mvp";
  lastScan?: string;
  findingsCount: number;
  criticalCount: number;
  onScan?: () => void;
}

const typeIcons = {
  web: Globe,
  mobile: Smartphone,
  api: Code,
  mvp: Package,
};

const typeLabels = {
  web: "Web",
  mobile: "Mobile",
  api: "API",
  mvp: "MVP",
};

export function ProjectCard({
  id,
  name,
  type,
  lastScan,
  findingsCount,
  criticalCount,
  onScan,
}: ProjectCardProps) {
  const Icon = typeIcons[type];
  const label = typeLabels[type];

  return (
    <Card className="p-6 hover-elevate shadow-sm" data-testid={`card-project-${id}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{name}</h3>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <p className="text-2xl font-bold tabular-nums">{findingsCount}</p>
          <p className="text-xs text-muted-foreground">Total Findings</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-severity-critical">{criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical</p>
        </div>
      </div>
      {lastScan && (
        <p className="text-sm text-muted-foreground mb-4">Last scan: {lastScan}</p>
      )}
      <Button
        className="w-full"
        variant="outline"
        onClick={onScan}
        data-testid={`button-scan-${id}`}
      >
        <Play className="w-4 h-4 mr-2" />
        Start New Scan
      </Button>
    </Card>
  );
}
