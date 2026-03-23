import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Plus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Report } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { GenerateReportDialog } from "@/components/GenerateReportDialog";
import { ViewReportDialog } from "@/components/ViewReportDialog";

export default function Reports() {
  const { toast } = useToast();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const { data: reportsData = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
    refetchInterval: (query) => {
      const data = query.state.data;
      // Auto-refresh if any report is pending
      if (data?.some(report => report.status === "pending")) {
        return 2000;
      }
      return false;
    },
  });

  // Sort reports by generated date (latest first)
  const reports = [...reportsData].sort((a, b) => {
    const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
    const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
    return dateB - dateA;
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/${reportId}/download/pdf`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "The report PDF has been downloaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download the PDF report",
        variant: "destructive",
      });
    },
  });

  const downloadJsonMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/${reportId}/download/json`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "JSON Downloaded",
        description: "The report JSON has been downloaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download the JSON report",
        variant: "destructive",
      });
    },
  });

  const downloadHtmlMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/${reportId}/download/html`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportId}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "HTML Downloaded",
        description: "The report HTML has been downloaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download the HTML report",
        variant: "destructive",
      });
    },
  });

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Pending";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate and download comprehensive security reports
          </p>
        </div>
        <Button 
          onClick={() => setIsGenerateDialogOpen(true)}
          data-testid="button-generate-report"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
          <p className="text-muted-foreground mb-4">
            Generate your first security report to get started
          </p>
          <Button onClick={() => setIsGenerateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {reports.map((report) => (
            <Card key={report.id} className="p-6 shadow-sm" data-testid={`card-report-${report.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{report.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Generated {formatDate(report.generatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <Badge 
                      variant={report.status === 'generated' ? 'default' : 'secondary'}
                      data-testid={`badge-type-${report.id}`}
                    >
                      {report.type}
                    </Badge>
                    <Badge 
                      variant={report.status === 'generated' ? 'default' : 'secondary'}
                      data-testid={`badge-status-${report.id}`}
                    >
                      {report.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {report.scanIds?.length || 0} scans
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {report.totalFindings} findings
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewReport(report)}
                    data-testid={`button-view-report-${report.id}`}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadPdfMutation.mutate(report.id)}
                    disabled={downloadPdfMutation.isPending}
                    data-testid={`button-download-pdf-${report.id}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadHtmlMutation.mutate(report.id)}
                    disabled={downloadHtmlMutation.isPending}
                    data-testid={`button-download-html-${report.id}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    HTML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadJsonMutation.mutate(report.id)}
                    disabled={downloadJsonMutation.isPending}
                    data-testid={`button-download-json-${report.id}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    JSON
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GenerateReportDialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
      />

      <ViewReportDialog
        report={selectedReport}
        open={selectedReport !== null}
        onOpenChange={(open) => !open && setSelectedReport(null)}
      />
    </div>
  );
}
