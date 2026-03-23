import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Archive as ArchiveIcon, Calendar, Undo2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Finding } from "@shared/schema";
import { format } from "date-fns";

export default function Archive() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data: archivedFindings, isLoading } = useQuery<Finding[]>({
    queryKey: ["/api/findings/archived"],
  });

  const restoreMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("POST", `/api/findings/${findingId}/restore`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/findings/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({
        title: "Finding restored",
        description: "The finding has been moved back to active findings",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore finding",
        variant: "destructive",
      });
    },
  });

  const filteredFindings = archivedFindings?.filter((finding) => {
    const matchesSearch = finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.asset.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === "all" || finding.severity.toLowerCase() === severityFilter;
    return matchesSearch && matchesSeverity;
  }) || [];

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: "bg-severity-critical/10 text-severity-critical border-severity-critical/20",
      high: "bg-severity-high/10 text-severity-high border-severity-high/20",
      medium: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
      low: "bg-severity-low/10 text-severity-low border-severity-low/20",
    };
    return colors[severity.toLowerCase() as keyof typeof colors] || colors.medium;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Archived Findings</h1>
          <p className="text-muted-foreground">Loading archived security findings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ArchiveIcon className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-3xl font-bold" data-testid="heading-archive">Archived Findings</h1>
        </div>
        <p className="text-muted-foreground">
          View fixed and archived security findings from the past 6 months
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search archived findings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-archive"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-severity-archive">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredFindings.length === 0 ? (
          <Card className="p-8 text-center shadow-sm">
            <ArchiveIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg mb-2">No Archived Findings</h3>
            <p className="text-muted-foreground">
              {archivedFindings && archivedFindings.length === 0
                ? "You haven't archived any findings yet. Apply fixes to archive them here."
                : "No findings match your current filters."}
            </p>
          </Card>
        ) : (
          filteredFindings.map((finding) => (
            <Card key={finding.id} className="p-6 shadow-sm hover-elevate" data-testid={`card-archived-finding-${finding.id}`}>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge className={getSeverityColor(finding.severity)}>
                      {finding.severity}
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                      Resolved
                    </Badge>
                    <h3 className="text-lg font-semibold flex-1" data-testid={`text-finding-title-${finding.id}`}>
                      {finding.title}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Asset</div>
                      <div className="font-medium" data-testid={`text-asset-${finding.id}`}>{finding.asset}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">CWE</div>
                      <div className="font-medium" data-testid={`text-cwe-${finding.id}`}>{finding.cwe}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Originally Detected</div>
                      <div className="font-medium">{finding.detected}</div>
                    </div>
                    {finding.archivedAt && (
                      <div className="space-y-1">
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Archived On
                        </div>
                        <div className="font-medium" data-testid={`text-archived-date-${finding.id}`}>
                          {format(new Date(finding.archivedAt), "MMM dd, yyyy")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-row lg:flex-col gap-2 items-center lg:items-end">
                  <div className="text-center lg:text-right">
                    <div className="text-xs text-muted-foreground mb-1">Risk Score</div>
                    <div className="text-2xl font-bold" data-testid={`text-risk-score-${finding.id}`}>
                      {finding.riskScore}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restoreMutation.mutate(finding.id)}
                    disabled={restoreMutation.isPending}
                    data-testid={`button-restore-${finding.id}`}
                  >
                    <Undo2 className="w-4 h-4 mr-1" />
                    Restore
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {filteredFindings.length > 0 && (
        <div className="text-sm text-muted-foreground text-center pt-4">
          Showing {filteredFindings.length} of {archivedFindings?.length || 0} archived findings
        </div>
      )}
    </div>
  );
}
