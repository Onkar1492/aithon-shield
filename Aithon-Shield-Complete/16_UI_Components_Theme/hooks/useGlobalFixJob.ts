import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRef, useEffect } from "react";
import type { GlobalFixJob, GlobalFixScanTask } from "@shared/schema";

interface UseGlobalFixJobOptions {
  jobId?: string;
  enabled?: boolean;
  onJobComplete?: () => void;
}

export function useGlobalFixJob(options: UseGlobalFixJobOptions = {}) {
  const { jobId, enabled = true, onJobComplete } = options;
  const { toast } = useToast();
  const previousStatusRef = useRef<string | undefined>();

  // Query for job status with polling
  const jobQuery = useQuery<GlobalFixJob>({
    queryKey: ["/api/global-fix-jobs", jobId],
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      // Poll every 2 seconds while processing, stop when completed/failed
      if (job?.status === 'processing' || job?.status === 'payment_pending') {
        return 2000;
      }
      return false;
    },
  });

  // Query for scan tasks with polling
  const tasksQuery = useQuery<GlobalFixScanTask[]>({
    queryKey: ["/api/global-fix-jobs", jobId, "tasks"],
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const job = jobQuery.data;
      const tasks = query.state.data;
      
      // Poll every 2 seconds while processing
      if (job?.status === 'processing') {
        return 2000;
      }
      
      // Also poll if any task has tests running - this is crucial for the "Test First" flow
      // The job may be completed but tests are still running asynchronously
      if (tasks?.some(t => t.testStatus === 'running')) {
        return 2000;
      }
      
      // Also poll if any task has upload in progress or pending
      // The job may be completed but uploads are still running asynchronously
      // CRITICAL: Must poll for 'pending' status too, as it transitions to 'uploading' via setTimeout
      if (tasks?.some(t => t.uploadStatus === 'uploading' || t.uploadStatus === 'pending')) {
        return 2000;
      }
      
      return false;
    },
  });

  // Detect job completion using useEffect to track status changes
  useEffect(() => {
    const currentStatus = jobQuery.data?.status;
    const previousStatus = previousStatusRef.current;
    
    // Fire callback when transitioning from 'processing' to a final state
    if (previousStatus === 'processing' && 
        (currentStatus === 'completed' || 
         currentStatus === 'partial_success' || 
         currentStatus === 'failed')) {
      // Refetch tasks one final time to get their completed statuses
      queryClient.invalidateQueries({ queryKey: ["/api/global-fix-jobs", jobId, "tasks"] });
      onJobComplete?.();
    }
    
    // Update the previous status ref
    previousStatusRef.current = currentStatus;
  }, [jobQuery.data?.status, jobId, onJobComplete]);

  // Create global fix job mutation
  const createJobMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/global-fix-jobs", {});
      return await res.json();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create global fix job",
        variant: "destructive",
      });
    },
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ jobId, demoMode }: { jobId: string; demoMode?: boolean }) => {
      const res = await apiRequest("POST", `/api/global-fix-jobs/${jobId}/confirm-payment`, {
        demoMode,
      });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ["/api/global-fix-jobs", jobId] });
        queryClient.invalidateQueries({ queryKey: ["/api/global-fix-jobs", jobId, "tasks"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    },
  });

  // Update upload decision mutation
  const updateUploadDecisionMutation = useMutation({
    mutationFn: async ({ 
      jobId, 
      taskId, 
      uploadDecision 
    }: { 
      jobId: string; 
      taskId: string; 
      uploadDecision: 'yes' | 'no' | 'with_tests';
    }) => {
      const res = await apiRequest(
        "PATCH", 
        `/api/global-fix-jobs/${jobId}/tasks/${taskId}/upload-decision`,
        { uploadDecision }
      );
      return await res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate task queries to refresh
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ["/api/global-fix-jobs", jobId, "tasks"] });
      }
      
      // For 'with_tests', show different message and trigger polling by refetching
      if (variables.uploadDecision === 'with_tests') {
        toast({
          title: "Running Tests",
          description: "Tests are running. Upload button will appear when complete.",
        });
        // Force a refetch after a short delay to catch the test running state
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/global-fix-jobs", jobId, "tasks"] });
        }, 500);
      } else {
        toast({
          title: "Upload Decision Saved",
          description: "Your upload preference has been saved",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save upload decision",
        variant: "destructive",
      });
    },
  });

  // Trigger upload after tests complete mutation
  const triggerUploadMutation = useMutation({
    mutationFn: async ({ 
      jobId, 
      taskId 
    }: { 
      jobId: string; 
      taskId: string;
    }) => {
      const res = await apiRequest(
        "POST", 
        `/api/global-fix-jobs/${jobId}/tasks/${taskId}/upload`,
        {}
      );
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate task queries to refresh
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ["/api/global-fix-jobs", jobId, "tasks"] });
      }
      toast({
        title: "Upload Started",
        description: "Your fixed code is being uploaded",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start upload",
        variant: "destructive",
      });
    },
  });

  return {
    // Data
    job: jobQuery.data,
    tasks: tasksQuery.data,
    isLoadingJob: jobQuery.isLoading,
    isLoadingTasks: tasksQuery.isLoading,
    
    // Mutations
    createJob: createJobMutation.mutate,
    isCreatingJob: createJobMutation.isPending,
    createJobData: createJobMutation.data,
    
    confirmPayment: confirmPaymentMutation.mutate,
    isConfirmingPayment: confirmPaymentMutation.isPending,
    
    updateUploadDecision: updateUploadDecisionMutation.mutate,
    isUpdatingUploadDecision: updateUploadDecisionMutation.isPending,
    
    triggerUpload: triggerUploadMutation.mutate,
    isTriggeringUpload: triggerUploadMutation.isPending,
  };
}
