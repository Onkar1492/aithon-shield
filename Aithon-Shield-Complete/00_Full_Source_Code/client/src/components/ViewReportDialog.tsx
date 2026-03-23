import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Report } from "@shared/schema";
import { FileText, AlertTriangle } from "lucide-react";

interface ViewReportDialogProps {
  report: Report | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewReportDialog({ report, open, onOpenChange }: ViewReportDialogProps) {
  if (!report) return null;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Pending";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-view-report">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl">{report.name}</DialogTitle>
              <DialogDescription className="mt-1">
                Generated on {formatDate(report.generatedAt)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Report Metadata */}
          <div className="flex items-center gap-3">
            <Badge variant="default" className="capitalize">
              {report.type}
            </Badge>
            <Badge 
              variant={report.status === 'generated' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {report.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {report.scanIds?.length || 0} scans included
            </span>
          </div>

          {/* Summary Statistics */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Findings Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold">{report.totalFindings}</div>
                <div className="text-sm text-muted-foreground mt-1">Total</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSeverityColor('critical')}`}>
                  {report.criticalCount}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Critical</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSeverityColor('high')}`}>
                  {report.highCount}
                </div>
                <div className="text-sm text-muted-foreground mt-1">High</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSeverityColor('medium')}`}>
                  {report.mediumCount}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Medium</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSeverityColor('low')}`}>
                  {report.lowCount}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Low</div>
              </div>
            </div>
          </Card>

          {/* Report Details */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Report Type</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {report.type} - {
                  report.type === 'executive' 
                    ? 'High-level overview for executives and stakeholders'
                    : report.type === 'technical'
                    ? 'Detailed technical analysis for developers and security teams'
                    : 'Compliance and regulatory requirements assessment'
                }
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Scans Included</h3>
              <div className="flex flex-wrap gap-2">
                {report.scanIds && report.scanIds.length > 0 ? (
                  report.scanIds.map((scanId, index) => (
                    <Badge key={scanId} variant="outline">
                      Scan {index + 1}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No scans included</p>
                )}
              </div>
            </div>

            {report.status === 'pending' && (
              <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This report is currently being generated. It will be ready shortly.
                </p>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
