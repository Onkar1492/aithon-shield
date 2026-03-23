import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Flame } from "lucide-react";
import { useLocation } from "wouter";
import type { Finding } from "@shared/schema";

interface PriorityWidgetProps {
  findings: Finding[];
}

// Helper function to get priority tier
function getPriorityTier(priorityScore: number): string {
  if (priorityScore >= 85) return "Urgent";
  if (priorityScore >= 70) return "High";
  if (priorityScore >= 50) return "Medium";
  return "Low";
}

// Helper function to check if finding is "Fix This First"
function isFixThisFirst(priorityScore: number, severity: string, exploitabilityScore: number): boolean {
  return priorityScore >= 85 || (severity === "Critical" && exploitabilityScore >= 80);
}

export function PriorityWidget({ findings }: PriorityWidgetProps) {
  const [, setLocation] = useLocation();

  // Get top 3 priority findings
  const topPriorityFindings = findings
    .filter(f => !f.isArchived)
    .slice(0, 3);

  const urgentCount = findings.filter(f => !f.isArchived && (f.priorityScore || 0) >= 85).length;
  const fixFirstCount = findings.filter(f => 
    !f.isArchived && isFixThisFirst(f.priorityScore || 0, f.severity, f.exploitabilityScore || 0)
  ).length;

  const handleViewAll = () => {
    setLocation("/findings?priority=Urgent");
  };

  return (
    <Card className="shadow-sm" data-testid="widget-priority">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Flame className="w-5 h-5 text-destructive" />
          Fix This First
        </CardTitle>
        {urgentCount > 0 && (
          <Badge variant="destructive" className="font-semibold">
            {urgentCount} Urgent
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {fixFirstCount === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No urgent priority findings</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {topPriorityFindings.map((finding) => {
                const priorityScore = finding.priorityScore || 0;
                const priorityTier = getPriorityTier(priorityScore);
                const showFixFirst = isFixThisFirst(priorityScore, finding.severity, finding.exploitabilityScore || 0);

                if (!showFixFirst) return null;

                return (
                  <div
                    key={finding.id}
                    className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/findings`)}
                    data-testid={`priority-finding-${finding.id}`}
                  >
                    <div className="flex-shrink-0">
                      <Badge
                        variant={priorityTier === "Urgent" ? "destructive" : "default"}
                        className="font-bold min-w-[3rem] justify-center"
                      >
                        {priorityScore}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{finding.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {finding.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {finding.asset}
                        </span>
                      </div>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  </div>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleViewAll}
              data-testid="button-view-all-priorities"
            >
              View All Urgent Issues
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
