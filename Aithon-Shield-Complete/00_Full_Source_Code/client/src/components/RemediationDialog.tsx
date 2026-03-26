import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, Check, ExternalLink, AlertTriangle, Info, CheckCircle2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isFindingResolved } from "@/lib/findings";
import { ReuploadReminder } from "./ReuploadReminder";
import type { FixConfidencePayload } from "@shared/fixConfidence";
import {
  formatScaReachabilityLabel,
  isScaReachabilityValue,
  SCA_REACHABILITY_DESCRIPTIONS,
} from "@shared/scaReachability";

interface RemediationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findingTitle: string;
  severity: string;
  findingId?: string;
  fixesApplied?: boolean | null;
  status?: string | null;
  onApplyFix?: () => void;
  fixConfidence?: FixConfidencePayload | null;
  /** MVP SCA dependency findings */
  category?: string | null;
  scaReachability?: string | null;
}

interface FileLocation {
  file: string;
  line: number;
  function: string | null;
  description: string;
}

export function RemediationDialog({ 
  open, 
  onOpenChange, 
  findingTitle,
  severity,
  findingId,
  fixesApplied = false,
  status,
  onApplyFix,
  fixConfidence,
  category,
  scaReachability,
}: RemediationDialogProps) {
  const isResolved = isFindingResolved({ fixesApplied: fixesApplied || false, status });
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [fileLocations, setFileLocations] = useState<FileLocation[]>([]);
  const { toast } = useToast();

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateFix = async () => {
    if (!findingId) {
      toast({
        title: "Error",
        description: "Finding ID is required to validate fix",
        variant: "destructive",
      });
      return false;
    }

    setValidating(true);
    
    try {
      // Validate the fix against the codebase
      // This analyzes if the security fix would break other parts
      const response = await apiRequest("POST", `/api/findings/${findingId}/validate-fix`, {});
      const data = await response.json() as { 
        isValid: boolean; 
        issues?: string[];
        fileLocations?: FileLocation[];
      };
      
      setValidating(false);
      
      if (!data.isValid && data.issues && data.issues.length > 0) {
        setValidationIssues(data.issues);
        setFileLocations(data.fileLocations || []);
        setShowValidationWarning(true);
        return false;
      }
      
      return true;
    } catch (error: any) {
      setValidating(false);
      // If validation endpoint doesn't exist or fails, proceed with caution
      // Show warning that validation couldn't be performed
      setValidationIssues([
        "Unable to validate fix against codebase",
        "The fix may affect other parts of your application",
        "Manual testing is recommended"
      ]);
      setShowValidationWarning(true);
      return false;
    }
  };

  const handleApplyFix = async () => {
    if (!findingId) {
      toast({
        title: "Error",
        description: "Finding ID is required to apply fix",
        variant: "destructive",
      });
      return;
    }

    // First validate the fix
    const isValidated = await validateFix();
    
    if (!isValidated) {
      // Validation failed, warning modal is shown
      return;
    }

    setApplying(true);
    
    try {
      // Update the finding status to "resolved"
      await apiRequest("PATCH", `/api/findings/${findingId}`, {
        status: "resolved",
      });
      
      // Invalidate findings query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      
      toast({
        title: "Security Fix Applied",
        description: `The security fix for "${findingTitle}" has been marked as resolved. Note: This app only fixes cybersecurity issues - other code issues must be addressed separately.`,
      });
      
      setApplying(false);
      onOpenChange(false);
      
      // Call the optional callback
      if (onApplyFix) {
        onApplyFix();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply fix",
        variant: "destructive",
      });
      setApplying(false);
    }
  };

  const vulnerableCode = `// Vulnerable Code
router.get('/api/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id);
  res.json(order);
});`;

  const fixedCode = `// Fixed Code - AI Recommendation
router.get('/api/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id);
  
  // Verify order belongs to authenticated user
  if (!order || order.userId !== req.user.id) {
    return res.status(403).json({ 
      error: 'Access denied' 
    });
  }
  
  res.json(order);
});`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>AI-Powered Remediation</DialogTitle>
          </div>
          <DialogDescription>
            {findingTitle}
          </DialogDescription>
        </DialogHeader>

        {fixConfidence && (
          <Card className="p-4 border-border bg-muted/30">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Fix confidence</span>
                  <Badge variant="secondary" className="font-semibold tabular-nums">
                    {fixConfidence.score}%
                  </Badge>
                  <Badge variant="outline" className="capitalize text-xs">
                    Side effects: {fixConfidence.sideEffectRisk}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {fixConfidence.explainability}
                </p>
              </div>
            </div>
          </Card>
        )}

        {category === "Dependency Vulnerability" && scaReachability && isScaReachabilityValue(scaReachability) && (
          <Card className="p-4 border-border bg-muted/20">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">SCA reachability (heuristic)</span>
                  <Badge variant="outline" className="text-xs">
                    {formatScaReachabilityLabel(scaReachability)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {SCA_REACHABILITY_DESCRIPTIONS[scaReachability]}
                </p>
              </div>
            </div>
          </Card>
        )}

        {isResolved && (
          <ReuploadReminder findingId={findingId} className="mt-4" />
        )}

        <Tabs defaultValue="fix" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fix">Code Fix</TabsTrigger>
            <TabsTrigger value="explanation">Explanation</TabsTrigger>
            <TabsTrigger value="prevention">Prevention</TabsTrigger>
          </TabsList>

          <TabsContent value="fix" className="space-y-4 mt-4">
            {/* Security Fix Disclaimer */}
            <Card className="p-3 bg-primary/5 border-primary/20 shadow-sm">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Security Fix Only</p>
                  <p>
                    This fix addresses the <strong>cybersecurity vulnerability</strong> identified in your code. 
                    Before applying, the system will validate it won't break other parts of your application. 
                    If conflicts are detected, you'll be able to copy the fix and apply it manually using your own tools.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-muted/50 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Vulnerable Code</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopyCode(vulnerableCode)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="text-xs font-mono bg-background p-3 rounded-md overflow-x-auto">
                <code>{vulnerableCode}</code>
              </pre>
            </Card>

            <Card className="p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">AI-Generated Fix</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopyCode(fixedCode)}
                  data-testid="button-copy-fix"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="text-xs font-mono bg-background p-3 rounded-md overflow-x-auto">
                <code className="text-primary">{fixedCode}</code>
              </pre>
            </Card>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Dependencies Required</h3>
              <div className="flex gap-2">
                <Badge variant="outline">No additional dependencies</Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="explanation" className="space-y-4 mt-4">
            <Card className="p-4 shadow-sm">
              <h3 className="font-semibold mb-2">Vulnerability Analysis</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The current implementation allows any authenticated user to access any order by simply knowing the order ID. This is a classic Insecure Direct Object Reference (IDOR) vulnerability.
              </p>
              
              <h3 className="font-semibold mb-2 mt-4">Risk Assessment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact:</span>
                  <Badge className="bg-severity-critical/10 text-severity-critical">Critical</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exploitability:</span>
                  <Badge variant="outline">High</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data at Risk:</span>
                  <span className="font-medium">Customer PII, Order Details, Payment Info</span>
                </div>
              </div>

              <h3 className="font-semibold mb-2 mt-4">How the Fix Works</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Validates that the requested order belongs to the authenticated user</li>
                <li>Returns 403 Forbidden if authorization check fails</li>
                <li>Prevents horizontal privilege escalation attacks</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="prevention" className="space-y-4 mt-4">
            <Card className="p-4 shadow-sm">
              <h3 className="font-semibold mb-3">Best Practices to Prevent Similar Issues</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium mb-1">1. Implement Authorization Middleware</h4>
                  <p className="text-muted-foreground">
                    Create reusable middleware that automatically checks resource ownership before serving requests.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">2. Use Attribute-Based Access Control (ABAC)</h4>
                  <p className="text-muted-foreground">
                    Implement fine-grained access controls based on user attributes and resource properties.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">3. Implement Database-Level Security</h4>
                  <p className="text-muted-foreground">
                    Use Row-Level Security (RLS) policies in your database to enforce access controls at the data layer.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">4. Regular Security Audits</h4>
                  <p className="text-muted-foreground">
                    Schedule automated scans and manual code reviews to catch similar vulnerabilities early.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Additional Resources</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• OWASP Top 10 - A01:2021 Broken Access Control</li>
                    <li>• CWE-639: Authorization Bypass Through User-Controlled Key</li>
                    <li>• NIST Cybersecurity Framework - Access Control Guidelines</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-row justify-between">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-close-remediation"
          >
            Close
          </Button>
          {isResolved ? (
            <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400 px-4 py-2">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Fixes Applied - Resolved
            </Badge>
          ) : (
            <Button 
              onClick={handleApplyFix}
              data-testid="button-apply-fix"
              disabled={applying || validating}
            >
              {validating ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : applying ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply Fix"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Validation Warning Dialog */}
      <AlertDialog open={showValidationWarning} onOpenChange={setShowValidationWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>Fix May Break Other Code</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              <p>
                Our validation system detected that applying this security fix might cause issues 
                in other parts of your application:
              </p>
              <Card className="p-3 bg-destructive/5 border-destructive/20">
                <ul className="text-sm space-y-2">
                  {validationIssues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-destructive mt-0.5">•</span>
                      <span className="text-muted-foreground">{issue}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* File Locations for Manual Fix Application */}
              {fileLocations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Where to Apply This Fix Manually:
                  </p>
                  <div className="space-y-2">
                    {fileLocations.map((location, idx) => (
                      <Card key={idx} className="p-3 bg-muted/50">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <code className="text-xs font-mono text-primary break-all">
                              {location.file}:{location.line}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 flex-shrink-0"
                              onClick={() => {
                                const locationText = location.function 
                                  ? `${location.file}:${location.line} (${location.function})`
                                  : `${location.file}:${location.line}`;
                                navigator.clipboard.writeText(locationText);
                                toast({
                                  title: "Location Copied",
                                  description: "File location copied to clipboard",
                                });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {location.function && (
                            <p className="text-xs text-muted-foreground">
                              Function: <code className="font-mono">{location.function}</code>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {location.description}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm font-semibold text-foreground mb-1">
                  <Info className="inline w-4 h-4 mr-1" />
                  Recommended Action
                </p>
                <p className="text-xs text-muted-foreground">
                  Copy the security fix code and apply it manually at the locations shown above. 
                  This allows you to test and resolve any conflicts before deployment.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Important:</strong> Aithon Shield only addresses cybersecurity vulnerabilities. 
                Any general code fixes or refactoring needed to integrate this security fix must be handled separately by your development team.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-validation">
              Close
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                handleCopyCode(fixedCode);
                setShowValidationWarning(false);
                toast({
                  title: "Security Fix Copied",
                  description: "The fix code has been copied to your clipboard. Apply it manually in your development environment.",
                });
              }}
              data-testid="button-copy-manual-fix"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Fix & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
