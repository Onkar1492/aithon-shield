import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, AlertCircle, Zap, DollarSign, Shield, Minimize2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { MockStripeForm } from "@/components/MockStripeForm";
import { useGlobalFixJob } from "@/hooks/useGlobalFixJob";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMinimizedDialogs } from "@/contexts/MinimizedDialogContext";

// Load Stripe with the publishable key (starts with pk_test_ or pk_live_)
// This key is safe to use in frontend code and required for Stripe.js
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Check if we should use mock Stripe form for E2E testing
const useMockStripe = import.meta.env.VITE_E2E_MOCK_STRIPE === 'true';

interface GlobalFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (jobId: string) => void;
}

function PaymentForm({ clientSecret, jobId, amount, demoMode, onSuccess }: {
  clientSecret: string | null;
  jobId: string;
  amount: number;
  demoMode: boolean;
  onSuccess: () => void;
}) {
  // Only call Stripe hooks when NOT in demo mode
  const stripe = !demoMode ? useStripe() : null;
  const elements = !demoMode ? useElements() : null;
  const { toast } = useToast();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentError(null);

    try {
      if (demoMode) {
        // Demo mode - skip Stripe validation but still await backend confirmation
        const response = await apiRequest("POST", `/api/global-fix-jobs/${jobId}/confirm-payment`, {
          demoMode: true,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to confirm payment");
        }
        
        onSuccess();
        return;
      }

      if (!stripe || !elements || !clientSecret) {
        throw new Error("Payment system not ready");
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Payment validation failed");
      }

      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
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
        throw new Error(error.message || "Payment failed");
      }

      // Payment succeeded with Stripe, now confirm with backend
      const response = await apiRequest("POST", `/api/global-fix-jobs/${jobId}/confirm-payment`, {
        demoMode: false,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to confirm payment with server");
      }

      onSuccess();
    } catch (error: any) {
      setPaymentError(error.message || "An error occurred during payment");
      toast({
        title: "Payment Failed",
        description: error.message || "An error occurred during payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {!demoMode && clientSecret && (
        <>
          {/* Test Mode Instructions */}
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Test Mode - Use Test Card Data</p>
                <p className="text-sm text-blue-800 dark:text-blue-200">Use these test card details for payment:</p>
                <div className="text-sm font-mono bg-blue-100 dark:bg-blue-900 p-2 rounded mt-1">
                  <div>Card: 4242 4242 4242 4242</div>
                  <div>Expiry: Any future date (e.g., 12/34)</div>
                  <div>CVC: Any 3 digits (e.g., 123)</div>
                  <div>ZIP: Any 5 digits (e.g., 12345)</div>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Note: Phone number field is not required</p>
              </div>
            </div>
          </Card>
          <div className="border rounded-lg p-4 relative">
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
        </>
      )}
      
      {demoMode && (
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/50">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm font-medium">Demo Mode - No actual payment required</p>
          </div>
        </Card>
      )}

      {paymentError && (
        <Card className="p-3 bg-destructive/10 border-destructive/50">
          <p className="text-sm text-destructive">{paymentError}</p>
        </Card>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">${(amount / 100).toFixed(2)}</p>
        </div>
        <Button
          onClick={handlePayment}
          disabled={isProcessing || (!demoMode && (!stripe || !elements || !isPaymentElementReady))}
          size="lg"
          data-testid="button-confirm-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm & Start Fixes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function GlobalFixDialog({ open, onOpenChange, onSuccess }: GlobalFixDialogProps) {
  const [step, setStep] = useState<'init' | 'loading' | 'payment' | 'processing'>('init');
  const { createJob, isCreatingJob, createJobData } = useGlobalFixJob();
  const { toast } = useToast();
  const { addMinimizedDialog, removeMinimizedDialog } = useMinimizedDialogs();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isStartingFree, setIsStartingFree] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('init');
      setIsMinimized(false);
    }
  }, [open]);

  const handleStart = () => {
    setStep('loading');
    createJob();
  };

  // Move to payment step when job data is available
  useEffect(() => {
    if (createJobData && step === 'loading') {
      setStep('payment');
    }
  }, [createJobData, step]);

  const handlePaymentSuccess = async () => {
    // If using mock Stripe, need to call backend confirmation endpoint
    if (useMockStripe && createJobData?.jobId) {
      try {
        const response = await apiRequest("POST", `/api/global-fix-jobs/${createJobData.jobId}/confirm-payment`, {
          demoMode: true,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to confirm payment");
        }
      } catch (error: any) {
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to confirm payment with server",
          variant: "destructive",
        });
        return;
      }
    }
    
    setStep('processing');
    toast({
      title: "Fixes Started",
      description: "Processing fixes across all your scans. You'll be notified when each scan completes.",
    });
    
    // Close dialog and notify parent
    setTimeout(() => {
      onOpenChange(false);
      onSuccess?.(createJobData.jobId);
    }, 1500);
  };

  // Handler for free fixes - calls backend confirmation directly
  const handleFreeFixesStart = async () => {
    if (!createJobData?.jobId) return;
    
    setIsStartingFree(true);
    try {
      const response = await apiRequest("POST", `/api/global-fix-jobs/${createJobData.jobId}/confirm-payment`, {
        demoMode: true, // Free fixes are treated like demo mode (no actual payment)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to start fixes");
      }
      
      setStep('processing');
      toast({
        title: "Fixes Started",
        description: "Processing free fixes across all your scans. You'll be notified when each scan completes.",
      });
      
      // Close dialog and notify parent
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.(createJobData.jobId);
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Failed to Start Fixes",
        description: error.message || "An error occurred while starting fixes",
        variant: "destructive",
      });
    } finally {
      setIsStartingFree(false);
    }
  };

  const scanBreakdown = createJobData?.scanBreakdown || [];
  const totalIssues = createJobData?.totalIssues || 0;
  const totalScans = createJobData?.totalScans || 0;
  const totalAmount = createJobData?.totalAmount || 0;
  const freeIssueCount = createJobData?.freeIssueCount || 0;
  const paidIssueCount = createJobData?.paidIssueCount || 0;
  const perIssueAmount = 200; // $2.00

  const handleMinimize = () => {
    // Only allow minimization during payment step
    if (step !== 'payment') return;
    
    setIsMinimized(true);
    // Don't call onOpenChange(false) to keep dialog state intact
    
    addMinimizedDialog({
      id: 'global-fix-dialog',
      title: `Fix All Issues - ${totalScans} Scans, ${totalIssues} Issues`,
      type: 'global-fix',
      blockedWorkflow: 'global-fix',
      onRestore: () => {
        // Simply reset minimized state to show dialog again
        setIsMinimized(false);
      },
      onClose: () => {
        // User dismissed the minimized dialog - close it properly
        setIsMinimized(false);
        onOpenChange(false);
      }
    });
  };

  // Cleanup minimized dialog when dialog is properly closed
  useEffect(() => {
    if (!open && !isMinimized) {
      removeMinimizedDialog('global-fix-dialog');
    }
  }, [open, isMinimized, removeMinimizedDialog]);

  // When minimized, we don't want the dialog to show at all
  if (isMinimized) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-global-fix">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Fix All Unresolved Issues
              </DialogTitle>
              <DialogDescription>
                Apply AI-powered security fixes across all your scans with a single payment
              </DialogDescription>
            </div>
            {step === 'payment' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                data-testid="button-minimize-global-fix"
                className="h-8 w-8"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {step === 'init' && (
          <div className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-blue-500/10 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Comprehensive Security Fix</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI will analyze and fix all unresolved security issues across every scan type - MVP, Mobile, Web, CI/CD, Container, Network, and Code Linter.
                  </p>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Features Included:</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Sequential fix application across all scan types
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Comprehensive validation after each fix
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Per-scan upload decisions (optional testing)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Real-time progress tracking & notifications
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Graceful failure handling with partial success support
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Tiered Pricing</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issues found within 30 days</span>
                  <span className="font-medium text-green-600 dark:text-green-400">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issues older than 30 days</span>
                  <span className="font-medium">${(perIssueAmount / 100).toFixed(2)} each</span>
                </div>
              </div>
            </div>

            <Card className="p-3 bg-blue-500/10 border-blue-500/20">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                <span className="font-medium">Note:</span> After clicking "Start", we'll analyze all your scans and show you a detailed breakdown of affected scans and total cost before payment.
              </p>
            </Card>

            <Button
              onClick={handleStart}
              disabled={isCreatingJob}
              className="w-full"
              size="lg"
              data-testid="button-start-global-fix"
            >
              {isCreatingJob ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Scans...
                </>
              ) : (
                'Start Global Fix'
              )}
            </Button>
          </div>
        )}

        {step === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Analyzing all unresolved issues...</p>
          </div>
        )}

        {step === 'payment' && createJobData && (
          <ScrollArea className="max-h-[600px] pr-4">
            <div className="space-y-6">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Fix Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Scans</span>
                    <Badge variant="secondary">{totalScans}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Issues</span>
                    <Badge variant="destructive">{totalIssues}</Badge>
                  </div>
                </div>

                {/* Tiered Pricing Breakdown */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pricing Breakdown:</p>
                  <div className="space-y-2">
                    {freeIssueCount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Issues within 30 days</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                            {freeIssueCount} FREE
                          </Badge>
                        </div>
                      </div>
                    )}
                    {paidIssueCount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Issues older than 30 days</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            {paidIssueCount} x ${(perIssueAmount / 100).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Breakdown by Scan:</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {scanBreakdown.map((scan: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="truncate flex-1">{scan.scanName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {scan.scanType}
                          </Badge>
                          <span className="font-medium w-12 text-right">{scan.issueCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* If all issues are free, show free confirmation button */}
              {totalAmount === 0 ? (
                <Card className="p-4 bg-green-500/10 border-green-500/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-700 dark:text-green-300">All Issues Qualify for Free Fixes</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All {totalIssues} issues were found within the last 30 days and qualify for our free fix program. No payment required.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleFreeFixesStart}
                    disabled={isStartingFree}
                    className="w-full mt-4"
                    size="lg"
                    data-testid="button-confirm-free-fixes"
                  >
                    {isStartingFree ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Starting Fixes...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Start Free Fixes
                      </>
                    )}
                  </Button>
                </Card>
              ) : useMockStripe ? (
                <MockStripeForm
                  onSuccess={handlePaymentSuccess}
                  amount={totalAmount}
                />
              ) : !createJobData.demoMode && createJobData.clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret: createJobData.clientSecret }}>
                  <PaymentForm
                    clientSecret={createJobData.clientSecret}
                    jobId={createJobData.jobId}
                    amount={totalAmount}
                    demoMode={false}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              ) : (
                <PaymentForm
                  clientSecret={null}
                  jobId={createJobData.jobId}
                  amount={totalAmount}
                  demoMode={true}
                  onSuccess={handlePaymentSuccess}
                />
              )}
            </div>
          </ScrollArea>
        )}

        {step === 'processing' && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="font-semibold mb-2">{totalAmount > 0 ? 'Payment Confirmed!' : 'Fixes Started!'}</p>
            <p className="text-sm text-muted-foreground text-center">
              Processing fixes across all scans. You'll receive notifications as each scan completes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
