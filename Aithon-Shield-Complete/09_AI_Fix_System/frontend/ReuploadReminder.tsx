import { UploadCloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReuploadReminderProps {
  findingId?: string;
  className?: string;
}

export function ReuploadReminder({ findingId, className }: ReuploadReminderProps) {
  return (
    <Alert 
      className={className}
      data-testid={findingId ? `text-reupload-reminder-${findingId}` : "text-reupload-reminder"}
    >
      <UploadCloud className="h-4 w-4" />
      <AlertDescription>
        Fix applied. Deploy the updated build to your app destination to activate the change.
      </AlertDescription>
    </Alert>
  );
}
