import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface PostFixIssue {
  type: string;
  severity: string;
  title: string;
  description: string;
  file: string;
  line: number;
  function: string | null;
}

export interface FixSnippet {
  id: string;
  issueTitle: string;
  file: string;
  line: number;
  function: string | null;
  description: string;
  code: string;
  language: string;
}

export interface ValidationSession {
  id: string;
  userId: string;
  scanType: string;
  scanId: string;
  currentStep: string;
  preFixValidationStatus: string;
  postFixValidationStatus: string;
  postFixIssues: PostFixIssue[];
  manualFixSnippets?: FixSnippet[];
  stripePaymentIntentId?: string;
  paymentStatus?: string;
  automatedFixRequested?: boolean;
  automatedFixJobId?: string;
  completedAt?: Date;
}

export interface AutomatedFixJob {
  id: string;
  userId: string;
  sessionId: string;
  scanType: string;
  scanId: string;
  status: string;
  progress: number;
  currentTask?: string;
  issuesFixed?: number;
  completedAt?: Date;
  testStatus?: string;
  testProgress?: number;
  testSummary?: string;
  testDetails?: any;
}

export function usePostFixValidation(scanType: string, scanId: string | null) {
  // Trigger post-fix validation
  const validatePostFix = useMutation({
    mutationFn: async () => {
      if (!scanId) {
        throw new Error("Scan ID is required");
      }
      const res = await apiRequest("POST", `/api/scans/${scanType}/${scanId}/validate-post-fix`, {});
      return await res.json();
    },
    onSuccess: (data: ValidationSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fix-validation-sessions", data.id] });
    },
  });

  // Get validation session
  // IMPORTANT: This must be called unconditionally (React Rules of Hooks)
  const useValidationSession = (sessionId: string | null) => {
    return useQuery<ValidationSession>({
      queryKey: ["/api/fix-validation-sessions", sessionId],
      enabled: !!sessionId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.postFixValidationStatus === "running") {
          return 1000;
        }
        return false;
      },
    });
  };

  // Generate manual fix snippets
  const generateManualFix = useMutation({
    mutationFn: async () => {
      if (!scanId) {
        throw new Error("Scan ID is required");
      }
      const res = await apiRequest("POST", `/api/scans/${scanType}/${scanId}/manual-fix-snippets`, {});
      return await res.json();
    },
    onSuccess: (data: ValidationSession) => {
      // Immediately update the cache with the new session data for instant UI update
      queryClient.setQueryData(["/api/fix-validation-sessions", data.id], data);
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/fix-validation-sessions", data.id] });
    },
  });

  // Create payment intent for automated fixes
  const createAutoFixPayment = useMutation({
    mutationFn: async () => {
      if (!scanId) {
        throw new Error("Scan ID is required");
      }
      const res = await apiRequest("POST", `/api/scans/${scanType}/${scanId}/auto-fix-all`, {});
      return await res.json();
    },
  });

  // Confirm payment and start automated fix job
  const confirmPayment = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/fix-validation-sessions/${sessionId}/confirm-payment`, {});
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate scan queries to keep UI in sync
      if (scanId) {
        queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`, scanId] });
        queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`] });
      }
    },
  });

  // Get automated fix job status
  // IMPORTANT: This must be called unconditionally (React Rules of Hooks)
  const useAutomatedFixJob = (jobId: string | null) => {
    return useQuery<AutomatedFixJob>({
      queryKey: ["/api/automated-fix-jobs", jobId],
      enabled: !!jobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "queued" || data?.status === "in_progress") {
          return 1000;
        }
        return false;
      },
    });
  };

  return {
    validatePostFix,
    useValidationSession,
    generateManualFix,
    createAutoFixPayment,
    confirmPayment,
    useAutomatedFixJob,
    enabled: !!scanId, // Expose enabled flag for consumers
  };
}
