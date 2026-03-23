import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useScanFindings, type ScanType } from "@/hooks/use-scan-findings";

interface UploadWithoutFixesWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanType: ScanType;
  scanId: string;
  destination: string;
  onProceedAnyway: () => void;
  onResolveIssues: () => void;
}

export function UploadWithoutFixesWarningDialog({
  open,
  onOpenChange,
  scanType,
  scanId,
  destination,
  onProceedAnyway,
  onResolveIssues,
}: UploadWithoutFixesWarningDialogProps) {
  const { data: findings = [], isLoading } = useScanFindings(
    scanType,
    scanId,
    open // Only fetch when dialog is open
  );

  const findingsCount = findings.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <AlertDialogTitle data-testid="heading-upload-without-fixes-warning">
                Upload Without Fixes Warning
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 mt-2">
                  <p className="text-muted-foreground" data-testid="text-warning-message">
                    If you re-upload this back to <span className="font-semibold text-foreground">{destination}</span>,
                    the {isLoading ? "..." : findingsCount} cyber security {findingsCount === 1 ? "issue" : "issues"} will remain unresolved.
                  </p>
                  
                  {!isLoading && findingsCount > 0 && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">Issues to be uploaded:</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" data-testid="badge-findings-count">
                          {findingsCount} Unresolved {findingsCount === 1 ? "Issue" : "Issues"}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-sm font-medium text-foreground" data-testid="text-resolve-prompt">
                    Would you like to resolve these issues before uploading?
                  </p>
                </div>
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-upload">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onProceedAnyway}
            data-testid="button-upload-anyway"
          >
            Upload Anyway
          </Button>
          <Button
            onClick={onResolveIssues}
            data-testid="button-resolve-issues"
          >
            Resolve Issues
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
