import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, AlertTriangle, Upload, Play } from "lucide-react";
import { useGlobalFixJob } from "@/hooks/useGlobalFixJob";
import { UploadWithFixesOptionsDialog } from "@/components/UploadWithFixesOptionsDialog";
import { useState } from "react";
import type { GlobalFixScanTask } from "@shared/schema";

interface GlobalFixProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

function ScanTaskCard({ task, onUploadDecision, onTriggerUpload, isTriggeringUpload }: { 
  task: GlobalFixScanTask; 
  onUploadDecision: (decision: 'yes' | 'no' | 'with_tests') => void;
  onTriggerUpload: () => void;
  isTriggeringUpload: boolean;
}) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'applying_fixes':
      case 'validating':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusText = () => {
    switch (task.status) {
      case 'pending':
        return 'Waiting...';
      case 'applying_fixes':
        return 'Applying Fixes';
      case 'validating':
        return 'Validating';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return task.status;
    }
  };

  const showUploadDecision = task.status === 'completed' && !task.uploadDecision;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getStatusIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-medium truncate">{task.scanName}</p>
            <Badge variant="outline" className="text-xs">
              {task.scanType}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>{getStatusText()}</span>
            {task.issueCount > 0 && (
              <>
                <span>•</span>
                <span>{task.issueCount} issues</span>
              </>
            )}
          </div>

          {task.status !== 'pending' && task.status !== 'failed' && (
            <Progress value={task.progress} className="h-2 mb-2" />
          )}

          {task.status === 'completed' && (
            <div className="flex items-center gap-2 text-sm mt-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">
                {task.issuesFixed} of {task.issueCount} fixed
              </span>
              {task.validationStatus === 'passed' && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                  Validated
                </Badge>
              )}
            </div>
          )}

          {task.status === 'failed' && task.errorMessage && (
            <div className="flex items-center gap-2 text-sm text-destructive mt-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="truncate">{task.errorMessage}</span>
            </div>
          )}

          {showUploadDecision && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Re-upload Fixed Version?</p>
                <p className="text-xs text-muted-foreground">
                  Choose how to proceed with the fixed code for "{task.scanName}"
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUploadDecision('yes')}
                  data-testid={`button-upload-yes-${task.id}`}
                  className="flex-col h-auto py-2 px-2"
                >
                  <Upload className="w-4 h-4 mb-1" />
                  <span className="text-xs font-medium">Upload Now</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Direct upload</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUploadDecision('with_tests')}
                  data-testid={`button-upload-with-tests-${task.id}`}
                  className="flex-col h-auto py-2 px-2 border-primary/50 bg-primary/5"
                >
                  <Play className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-xs font-medium">Test First</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Validates app stability</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onUploadDecision('no')}
                  data-testid={`button-upload-no-${task.id}`}
                  className="flex-col h-auto py-2 px-2"
                >
                  <span className="text-xs font-medium">Skip</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Don't upload</span>
                </Button>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  <span className="font-medium">Recommendation:</span> Use "Test First" to ensure fixes don't break your app before deploying.
                </p>
              </div>
            </div>
          )}

          {task.uploadDecision && task.uploadDecision !== 'pending' && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                <span>
                  Upload: {task.uploadDecision === 'yes' ? 'Confirmed' : task.uploadDecision === 'with_tests' ? 'With Tests' : 'Skipped'}
                </span>
                {task.testStatus === 'running' && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Testing...
                  </Badge>
                )}
                {task.uploadStatus === 'uploading' && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Uploading...
                  </Badge>
                )}
                {task.uploadStatus === 'completed' && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed
                  </Badge>
                )}
                {task.testStatus === 'passed' && task.readyForUpload && task.uploadStatus !== 'completed' && task.uploadStatus !== 'uploading' && (
                  <Button
                    size="sm"
                    onClick={onTriggerUpload}
                    disabled={isTriggeringUpload}
                    data-testid={`button-upload-now-${task.id}`}
                    className="ml-auto"
                  >
                    {isTriggeringUpload ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    Upload Now
                  </Button>
                )}
                {task.uploadStatus && task.uploadStatus !== 'pending' && task.uploadStatus !== 'uploading' && task.uploadStatus !== 'completed' && !task.readyForUpload && (
                  <Badge variant="secondary" className="text-xs">
                    {task.uploadStatus}
                  </Badge>
                )}
                {task.uploadStatus === 'pending' && task.testStatus !== 'running' && !task.readyForUpload && (
                  <Badge variant="secondary" className="text-xs">
                    pending
                  </Badge>
                )}
              </div>
              {task.testStatus === 'passed' && task.readyForUpload && task.uploadStatus !== 'completed' && task.uploadStatus !== 'uploading' && (
                <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded-md p-2">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    Tests passed! Click "Upload Now" to deploy your fixed code.
                  </p>
                </div>
              )}
              {task.uploadStatus === 'completed' && (
                <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded-md p-2">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    Upload completed successfully! Your fixed code has been deployed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GlobalFixProgressDialog({ open, onOpenChange, jobId }: GlobalFixProgressDialogProps) {
  const { job, tasks, updateUploadDecision, triggerUpload, isTriggeringUpload } = useGlobalFixJob({ 
    jobId, 
    enabled: open,
  });
  const [uploadDialogTask, setUploadDialogTask] = useState<GlobalFixScanTask | null>(null);

  const handleUploadDecision = (taskId: string, decision: 'yes' | 'no' | 'with_tests') => {
    updateUploadDecision({ jobId, taskId, uploadDecision: decision });
  };

  const handleTriggerUpload = (taskId: string) => {
    triggerUpload({ jobId, taskId });
  };

  const handleOpenUploadDialog = (task: GlobalFixScanTask) => {
    setUploadDialogTask(task);
  };

  const getOverallProgress = () => {
    if (!job || !tasks) return 0;
    const completedCount = tasks.filter(t => t.status === 'completed' || t.status === 'failed').length;
    return Math.round((completedCount / tasks.length) * 100);
  };

  const getStatusMessage = () => {
    if (!job) return "Loading...";
    
    switch (job.status) {
      case 'payment_pending':
        return "Awaiting payment confirmation...";
      case 'processing':
        return `Processing ${job.scansCompleted} of ${job.totalScans} scans...`;
      case 'completed':
        return "All scans completed successfully!";
      case 'partial_success':
        return `Completed with ${job.scansFailed} failure(s)`;
      case 'failed':
        return "Fix job failed";
      default:
        return job.status;
    }
  };

  const isComplete = job?.status === 'completed' || job?.status === 'partial_success';
  const hasFailed = job?.status === 'failed';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]" data-testid="dialog-global-fix-progress">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isComplete && <CheckCircle className="w-5 h-5 text-green-500" />}
              {hasFailed && <XCircle className="w-5 h-5 text-destructive" />}
              {!isComplete && !hasFailed && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
              Global Fix Progress
            </DialogTitle>
            <DialogDescription>
              {getStatusMessage()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Overall Progress */}
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-muted-foreground">{getOverallProgress()}%</span>
                </div>
                <Progress value={getOverallProgress()} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{job?.scansCompleted || 0} completed</span>
                  {job?.scansFailed ? (
                    <span className="text-destructive">{job.scansFailed} failed</span>
                  ) : null}
                  <span>{job?.totalScans || 0} total</span>
                </div>
              </div>
            </Card>

            {/* Scan Tasks */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {tasks?.map((task) => (
                <ScanTaskCard
                  key={task.id}
                  task={task}
                  onUploadDecision={(decision) => handleUploadDecision(task.id, decision)}
                  onTriggerUpload={() => handleTriggerUpload(task.id)}
                  isTriggeringUpload={isTriggeringUpload}
                />
              ))}
            </div>

            {/* Action Button */}
            {isComplete && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                  data-testid="button-close-progress"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Options Dialog for advanced upload scenarios */}
      {uploadDialogTask && (
        <UploadWithFixesOptionsDialog
          open={!!uploadDialogTask}
          onOpenChange={(open) => {
            // ONLY allow opening - closing must be done via explicit button clicks
            if (open) {
              // Already open, do nothing
            }
            // Ignore false values - dialog closes only when user clicks Cancel or completes upload
          }}
          onClose={() => setUploadDialogTask(null)}
          scanId={uploadDialogTask.scanId}
          scanType={uploadDialogTask.scanType as 'mvp' | 'mobile' | 'web'}
          destination={uploadDialogTask.scanName || "deployment platform"}
          onProceedWithUpload={(runTests) => {
            // Handle upload decision - close dialog and mark as uploaded
            setUploadDialogTask(null);
          }}
        />
      )}
    </>
  );
}
