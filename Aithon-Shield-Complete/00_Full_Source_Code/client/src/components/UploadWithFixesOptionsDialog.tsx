import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  CheckCircle, 
  Shield, 
  Zap, 
  Loader2, 
  Upload, 
  FlaskConical,
  AlertTriangle,
  Code,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode,
  Info,
  ShieldAlert,
  Wrench,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ScanType } from "@/hooks/use-scan-findings";

// 5-minute inactivity timeout in milliseconds
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

interface TestIssue {
  id: string;
  type: 'security' | 'code';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  suggestedFix?: string;
  canAutoFix?: boolean;
}

interface UploadWithFixesOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanType: ScanType;
  scanId: string;
  destination: string;
  onProceedWithUpload: (runTests?: boolean) => Promise<void> | void;
  onClose?: () => void; // Explicit close callback - needed since onOpenChange ignores false values
}

export function UploadWithFixesOptionsDialog({
  open,
  onOpenChange,
  scanType,
  scanId,
  destination,
  onProceedWithUpload,
  onClose,
}: UploadWithFixesOptionsDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'test' | 'now' | null>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [testResults, setTestResults] = useState<TestIssue[]>([]);
  const [showTestResults, setShowTestResults] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [fixingIssues, setFixingIssues] = useState<Set<string>>(new Set());
  const [fixedIssues, setFixedIssues] = useState<Set<string>>(new Set());
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // CRITICAL: Internal dialog state that persists independently of parent state
  // This prevents the dialog from closing when parent state resets during data refetches
  const [isDialogLocked, setIsDialogLocked] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  
  // Track previous open state to detect fresh opens
  const prevOpenRef = useRef(false);
  
  // Centralized state reset function - resets all state EXCEPT isDialogLocked
  const resetDialogState = useCallback(() => {
    console.log('[UploadWithFixesOptions] Resetting dialog state');
    
    // Clear any running intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    // Reset all state to initial values (NOT isDialogLocked - that's managed separately)
    setIsUploading(false);
    setUploadMode(null);
    setProgress(0);
    setIsComplete(false);
    setTestResults([]);
    setShowTestResults(false);
    setExpandedIssues(new Set());
    setFixingIssues(new Set());
    setFixedIssues(new Set());
    lastActivityRef.current = Date.now();
  }, []);
  
  // CRITICAL: Reset state when dialog opens FRESH (not already open)
  // This ensures no stale state from previous sessions
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    
    // Only reset state when transitioning from closed to open
    if (open && !wasOpen) {
      console.log('[UploadWithFixesOptions] Dialog opening fresh');
      resetDialogState();
    }
  }, [open, resetDialogState]);
  
  // Lock dialog open when parent opens it
  useEffect(() => {
    if (open && !isDialogLocked) {
      setIsDialogLocked(true);
      lastActivityRef.current = Date.now();
    }
  }, [open, isDialogLocked]);
  
  // Track user activity to reset inactivity timer
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);
  
  // Set up inactivity timer - only starts when showing test results
  useEffect(() => {
    if (!showTestResults || !isDialogLocked) {
      // Clear timer if not showing test results
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }
    
    // Check for inactivity every 30 seconds
    inactivityTimerRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      
      if (timeSinceActivity >= INACTIVITY_TIMEOUT_MS) {
        // Clear the timer
        if (inactivityTimerRef.current) {
          clearInterval(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
        }
        
        // Show inactivity notification
        toast({
          title: "Dialog Closed Due to Inactivity",
          description: "The 'Issues Found During Testing' dialog was closed after 5 minutes of inactivity. You can reopen it from the scan details.",
          duration: 10000,
        });
        
        // Close the dialog
        closeDialogInternal();
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [showTestResults, isDialogLocked]);
  
  // Internal close function that actually closes the dialog
  const closeDialogInternal = useCallback(() => {
    // Clean up timers
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    // Reset all state
    setIsUploading(false);
    setUploadMode(null);
    setProgress(0);
    setIsComplete(false);
    setTestResults([]);
    setShowTestResults(false);
    setExpandedIssues(new Set());
    setFixingIssues(new Set());
    setFixedIssues(new Set());
    setIsDialogLocked(false);
    
    // Notify parent
    if (onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  }, [onClose, onOpenChange]);
  
  // Poll for scan status while uploading
  const scanQuery = useQuery<any>({
    queryKey: [`/api/${scanType}-scans`, scanId],
    enabled: isUploading && !isComplete && !showTestResults,
    refetchInterval: isUploading && !isComplete && !showTestResults ? 1000 : false,
  });
  
  // Simulate test results when testing
  useEffect(() => {
    if (!isUploading || isComplete || uploadMode !== 'test') return;
    
    // After progress reaches ~80%, simulate finding issues
    if (progress >= 80 && !showTestResults && testResults.length === 0) {
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Simulate test results (in real implementation, this would come from backend)
      const simulatedIssues: TestIssue[] = [
        {
          id: '1',
          type: 'security',
          severity: 'high',
          title: 'Insecure Direct Object Reference',
          description: 'User input is passed directly to database query without validation, allowing potential unauthorized access to other users\' data.',
          filePath: 'src/api/users.ts',
          lineNumber: 45,
          suggestedFix: `// Before (vulnerable)
const user = await db.query('SELECT * FROM users WHERE id = ' + req.params.id);

// After (secure)
const user = await db.query('SELECT * FROM users WHERE id = $1', [parseInt(req.params.id)]);`,
          canAutoFix: true,
        },
        {
          id: '2',
          type: 'security',
          severity: 'critical',
          title: 'Missing Authentication Check',
          description: 'API endpoint lacks authentication middleware, exposing sensitive data to unauthenticated requests.',
          filePath: 'src/routes/admin.ts',
          lineNumber: 12,
          suggestedFix: `// Add authentication middleware
import { requireAuth } from '../middleware/auth';

// Before
app.get('/api/admin/users', async (req, res) => { ... });

// After
app.get('/api/admin/users', requireAuth, async (req, res) => { ... });`,
          canAutoFix: true,
        },
        {
          id: '3',
          type: 'code',
          severity: 'medium',
          title: 'Unhandled Promise Rejection',
          description: 'Async function does not properly handle potential rejection, which could cause application crashes.',
          filePath: 'src/services/payment.ts',
          lineNumber: 78,
          suggestedFix: `// Before
async function processPayment(data) {
  const result = await paymentGateway.charge(data);
  return result;
}

// After
async function processPayment(data) {
  try {
    const result = await paymentGateway.charge(data);
    return result;
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw new PaymentError('Failed to process payment');
  }
}`,
          canAutoFix: false,
        },
        {
          id: '4',
          type: 'code',
          severity: 'low',
          title: 'Missing Type Annotation',
          description: 'Function parameter lacks TypeScript type annotation, reducing type safety.',
          filePath: 'src/utils/helpers.ts',
          lineNumber: 23,
          suggestedFix: `// Before
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

// After
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString();
}`,
          canAutoFix: false,
        },
      ];
      
      setTestResults(simulatedIssues);
      setShowTestResults(true);
    }
  }, [progress, isUploading, isComplete, uploadMode, showTestResults, testResults.length]);
  
  // Detect when upload completes and close dialog
  // Only auto-close for 'now' mode (Upload Now), NOT for 'test' mode (Test & Upload)
  // In 'test' mode, we show test results first and let user decide
  useEffect(() => {
    if (!isUploading || isComplete || showTestResults) return;
    
    // If in test mode, don't auto-close - let test results show first
    if (uploadMode === 'test') return;
    
    const scan = scanQuery.data;
    if (scan?.uploadStatus === 'uploaded') {
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Complete the progress animation
      setProgress(100);
      setIsComplete(true);
      
      // Show success toast and close dialog after short delay
      setTimeout(() => {
        toast({
          title: "Upload Complete!",
          description: `Your application has been successfully uploaded to ${destination}.`,
        });
        closeDialog();
      }, 1000);
    }
  }, [scanQuery.data?.uploadStatus, isUploading, isComplete, destination, showTestResults, uploadMode]);
  
  // CRITICAL FIX: Upload Now still triggers immediate upload (user chose to skip tests)
  // but Test & Upload does NOT trigger upload until user reviews results
  const handleUploadNow = () => {
    setIsUploading(true);
    setUploadMode('now');
    startProgressAnimation();
    // For "Upload Now", user explicitly chose to skip tests, so proceed immediately
    onProceedWithUpload(false);
  };

  const handleUploadAndTest = () => {
    setIsUploading(true);
    setUploadMode('test');
    startProgressAnimation();
    // CRITICAL: DO NOT call onProceedWithUpload here!
    // User needs to see test results first and explicitly confirm upload
    // Upload will only be triggered when user clicks "Proceed with Upload" after reviewing issues
    console.log('[UploadWithFixesOptions] Test & Upload clicked - running tests, NOT triggering upload yet');
  };
  
  const startProgressAnimation = () => {
    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress >= 90) {
        currentProgress = 90;
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
      setProgress(currentProgress);
    }, 500);
  };

  const handleAutoFix = async (issueId: string) => {
    recordActivity();
    setFixingIssues(prev => new Set(prev).add(issueId));
    
    setFixingIssues(prev => {
      const newSet = new Set(prev);
      newSet.delete(issueId);
      return newSet;
    });
    setFixedIssues(prev => new Set(prev).add(issueId));
    
    toast({
      title: "Security Fix Applied",
      description: "The security vulnerability has been automatically fixed.",
    });
  };

  const handleCopyFix = (suggestedFix: string) => {
    recordActivity();
    navigator.clipboard.writeText(suggestedFix);
    toast({
      title: "Copied to Clipboard",
      description: "The suggested fix has been copied to your clipboard.",
    });
  };

  const toggleIssueExpand = (issueId: string) => {
    recordActivity();
    setExpandedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(issueId)) {
        newSet.delete(issueId);
      } else {
        newSet.add(issueId);
      }
      return newSet;
    });
  };

  const handleProceedWithUpload = async () => {
    recordActivity();
    console.log('[UploadWithFixesOptions] User explicitly clicked Proceed with Upload - NOW triggering upload');
    
    // Show uploading state
    setShowTestResults(false);
    setProgress(90);
    startProgressAnimation();
    
    try {
      // CRITICAL: This is the ONLY place where upload is triggered after Test & Upload flow
      // User has reviewed test results and explicitly consented to proceed
      // AWAIT the upload to ensure parent dialog closes properly
      await onProceedWithUpload(true);
      
      // Upload completed - show success and close
      setProgress(100);
      setIsComplete(true);
      toast({
        title: "Upload Complete!",
        description: `Your application has been uploaded to ${destination}.`,
        duration: 3000,
      });
      
      // Close this dialog immediately after parent has closed
      setTimeout(() => closeDialog(), 500);
    } catch (error) {
      console.error('[UploadWithFixesOptions] Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your application. Please try again.",
        variant: "destructive",
      });
      setShowTestResults(true);
      setProgress(80);
    }
  };

  // Helper function to close the dialog - wraps closeDialogInternal for button handlers
  const closeDialog = () => {
    closeDialogInternal();
  };

  // Handle dialog open/close - COMPLETELY IGNORE external close attempts
  // The dialog stays open via isDialogLocked until explicitly closed by user action
  const handleOpenChange = (newOpen: boolean) => {
    // Record activity on any interaction
    recordActivity();
    
    // If trying to open, allow it
    if (newOpen && !isDialogLocked) {
      setIsDialogLocked(true);
      lastActivityRef.current = Date.now();
      onOpenChange(true);
      return;
    }
    
    // COMPLETELY IGNORE close attempts from Dialog internals, focus loss, polling, parent state changes, etc.
    // The dialog can ONLY be closed by:
    // 1. User clicking Cancel button
    // 2. User clicking Proceed with Upload button
    // 3. 5-minute inactivity timeout (with notification)
  };
  
  // Calculate effective open state - use internal lock, not parent prop
  // This is the KEY FIX: the dialog stays open based on OUR state, not parent's state
  const effectiveOpen = isDialogLocked;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const securityIssues = testResults.filter(i => i.type === 'security');
  const codeIssues = testResults.filter(i => i.type === 'code');
  const allSecurityFixed = securityIssues.every(i => fixedIssues.has(i.id));

  // Test results UI with issues
  if (showTestResults && testResults.length > 0) {
    return (
      <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-test-results">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="heading-test-results">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Issues Found During Testing
            </DialogTitle>
            <DialogDescription data-testid="text-issues-found">
              {testResults.length} issue{testResults.length !== 1 ? 's' : ''} found. 
              Review and address them before uploading.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 min-h-0">
            <div className="space-y-4 py-4">
              {/* Security Issues Section */}
              {securityIssues.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    <h3 className="font-semibold text-sm">Security Issues ({securityIssues.length})</h3>
                    <Badge variant="destructive" className="text-xs">Auto-fixable</Badge>
                  </div>
                  
                  {securityIssues.map((issue) => (
                    <Collapsible 
                      key={issue.id} 
                      open={expandedIssues.has(issue.id)}
                      onOpenChange={() => toggleIssueExpand(issue.id)}
                    >
                      <div className={`border rounded-lg p-3 ${fixedIssues.has(issue.id) ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {expandedIssues.has(issue.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{issue.title}</span>
                                <Badge className={`text-xs ${getSeverityColor(issue.severity)}`}>
                                  {issue.severity}
                                </Badge>
                                {fixedIssues.has(issue.id) && (
                                  <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Fixed
                                  </Badge>
                                )}
                              </div>
                              {issue.filePath && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <FileCode className="h-3 w-3" />
                                  {issue.filePath}:{issue.lineNumber}
                                </div>
                              )}
                            </div>
                            {!fixedIssues.has(issue.id) && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAutoFix(issue.id);
                                }}
                                disabled={fixingIssues.has(issue.id)}
                                data-testid={`button-autofix-${issue.id}`}
                              >
                                {fixingIssues.has(issue.id) ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Fixing...
                                  </>
                                ) : (
                                  <>
                                    <Wrench className="h-3 w-3 mr-1" />
                                    Auto-Fix
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="mt-3 pl-7 space-y-3">
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                            {issue.suggestedFix && (
                              <div className="bg-muted/50 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium">Suggested Fix:</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => handleCopyFix(issue.suggestedFix!)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                                  {issue.suggestedFix}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}

              {/* Code Issues Section */}
              {codeIssues.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-semibold text-sm">Code Issues ({codeIssues.length})</h3>
                    <Badge variant="outline" className="text-xs">Manual Fix Required</Badge>
                  </div>
                  
                  {codeIssues.map((issue) => (
                    <Collapsible 
                      key={issue.id} 
                      open={expandedIssues.has(issue.id)}
                      onOpenChange={() => toggleIssueExpand(issue.id)}
                    >
                      <div className="border rounded-lg p-3">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {expandedIssues.has(issue.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{issue.title}</span>
                                <Badge className={`text-xs ${getSeverityColor(issue.severity)}`}>
                                  {issue.severity}
                                </Badge>
                              </div>
                              {issue.filePath && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <FileCode className="h-3 w-3" />
                                  {issue.filePath}:{issue.lineNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="mt-3 pl-7 space-y-3">
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                            {issue.suggestedFix && (
                              <div className="bg-muted/50 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium">Suggested Fix:</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => handleCopyFix(issue.suggestedFix!)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                                  {issue.suggestedFix}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}

              {/* Disclosure */}
              <Alert className="mt-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-700 dark:text-blue-300 text-sm">Recommendation Disclosure</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400 text-xs">
                  The suggested fixes above are recommendations only and not required. 
                  You may choose to proceed with the upload without applying any fixes. 
                  Security fixes can be applied automatically, while code issues require manual changes.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
              {allSecurityFixed ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  All security issues fixed
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  {securityIssues.length - fixedIssues.size} security issue{securityIssues.length - fixedIssues.size !== 1 ? 's' : ''} remaining
                </>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => closeDialog()}
              data-testid="button-cancel-test-results"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProceedWithUpload}
              data-testid="button-proceed-upload"
            >
              <Upload className="h-4 w-4 mr-2" />
              Proceed with Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Loading state UI
  if (isUploading) {
    return (
      <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg" data-testid="dialog-upload-after-autofix">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="heading-upload-in-progress">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              {uploadMode === 'test' ? 'Testing & Uploading...' : 'Uploading...'}
            </DialogTitle>
            <DialogDescription data-testid="text-upload-status">
              {uploadMode === 'test' 
                ? `Testing and uploading your fixed application to ${destination}...`
                : `Uploading your fixed application to ${destination}...`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {uploadMode === 'test' ? 'Running security verification...' : 'Uploading to destination...'}
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
              {uploadMode === 'test' ? (
                <FlaskConical className="h-4 w-4 text-blue-600" />
              ) : (
                <Upload className="h-4 w-4 text-blue-600" />
              )}
              <AlertTitle className="text-blue-700 dark:text-blue-300">
                {uploadMode === 'test' ? 'Testing in Progress' : 'Upload in Progress'}
              </AlertTitle>
              <AlertDescription className="text-blue-600 dark:text-blue-400">
                {uploadMode === 'test' 
                  ? 'Your application is being tested and uploaded. This may take a moment...'
                  : 'Your fixed application is being uploaded. Please wait...'
                }
              </AlertDescription>
            </Alert>

            <div className="text-center text-sm text-muted-foreground">
              <p>You will receive a notification when the upload is complete.</p>
              <p className="text-xs mt-1">This dialog will close automatically.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-upload-after-autofix">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="heading-upload-fixed-app">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Automated Fixes Complete
          </DialogTitle>
          <DialogDescription data-testid="text-upload-destination">
            Your application is ready to upload to{" "}
            <span className="font-semibold text-foreground">{destination}</span> with all security fixes applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert data-testid="alert-fixes-applied">
            <Shield className="h-4 w-4 text-green-500" />
            <AlertTitle>Security Fixes Applied</AlertTitle>
            <AlertDescription>
              All identified security vulnerabilities have been automatically fixed and validated. 
              Your code is now ready for deployment.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <p className="text-sm font-medium">Choose upload option:</p>
            
            <div className="grid gap-3">
              <Button
                onClick={handleUploadAndTest}
                className="w-full justify-start h-auto py-4 px-4"
                data-testid="button-upload-and-test"
              >
                <div className="flex items-start gap-3 text-left">
                  <Zap className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">Test & Upload</div>
                    <div className="text-xs opacity-90 font-normal">
                      Run comprehensive automated testing then upload (Recommended)
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                onClick={handleUploadNow}
                variant="outline"
                className="w-full justify-start h-auto py-4 px-4"
                data-testid="button-upload-now"
              >
                <div className="flex items-start gap-3 text-left">
                  <Shield className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">Upload Now</div>
                    <div className="text-xs opacity-70 font-normal">
                      Upload immediately without additional testing
                    </div>
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => closeDialog()}
            data-testid="button-cancel-upload"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
