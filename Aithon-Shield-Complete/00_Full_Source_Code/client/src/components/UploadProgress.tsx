import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadProgressProps {
  uploadProgress: string;
  destination: string;
}

export function UploadProgress({ uploadProgress, destination }: UploadProgressProps) {
  const getProgressPercentage = () => {
    switch (uploadProgress) {
      case 'connecting':
        return 33;
      case 'uploading':
        return 66;
      case 'finalizing':
        return 90;
      default:
        return 0;
    }
  };

  const getStepStatus = (step: string) => {
    const steps = ['connecting', 'uploading', 'finalizing'];
    const currentIndex = steps.indexOf(uploadProgress);
    const stepIndex = steps.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const StepIcon = ({ status }: { status: string }) => {
    if (status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" data-testid="icon-step-completed" />;
    }
    if (status === 'active') {
      return <Loader2 className="h-5 w-5 text-primary animate-spin" data-testid="icon-step-active" />;
    }
    return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" data-testid="icon-step-pending" />;
  };

  if (uploadProgress === 'idle') {
    return null;
  }

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border" data-testid="upload-progress-container">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" data-testid="text-upload-progress-title">
            Uploading to {destination}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="text-upload-progress-percentage">
            {getProgressPercentage()}%
          </p>
        </div>
        <Progress value={getProgressPercentage()} className="h-2" data-testid="progress-upload" />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1" data-testid="step-connecting">
          <StepIcon status={getStepStatus('connecting')} />
          <div>
            <p className={`text-sm font-medium ${getStepStatus('connecting') === 'active' ? 'text-primary' : getStepStatus('connecting') === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`}>
              Connecting
            </p>
            <p className="text-xs text-muted-foreground">
              Establishing connection
            </p>
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground" />

        <div className="flex items-center gap-2 flex-1" data-testid="step-uploading">
          <StepIcon status={getStepStatus('uploading')} />
          <div>
            <p className={`text-sm font-medium ${getStepStatus('uploading') === 'active' ? 'text-primary' : getStepStatus('uploading') === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`}>
              Uploading
            </p>
            <p className="text-xs text-muted-foreground">
              Transferring files
            </p>
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground" />

        <div className="flex items-center gap-2 flex-1" data-testid="step-finalizing">
          <StepIcon status={getStepStatus('finalizing')} />
          <div>
            <p className={`text-sm font-medium ${getStepStatus('finalizing') === 'active' ? 'text-primary' : getStepStatus('finalizing') === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`}>
              Finalizing
            </p>
            <p className="text-xs text-muted-foreground">
              Completing upload
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
