import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type ScanType = "mvp" | "mobile" | "web";

interface UploadOptions {
  scanType: ScanType;
  scanId: string;
  destination: string;
  withFixes: boolean;
  runTests?: boolean;
}

export function useScanUpload() {
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async ({ scanType, scanId, destination, withFixes, runTests = false }: UploadOptions) => {
      // Update scan record with fix preference before upload
      await apiRequest("PATCH", `/api/${scanType}-scans/${scanId}`, {
        fixesApplied: withFixes,
        uploadPreference: withFixes ? 'fix-and-upload' : 'upload-without-fixes',
        autoUploadDestination: destination
      });

      // Trigger backend upload process (with or without tests)
      const endpoint = runTests 
        ? `/api/${scanType}-scans/${scanId}/upload-and-test`
        : `/api/${scanType}-scans/${scanId}/upload`;
      
      await apiRequest("POST", endpoint, {
        destination,
        withFixes
      });

      return { scanType, scanId, destination, withFixes, runTests };
    },
    onSuccess: ({ scanType, scanId, destination, withFixes, runTests }) => {
      // Invalidate scan queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`, scanId] });
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`] });

      // Show success toast
      toast({
        title: runTests ? "Upload & Testing Initiated" : "Upload Initiated",
        description: runTests
          ? `Your ${withFixes ? "scanned and fixed" : "scanned"} app is being uploaded to ${destination} and comprehensive tests will run automatically.`
          : `Your ${withFixes ? "scanned and fixed" : "scanned"} app is being uploaded to ${destination}. Check the scan details for progress.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to initiate upload. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    upload: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    error: uploadMutation.error,
  };
}
