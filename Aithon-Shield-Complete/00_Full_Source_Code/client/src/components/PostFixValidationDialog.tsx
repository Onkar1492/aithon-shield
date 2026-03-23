import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Copy, Loader2, CreditCard, AlertTriangle, Smartphone, Globe, Upload, Minimize2, Shield } from "lucide-react";
import { usePostFixValidation, type FixSnippet } from "@/hooks/use-post-fix-validation";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { MockStripeForm } from "@/components/MockStripeForm";
import { useMinimizedDialogs } from "@/contexts/MinimizedDialogContext";

// Load Stripe with the publishable key (starts with pk_test_ or pk_live_)
// This key is safe to use in frontend code and required for Stripe.js
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Check if we should use mock Stripe form for E2E testing
const useMockStripe = import.meta.env.VITE_E2E_MOCK_STRIPE === 'true';

// Stripe Payment Form Component - Shows actual card input fields
function StripePaymentForm({ onSuccess, amount }: { onSuccess: () => void; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
          payment_method_data: {
            billing_details: {
              phone: '+15555555555' // Dummy phone since we're not collecting it
            }
          }
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || "Payment failed");
        toast({
          title: "Payment Failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      } else {
        // Payment successful
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred");
      toast({
        title: "Payment Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-lg p-4 bg-card relative">
        {!isPaymentElementReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <PaymentElement 
          onReady={() => setIsPaymentElementReady(true)}
          options={{
            fields: {
              billingDetails: {
                phone: 'never'
              }
            }
          }}
        />
      </div>
      
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">${(amount / 100).toFixed(2)}</p>
        </div>
        <Button
          type="submit"
          disabled={!stripe || !isPaymentElementReady || isProcessing}
          size="lg"
          data-testid="button-complete-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Complete Payment
            </>
          )}
        </Button>
      </div>
      
      <p className="text-xs text-center text-muted-foreground">
        Your payment is secured by Stripe. Fixes will be applied after successful payment.
      </p>
    </form>
  );
}

interface PostFixValidationDialogProps {
  scanType: string;
  scanId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidationComplete?: () => void;
  onRequestUpload?: () => void; // New callback for requesting upload after auto-fix completion
  onClose?: () => void; // Explicit close callback - needed since onOpenChange ignores false values
}

export function PostFixValidationDialog({
  scanType,
  scanId,
  open,
  onOpenChange,
  onValidationComplete,
  onRequestUpload,
  onClose,
}: PostFixValidationDialogProps) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"manual" | "auto">("manual");
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  
  // CRITICAL: Use ref to track dialog lock state - refs persist across parent re-renders
  // Unlike useState, refs survive when parent component re-renders due to query invalidation
  const dialogLockRef = useRef<boolean>(false);
  const closingIntentionallyRef = useRef<boolean>(false);
  // Track the scanId we locked for - prevents re-locking after scanId clears
  const lockedScanIdRef = useRef<string | null>(null);
  // CRITICAL: Guard against duplicate onRequestUpload calls - only one call per session
  const uploadRequestedRef = useRef<boolean>(false);
  
  // State that controls actual dialog visibility
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Lock dialog open when parent requests opening with a valid scanId
  useEffect(() => {
    // Only lock if:
    // 1. Parent wants to open (open=true)
    // 2. We're not already locked
    // 3. We have a valid scanId
    // 4. We haven't intentionally closed (prevents infinite loop)
    if (open && !dialogLockRef.current && scanId && !closingIntentionallyRef.current) {
      dialogLockRef.current = true;
      closingIntentionallyRef.current = false;
      lockedScanIdRef.current = scanId;
      uploadRequestedRef.current = false; // Reset upload guard for new session
      setInternalOpen(true);
    }
  }, [open, scanId]);
  
  // ESCAPE HATCH: Close dialog when scanId becomes null OR changes to different scan
  // This prevents orphaned dialogs when user navigates away or selects different scan
  useEffect(() => {
    if (dialogLockRef.current && lockedScanIdRef.current) {
      // If scanId cleared or changed to different value, close the dialog
      if (scanId === null || (scanId !== lockedScanIdRef.current)) {
        closingIntentionallyRef.current = true;
        dialogLockRef.current = false;
        lockedScanIdRef.current = null;
        setInternalOpen(false);
        setSessionId(null);
        setRiskAcknowledged(false);
      }
    }
  }, [scanId]);
  
  // Use internal state for dialog visibility
  const effectiveOpen = internalOpen && dialogLockRef.current;
  
  // Internal close function that actually closes the dialog
  const closeDialogInternal = useCallback(() => {
    // Mark that we're closing intentionally
    closingIntentionallyRef.current = true;
    dialogLockRef.current = false;
    
    // Reset internal state
    setSessionId(null);
    setRiskAcknowledged(false);
    setInternalOpen(false);
    
    // Notify parent
    if (onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  }, [onClose, onOpenChange]);
  
  // Handler for dialog open change - ONLY allows closing via our internal function
  const handleOpenChange = useCallback((newOpen: boolean) => {
    // CRITICAL: Completely ignore all close attempts from external sources
    // Dialog can ONLY be closed via closeDialogInternal (user button clicks)
    if (!newOpen) {
      // Check if this is an intentional close
      if (!closingIntentionallyRef.current) {
        // Not intentional - ignore
        return;
      }
    }
    // Allow opening
    if (newOpen) {
      dialogLockRef.current = true;
      closingIntentionallyRef.current = false;
      setInternalOpen(true);
    }
  }, []);
  
  // Helper function to close the dialog - wraps closeDialogInternal for backwards compatibility
  const closeDialog = closeDialogInternal;
  
  // CRITICAL: Safe upload request function that prevents duplicate calls
  // This guards against re-renders causing multiple upload triggers
  const safeRequestUpload = useCallback(() => {
    // Guard: Only allow one upload request per dialog session
    if (uploadRequestedRef.current) {
      console.log('[PostFixDialog] Upload already requested - ignoring duplicate call');
      return;
    }
    
    // DEBUG: Log stack trace to find what's calling this
    console.log('[PostFixDialog] Requesting upload (first call for this session)');
    console.log('[PostFixDialog] STACK TRACE:', new Error().stack);
    uploadRequestedRef.current = true;
    
    // Close the dialog first
    closeDialogInternal();
    
    // Then trigger the upload callback
    if (onRequestUpload) {
      onRequestUpload();
    } else if (onValidationComplete) {
      onValidationComplete();
    }
  }, [closeDialogInternal, onRequestUpload, onValidationComplete]);
  
  // MINIMIZATION TEMPORARILY DISABLED DUE TO HOOKS VIOLATIONS
  // Will need to be re-implemented using different architecture
  // const { addMinimizedDialog, removeMinimizedDialog } = useMinimizedDialogs();
  // const [isMinimized, setIsMinimized] = useState(false);

  // CRITICAL: Call custom hook that returns other hooks
  // This must be called unconditionally on every render
  const postFixValidation = usePostFixValidation(scanType, scanId);
  
  // Extract the hooks from the returned object
  const {
    validatePostFix,
    useValidationSession,
    generateManualFix,
    createAutoFixPayment,
    confirmPayment,
    useAutomatedFixJob,
  } = postFixValidation;

  // CRITICAL: These hooks MUST be called unconditionally on every render
  // Pass null when we don't have the ID yet - the hook handles this with 'enabled' option
  const sessionQuery = useValidationSession(sessionId);
  const session = sessionQuery.data;

  const jobQuery = useAutomatedFixJob(session?.automatedFixJobId || null);
  const job = jobQuery.data;

  // Fetch the scan data to check if fixes were already applied
  const { data: scanData, isLoading: isScanDataLoading } = useQuery({
    queryKey: [`/api/${scanType}-scans`, scanId],
    enabled: !!scanId,
  });

  // When fix job completes, invalidate scan query to get updated fixesApplied flag
  useEffect(() => {
    if (job?.status === "completed" && scanId) {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/${scanType}-scans`, scanId] 
      });
    }
  }, [job?.status, scanId, scanType]);

  // Trigger validation once when dialog opens with valid scanId
  useEffect(() => {
    console.log('[PostFixDialog] useEffect triggered:', { open, scanId, sessionId, shouldValidate: !!(open && scanId && !sessionId) });
    if (open && scanId && !sessionId) {
      console.log('[PostFixDialog] Triggering validation mutation');
      // Only trigger if we don't already have a session ID
      // Don't check validatePostFix.isPending to avoid race conditions
      validatePostFix.mutate(undefined, {
        onSuccess: (data) => {
          console.log('[PostFixDialog] Validation started, sessionId:', data.id);
          setSessionId(data.id);
          // Don't show toast here - wait for polling to complete and status to change from 'running'
        },
        onError: (error: any) => {
          toast({
            title: "Validation Failed",
            description: error.message || "Failed to start validation",
            variant: "destructive",
          });
        },
      });
    }
  }, [open, scanId, sessionId]);

  // Reset sessionId when dialog INTENTIONALLY closes for fresh validation on reopen
  // We check both !open and closingIntentionallyRef to avoid resetting during query invalidation
  useEffect(() => {
    if (!effectiveOpen && closingIntentionallyRef.current) {
      setSessionId(null);
    }
  }, [effectiveOpen]);

  // Reset riskAcknowledged when dialog INTENTIONALLY closes
  useEffect(() => {
    if (!effectiveOpen && closingIntentionallyRef.current) {
      setRiskAcknowledged(false);
    }
  }, [effectiveOpen]);

  // Show toast when validation completes (after polling)
  useEffect(() => {
    if (session && session.postFixValidationStatus !== 'running') {
      const issueCount = (session.postFixIssues as any[])?.length || 0;
      
      if (session.postFixValidationStatus === 'passed' && issueCount === 0) {
        toast({
          title: "Validation Passed",
          description: "No issues found. You can proceed with upload.",
        });
      } else if (session.postFixValidationStatus === 'failed' && issueCount > 0) {
        toast({
          title: "Issues Found",
          description: `Found ${issueCount} security issue${issueCount !== 1 ? 's' : ''} that need to be fixed.`,
          variant: "destructive",
        });
      }
    }
  }, [session?.postFixValidationStatus, session?.postFixIssues]);

  const handleGenerateManualFix = () => {
    generateManualFix.mutate(undefined, {
      onSuccess: (data) => {
        // Sync sessionId to ensure we're tracking the latest session
        if (data.id && data.id !== sessionId) {
          setSessionId(data.id);
        }
        toast({
          title: "Manual Fix Code Generated",
          description: "Code snippets are ready to copy",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate fix code",
          variant: "destructive",
        });
      },
    });
  };

  // State to track payment flow
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const handleStartAutoFix = () => {
    // Auto-fix is now FREE - directly start the fix job without payment
    if (sessionId) {
      setPaymentProcessing(true);
      confirmPayment.mutate(sessionId, {
        onSuccess: () => {
          // Invalidate session query to refetch with new automatedFixJobId
          queryClient.invalidateQueries({ 
            queryKey: ["/api/fix-validation-sessions", sessionId] 
          });
          
          toast({
            title: "Automated Fix Started",
            description: "AI is now applying security fixes to your application...",
          });
        },
        onError: (error: any) => {
          setPaymentProcessing(false);
          toast({
            title: "Failed to Start Auto-Fix",
            description: error.message || "Could not start automated fix",
            variant: "destructive",
          });
        },
      });
    }
  };

  const handlePaymentComplete = () => {
    // Step 2: Called AFTER user completes Stripe payment form
    if (sessionId) {
      setPaymentProcessing(true);
      confirmPayment.mutate(sessionId, {
        onSuccess: () => {
          // Don't hide payment form immediately - wait for job to be available
          // The UI will automatically transition to job progress view
          
          // Invalidate session query to refetch with new automatedFixJobId
          queryClient.invalidateQueries({ 
            queryKey: ["/api/fix-validation-sessions", sessionId] 
          });
          
          toast({
            title: "Payment Confirmed",
            description: "Automated fix job is starting...",
          });
        },
        onError: (error: any) => {
          setPaymentProcessing(false);
          toast({
            title: "Payment Failed",
            description: error.message || "Failed to process payment",
            variant: "destructive",
          });
        },
      });
    }
  };
  
  // Once job is available, reset payment states
  useEffect(() => {
    if (job && paymentProcessing) {
      setShowStripePayment(false);
      setPaymentClientSecret(null);
      setPaymentProcessing(false);
    }
  }, [job, paymentProcessing]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  // Prevent dialog from closing on outside click or Escape - user must click a button
  const preventDialogClose = (e: Event) => {
    e.preventDefault();
  };

  // CRITICAL: Use effectiveOpen (internal lock) instead of parent's open prop
  // This ensures the dialog stays visible even when parent state changes during data refetches
  if (!effectiveOpen) return null;

  if (!sessionId || validatePostFix.isPending) {
    return (
      <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
        <DialogContent 
          data-testid="dialog-post-fix-validation"
          onInteractOutside={preventDialogClose}
          onEscapeKeyDown={preventDialogClose}
          hideCloseButton
        >
          <DialogHeader>
            <DialogTitle>Scanning Application...</DialogTitle>
            <DialogDescription>
              Running comprehensive security scan to detect vulnerabilities
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-validation" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (sessionQuery.isLoading || isScanDataLoading) {
    return (
      <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
        <DialogContent 
          data-testid="dialog-post-fix-validation"
          onInteractOutside={preventDialogClose}
          onEscapeKeyDown={preventDialogClose}
          hideCloseButton
        >
          <DialogHeader>
            <DialogTitle>Loading Validation Results...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!session) {
    return null;
  }

  // Safely handle postFixIssues which might be undefined or null
  const postFixIssues = (session.postFixIssues as any[]) || [];
  const issueCount = postFixIssues.length;
  const hasIssues = issueCount > 0;

  // Get destination info based on scan type and actual scan data
  const getDestinationInfo = () => {
    const scan = scanData as any;
    
    // Get destination based on scan type - prioritize specific fields per type
    let actualDestination: string | null = null;
    
    switch (scanType) {
      case "mvp":
        // For MVP scans, use repositoryUrl or platform-based store name
        actualDestination = scan?.autoUploadDestination || 
                           scan?.repositoryUrl ||
                           (scan?.platform ? `${scan.platform.charAt(0).toUpperCase() + scan.platform.slice(1)} Repository` : null);
        return {
          title: actualDestination || "App Store Deployment",
          description: actualDestination 
            ? `Ready to upload to ${actualDestination}` 
            : "Ready to upload to iOS App Store or Google Play Store",
          Icon: Smartphone
        };
      case "mobile":
        // For mobile scans, use platform-based app store name
        actualDestination = scan?.autoUploadDestination ||
                           (scan?.platform ? `${scan.platform === "ios" ? "iOS" : "Android"} App Store` : null);
        if (scan?.appId) {
          actualDestination = actualDestination ? `${actualDestination} (${scan.appId})` : scan.appId;
        }
        return {
          title: actualDestination || "Mobile App Update",
          description: actualDestination
            ? `Ready to re-upload to ${actualDestination}`
            : "Ready to re-upload to your app distribution platform",
          Icon: Smartphone
        };
      case "web":
        // For web scans, prioritize appUrl over hostingPlatform
        // Skip "other" as a destination name - it's not meaningful to users
        const hostingPlatform = scan?.hostingPlatform;
        const isValidHosting = hostingPlatform && hostingPlatform !== "other";
        actualDestination = scan?.autoUploadDestination ||
                           scan?.appUrl ||
                           scan?.targetUrl ||
                           (isValidHosting ? hostingPlatform : null);
        return {
          title: actualDestination || "Web Deployment",
          description: actualDestination
            ? `Ready to deploy to ${actualDestination}`
            : "Ready to deploy to your hosting platform",
          Icon: Globe
        };
      default:
        actualDestination = scan?.autoUploadDestination || 
                           scan?.deploymentUrl ||
                           scan?.targetUrl;
        return {
          title: actualDestination || "Deployment Ready",
          description: actualDestination
            ? `Ready to upload to ${actualDestination}`
            : "Ready to upload",
          Icon: Upload
        };
    }
  };

  const destination = getDestinationInfo();

  // Track if automated fixes were already applied to the scan
  const scanHasFixesApplied = (scanData as any)?.fixesApplied === true;
  const isAutoFixCompleted = job?.status === "completed";

  // ALWAYS show fix options dialog with Manual Fix / Auto-Fix tabs
  // User requested to skip the "Application Validated Successfully" view

  return (
    <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" 
        data-testid="dialog-post-fix-validation"
        onInteractOutside={preventDialogClose}
        onEscapeKeyDown={preventDialogClose}
        hideCloseButton
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Choose Your Fix Method: {issueCount} Issues Found
              </DialogTitle>
              <DialogDescription>
                Review the security issues below and choose how you want to fix them: manually (free code snippets) or automatically (AI-powered free automated fixes)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable main content area - ensure proper scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="pr-4 space-y-3 pb-4">
            {/* Validation Results Summary */}
            <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm text-yellow-900 dark:text-yellow-100">
                  Security Scan Results
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  Scan found {issueCount} security issue{issueCount !== 1 ? 's' : ''} that need to be fixed:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-gray-900 p-2 rounded">
                    <span className="text-muted-foreground">Scan Type:</span>
                    <span className="ml-2 font-medium">{scanType.toUpperCase()}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-2 rounded">
                    <span className="text-muted-foreground">Destination:</span>
                    <span className="ml-2 font-medium">{destination.title}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Automated Fixes May Break Other Code</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-sm">
                  Applying security fixes can introduce breaking changes to other parts of your application. 
                  We strongly recommend:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li>Review all fix locations before applying</li>
                  <li>Test thoroughly after fixes are applied</li>
                  <li>Have a rollback plan ready</li>
                </ul>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox 
                    id="risk-acknowledge-issues"
                    checked={riskAcknowledged}
                    onCheckedChange={(checked) => setRiskAcknowledged(checked as boolean)}
                    data-testid="checkbox-risk-acknowledgement"
                  />
                  <Label htmlFor="risk-acknowledge-issues" className="text-sm font-semibold cursor-pointer">
                    I understand the risks and want to proceed
                  </Label>
                </div>
              </AlertDescription>
            </Alert>

            {/* Tabs for Manual vs Auto Fix */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "manual" | "auto")} className="mt-3">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-fix-options">
              <TabsTrigger value="manual" disabled={!riskAcknowledged} data-testid="tab-manual-fix">
                Manual Fix (Free)
              </TabsTrigger>
              <TabsTrigger value="auto" disabled={!riskAcknowledged} data-testid="tab-auto-fix">
                Auto-Fix (Free)
              </TabsTrigger>
            </TabsList>

              <TabsContent value="manual" className="space-y-4 mt-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Manual Fix Code Snippets</CardTitle>
                    <CardDescription>
                      Copy these code snippets and apply them manually in your IDE
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {generateManualFix.isPending ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating AI-powered fix snippets...</span>
                      </div>
                    ) : !session.manualFixSnippets || (Array.isArray(session.manualFixSnippets) && session.manualFixSnippets.length === 0) ? (
                      <Button
                        onClick={handleGenerateManualFix}
                        disabled={!riskAcknowledged}
                        data-testid="button-generate-manual-fix"
                      >
                        Generate Fix Code
                      </Button>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {((session.manualFixSnippets as any[]) || []).map((snippet: FixSnippet, idx: number) => (
                          <Card key={idx} data-testid={`card-snippet-${idx}`}>
                            <CardHeader>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base">{snippet.issueTitle}</CardTitle>
                                  <CardDescription className="break-all">
                                    {snippet.file}:{snippet.line}
                                    {snippet.function && ` in ${snippet.function}()`}
                                  </CardDescription>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyToClipboard(snippet.code, "Code snippet")}
                                  data-testid={`button-copy-snippet-${idx}`}
                                  className="shrink-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground mb-2">{snippet.description}</p>
                              <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                                <code className="text-xs">{snippet.code}</code>
                              </pre>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => closeDialog()} data-testid="button-cancel-validation">
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    onClick={(e: React.MouseEvent) => {
                      // CRITICAL: Only respond to actual user clicks (trusted events)
                      if (!e.isTrusted) {
                        console.log('[PostFixDialog] Ignoring non-trusted click event on Proceed button');
                        return;
                      }
                      console.log('[PostFixDialog] User clicked Proceed to Upload button');
                      safeRequestUpload();
                    }}
                    disabled={!riskAcknowledged}
                    data-testid="button-proceed-upload"
                  >
                    Proceed to Upload
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="auto" className="space-y-4 mt-3">
                <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Automated Fix Service</CardTitle>
                  <CardDescription>
                    AI-powered automated fixes with post-fix validation and comprehensive testing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!job && !scanHasFixesApplied ? (
                      <div className="space-y-4">
                        {/* What's Included - Free Auto-Fix */}
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                          <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Free Automated Fix Service</h4>
                          <p className="text-sm text-green-800 dark:text-green-200">
                            AI-powered security fixes are included at no cost. {issueCount} issue{issueCount !== 1 ? 's' : ''} will be automatically fixed.
                          </p>
                        </div>

                        {/* What's Included */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">What's Included:</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              <span>AI-powered security fixes for all {issueCount} issues</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              <span>Post-fix validation to verify fixes don't break code</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              <span>Comprehensive testing before deployment</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              <span>Ready-to-deploy application with all security issues resolved</span>
                            </li>
                          </ul>
                        </div>

                        {/* Show Processing or Apply Fixes Button */}
                        {paymentProcessing || (session?.automatedFixJobId && !job) ? (
                          <div className="space-y-4">
                            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                              <AlertTitle className="text-blue-900 dark:text-blue-100">Applying Fixes</AlertTitle>
                              <AlertDescription className="text-blue-800 dark:text-blue-200">
                                AI is applying security fixes to your application...
                              </AlertDescription>
                            </Alert>
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <Button
                              onClick={handleStartAutoFix}
                              disabled={!riskAcknowledged || confirmPayment.isPending}
                              className="w-full"
                              size="lg"
                              data-testid="button-start-auto-fix"
                            >
                              {confirmPayment.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Starting Auto-Fix...
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Apply Automated Fixes
                                </>
                              )}
                            </Button>
                            
                            <p className="text-xs text-center text-muted-foreground">
                              Click to automatically fix all {issueCount} security issues. After completion, you can upload to your destination of choice.
                            </p>
                          </>
                        )}
                      </div>
                    ) : scanHasFixesApplied && !job ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Automated fixes already applied!</span>
                        </div>
                        
                        {/* Fix Summary */}
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                          <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Fix Summary</h4>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Issues Fixed:</span>
                            <span className="ml-2 font-medium">{session.postFixIssues?.length || issueCount || 0}</span>
                          </div>
                        </div>
                        
                        {/* Upload Ready Alert - No button here, button is in footer */}
                        <Alert>
                          <Upload className="h-4 w-4" />
                          <AlertTitle>Ready for Deployment</AlertTitle>
                          <AlertDescription>
                            <p className="text-sm">
                              Your application has been automatically fixed and is ready to upload to {destination.title}.
                            </p>
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : job ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Status: <Badge>{job.status}</Badge>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {job.issuesFixed || 0} / {issueCount} fixed
                          </span>
                        </div>
                        <Progress value={job.progress} data-testid="progress-auto-fix" />
                        {job.currentTask && (
                          <p className="text-sm text-muted-foreground" data-testid="text-current-task">
                            {job.currentTask}
                          </p>
                        )}
                        {job.status === "completed" && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="font-medium">All fixes applied successfully!</span>
                            </div>
                            
                            {/* Fix Summary */}
                            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                              <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Fix Summary</h4>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Issues Fixed:</span>
                                  <span className="ml-2 font-medium">{job.issuesFixed || 0}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Completed:</span>
                                  <span className="ml-2 font-medium">
                                    {job.completedAt ? new Date(job.completedAt).toLocaleString() : 'Just now'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Testing Phase */}
                            {job.testStatus === 'running' && (
                              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                                <AlertTitle className="text-blue-900 dark:text-blue-100">Running Comprehensive Tests</AlertTitle>
                                <AlertDescription className="text-blue-800 dark:text-blue-200">
                                  <p className="text-sm mb-2">Verifying fixes don't break application functionality...</p>
                                  <Progress value={job.testProgress || 0} className="h-2" data-testid="progress-tests" />
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Tests Passed - Ready for Upload */}
                            {job.testStatus === 'passed' && (
                              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertTitle className="text-green-900 dark:text-green-100">All Tests Passed!</AlertTitle>
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                  <p className="text-sm">{job.testSummary || 'Application is ready for deployment.'}</p>
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Tests Failed - Show Manual Fix Fallback */}
                            {job.testStatus === 'failed' && (
                              <div className="space-y-4">
                                <Alert variant="destructive">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertTitle>Tests Failed - Manual Fixes Required</AlertTitle>
                                  <AlertDescription>
                                    <p className="text-sm mb-2">{job.testSummary || 'Some tests failed after applying fixes.'}</p>
                                    <p className="text-sm">Please use the manual fix code snippets below to resolve the issues safely.</p>
                                  </AlertDescription>
                                </Alert>
                                
                                {/* Test Failure Details */}
                                {job.testDetails && (
                                  <Card className="bg-muted/50">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">Test Results</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Passed Suites:</span>
                                          <span className="font-medium text-green-600">{(job.testDetails as any)?.passedSuites || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Failed Suites:</span>
                                          <span className="font-medium text-red-600">{(job.testDetails as any)?.failedSuites?.length || 0}</span>
                                        </div>
                                        {(job.testDetails as any)?.failedSuites?.length > 0 && (
                                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs">
                                            <p className="font-medium text-red-800 dark:text-red-200 mb-1">Failed:</p>
                                            <ul className="list-disc list-inside text-red-700 dark:text-red-300">
                                              {(job.testDetails as any).failedSuites.map((suite: string, i: number) => (
                                                <li key={i}>{suite}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {(job.testDetails as any)?.logs?.length > 0 && (
                                          <details className="mt-2">
                                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">View Test Logs</summary>
                                            <ScrollArea className="h-32 mt-2 rounded border bg-background p-2">
                                              <pre className="text-xs whitespace-pre-wrap">
                                                {(job.testDetails as any).logs.join('\n')}
                                              </pre>
                                              <ScrollBar orientation="vertical" />
                                            </ScrollArea>
                                          </details>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}
                                
                                {/* Manual Fix Snippets - Generate button */}
                                <Button
                                  onClick={handleGenerateManualFix}
                                  disabled={generateManualFix.isPending}
                                  variant="outline"
                                  className="w-full"
                                  data-testid="button-generate-manual-fix-after-test-failure"
                                >
                                  {generateManualFix.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Generating Manual Fix Code...
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="mr-2 h-4 w-4" />
                                      Generate Manual Fix Code Snippets
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}

                            {/* Ready for Upload - only show if tests not running and (passed or not tested yet) */}
                            {job.testStatus !== 'running' && job.testStatus !== 'failed' && job.testStatus !== 'passed' && (
                              <Alert>
                                <Upload className="h-4 w-4" />
                                <AlertTitle>Ready for Deployment</AlertTitle>
                                <AlertDescription>
                                  <p className="text-sm">
                                    Fixes have been validated and your application is ready to upload to {destination.title}.
                                  </p>
                                </AlertDescription>
                              </Alert>
                            )}

                          </div>
                        )}
                        
                        {/* Action buttons when job is in progress (not completed) */}
                        {/* Only show Close button during progress - Upload button only appears after completion */}
                        {job.status !== "completed" && (
                          <div className="flex justify-end gap-3 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => closeDialog()}
                              data-testid="button-cancel-in-progress"
                            >
                              Close
                            </Button>
                            {/* Note: Upload button removed from in-progress state to prevent accidental uploads */}
                            {/* Upload is only available in the footer after job completes */}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                {/* Padding to ensure content doesn't get cut off */}
                <div className="h-4" />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Fixed Footer with Upload Button - OUTSIDE scrollable area, at Dialog level */}
        {/* Show upload button when:
            - Zero issues found (issueCount === 0) - nothing to fix, ready to upload, OR
            - All fixes are applied (issuesFixed equals issueCount), OR
            - Job status is "completed" or "validating" (fixes done, validation in progress), OR
            - Legacy scans with fixes applied */}
        {(
          // CASE 1: Zero issues found - always show upload button regardless of tab
          (issueCount === 0 && session?.postFixValidationStatus === 'passed') ||
          // CASE 2: Auto-fix flow with fixes completed
          (activeTab === "auto" && (
            (job?.status === "completed") || 
            (job?.status === "validating" && job?.issuesFixed === issueCount && issueCount > 0) ||
            (job?.issuesFixed === issueCount && issueCount > 0) ||
            (scanHasFixesApplied && !job)
          ))
        ) && (
          <DialogFooter className="shrink-0 border-t pt-4 bg-background">
            <div className="flex flex-col gap-2 w-full">
              {issueCount === 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 text-center">
                  No security issues found! Your application is ready for upload.
                </p>
              )}
              {job?.status === "validating" && issueCount > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-400 text-center">
                  All fixes applied! Validation is running. You can proceed to upload now or wait for validation to complete.
                </p>
              )}
              {job?.testStatus === "running" && job?.status !== "validating" && (
                <p className="text-sm text-blue-600 dark:text-blue-400 text-center">
                  Comprehensive tests are still running. You can upload now or wait for tests to complete.
                </p>
              )}
              {job?.testStatus === "failed" && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
                  Some tests failed. You can still upload, but review the issues first.
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeDialog()}
                  className="flex-1"
                  size="lg"
                  data-testid="button-close-dialog"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    // CRITICAL: Only respond to actual user clicks (trusted events)
                    if (!e.isTrusted) {
                      console.log('[PostFixDialog] Ignoring non-trusted click event on Upload button');
                      return;
                    }
                    console.log('[PostFixDialog] User clicked Upload Fixed App button - proceeding to upload options');
                    // NOTE: No toast here - the upload hasn't started yet, we're just opening the upload options dialog
                    safeRequestUpload();
                  }}
                  className="flex-1"
                  size="lg"
                  data-testid="button-upload-after-completion"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  Proceed to Upload
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
        </DialogContent>
      </Dialog>
    );
  }
