import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Finding } from "@shared/schema";

interface FixBatch {
  id: string;
  status: string;
  progress: number;
  validationStatus?: string;
  uploadStatus?: string;
}

type ScanType = 'linter' | 'pipeline' | 'network' | 'container';

interface UseFixWorkflowOptions {
  onFixComplete?: () => void;
}

export function useFixWorkflow(scanType: ScanType, scanId: string, options?: UseFixWorkflowOptions) {
  const { toast } = useToast();
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [activeBatch, setActiveBatch] = useState<FixBatch | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [issueCount, setIssueCount] = useState<number>(0);

  // Dynamic endpoints based on scan type
  const endpoints = {
    singleFix: `/api/${scanType}-scans/${scanId}/fix`,
    autoFixAll: `/api/${scanType}-scans/${scanId}/auto-fix-all`,
    confirmPayment: (batchId: string) => `/api/${scanType}-fix-batches/${batchId}/confirm-payment`,
  };

  // Begin fix workflow - opens scope dialog
  const beginFix = (finding: Finding) => {
    setSelectedFinding(finding);
    setShowScopeDialog(true);
  };

  // Single fix mutation (free)
  const singleFixMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("POST", endpoints.singleFix, {
        findingId,
      });
      return await res.json();
    },
    onSuccess: (batch) => {
      setActiveBatch(batch);
      setShowScopeDialog(false);
      toast({
        title: "Fix Applied",
        description: "Security fix has been applied. You can now upload to your repository.",
      });
      // Invalidate scan-specific findings (used by use-scan-findings hook)
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`, scanId, "findings"] });
      // Invalidate global findings (used by FindingsTable, RiskMapVisualization, etc.)
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      // Invalidate scan detail - array format (used by most pages)
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`, scanId] });
      // Invalidate scan detail - string format (used by ScanDetails.tsx)
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans/${scanId}`] });
      // Invalidate scan list
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`] });
      // Call the onFixComplete callback if provided
      options?.onFixComplete?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply fix. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fix all - initiates payment
  const fixAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", endpoints.autoFixAll, {});
      return await res.json();
    },
    onSuccess: (data) => {
      setPaymentClientSecret(data.clientSecret);
      setPaymentAmount(data.amount);
      setIssueCount(data.issueCount);
      setActiveBatch({ 
        id: data.batchId, 
        status: data.status || 'pending_payment', 
        progress: 0 
      });
      setShowScopeDialog(false);
      setShowPaymentDialog(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate batch fix. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Confirm payment and start fix job
  const confirmPaymentMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest("POST", endpoints.confirmPayment(batchId), {
        demoMode: !paymentClientSecret || paymentClientSecret === 'demo_client_secret',
      });
      return await res.json();
    },
    onSuccess: () => {
      setShowPaymentDialog(false);
      toast({
        title: "Payment Confirmed",
        description: "Batch fix job started. This may take a few moments.",
      });
      // Invalidate scan-specific findings (used by use-scan-findings hook)
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`, scanId, "findings"] });
      // Invalidate global findings (used by FindingsTable, RiskMapVisualization, etc.)
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      // Invalidate scan detail - array format (used by most pages)
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`, scanId] });
      // Invalidate scan detail - string format (used by ScanDetails.tsx)
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans/${scanId}`] });
      // Invalidate scan list
      queryClient.invalidateQueries({ queryKey: [`/api/${scanType}-scans`] });
      // Call the onFixComplete callback if provided
      options?.onFixComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Payment verification failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle single fix action
  const handleSingleFix = () => {
    if (selectedFinding) {
      singleFixMutation.mutate(selectedFinding.id);
    }
  };

  // Handle fix all action
  const handleFixAll = () => {
    fixAllMutation.mutate();
  };

  // Handle payment confirmation
  const handlePaymentConfirm = () => {
    if (activeBatch) {
      confirmPaymentMutation.mutate(activeBatch.id);
    }
  };

  return {
    // State
    showScopeDialog,
    setShowScopeDialog,
    selectedFinding,
    setSelectedFinding,
    activeBatch,
    showPaymentDialog,
    setShowPaymentDialog,
    paymentClientSecret,
    paymentAmount,
    issueCount,

    // Actions
    beginFix,
    handleSingleFix,
    handleFixAll,
    handlePaymentConfirm,

    // Mutation states
    isApplyingSingleFix: singleFixMutation.isPending,
    isInitiatingFixAll: fixAllMutation.isPending,
    isConfirmingPayment: confirmPaymentMutation.isPending,
  };
}
