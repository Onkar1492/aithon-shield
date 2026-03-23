import { MetricCard } from "@/components/MetricCard";
import { FindingCard } from "@/components/FindingCard";
import { SeverityChart } from "@/components/SeverityChart";
import { ProjectCard } from "@/components/ProjectCard";
import { ScanProgressCard } from "@/components/ScanProgressCard";
import { RemediationDialog } from "@/components/RemediationDialog";
import { NewAppWorkflowDialog } from "@/components/NewAppWorkflowDialog";
import { ExistingAppWorkflowDialog } from "@/components/ExistingAppWorkflowDialog";
import { GlobalFixDialog } from "@/components/GlobalFixDialog";
import { GlobalFixProgressDialog } from "@/components/GlobalFixProgressDialog";
import { SecurityHealthScore } from "@/components/SecurityHealthScore";
import { RiskMapVisualization } from "@/components/RiskMapVisualization";
import { ThreatFeed } from "@/components/ThreatFeed";
import { PriorityWidget } from "@/components/PriorityWidget";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Clock, AlertTriangle, CheckCircle, Code, Smartphone, Globe, TrendingUp, Zap } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Finding as DBFinding, MvpCodeScan, MobileAppScan, WebAppScan } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { isFindingResolved } from "@/lib/findings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMinimizedDialogs } from "@/contexts/MinimizedDialogContext";

interface Finding {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  fixesApplied?: boolean | null;
  status?: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [newAppWorkflowOpen, setNewAppWorkflowOpen] = useState(false);
  const [existingAppWorkflowOpen, setExistingAppWorkflowOpen] = useState(false);
  const [globalFixOpen, setGlobalFixOpen] = useState(false);
  const [globalFixJobId, setGlobalFixJobId] = useState<string | null>(null);
  const [globalFixProgressOpen, setGlobalFixProgressOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isWorkflowBlocked, restoreDialog } = useMinimizedDialogs();

  // Fetch recent findings from API
  const { data: allFindings } = useQuery<DBFinding[]>({
    queryKey: ["/api/findings"],
    refetchInterval: 3000, // Auto-refresh every 3 seconds to update Industry Benchmark
  });

  // Fetch scans from all types
  const { data: mvpScans = [] } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  const { data: mobileScans = [] } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
    refetchInterval: 3000,
  });

  const { data: webScans = [] } = useQuery<WebAppScan[]>({
    queryKey: ["/api/web-scans"],
    refetchInterval: 3000,
  });

  // Get top 5 recent findings (by risk score) for dashboard display
  const recentFindings = allFindings
    ?.slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5) || [];

  // Combine all scans and get most recent/active ones
  type CombinedScan = {
    id: string;
    name: string;
    type: "mvp" | "mobile" | "web";
    status: "running" | "completed" | "failed" | "pending";
    progress: number;
    phase: string;
    createdAt: Date;
  };

  const allScans: CombinedScan[] = [
    ...mvpScans.map(scan => ({
      id: scan.id,
      name: scan.projectName,
      type: "mvp" as const,
      status: scan.scanStatus === "scanning" ? "running" as const : 
              scan.scanStatus === "completed" ? "completed" as const : 
              scan.scanStatus === "failed" ? "failed" as const : 
              scan.scanStatus === "pending" ? "pending" as const : "running" as const,
      progress: scan.scanStatus === "completed" ? 100 : 
                scan.scanStatus === "scanning" ? 50 : 
                scan.scanStatus === "pending" ? 0 : 0,
      phase: scan.scanStatus === "completed" ? "Scan completed" : 
             scan.scanStatus === "scanning" ? "Analyzing code security..." : 
             scan.scanStatus === "pending" ? "Pending" : "Pending",
      createdAt: scan.createdAt,
    })),
    ...mobileScans.map(scan => ({
      id: scan.id,
      name: scan.appName,
      type: "mobile" as const,
      status: scan.scanStatus === "scanning" ? "running" as const : 
              scan.scanStatus === "completed" ? "completed" as const : 
              scan.scanStatus === "failed" ? "failed" as const : 
              scan.scanStatus === "pending" ? "pending" as const : "running" as const,
      progress: scan.scanStatus === "completed" ? 100 : 
                scan.scanStatus === "scanning" ? 50 : 
                scan.scanStatus === "pending" ? 0 : 0,
      phase: scan.scanStatus === "completed" ? "Scan completed" : 
             scan.scanStatus === "scanning" ? "Testing mobile vulnerabilities..." : 
             scan.scanStatus === "pending" ? "Pending" : "Pending",
      createdAt: scan.createdAt,
    })),
    ...webScans.map(scan => ({
      id: scan.id,
      name: scan.appName,
      type: "web" as const,
      status: scan.scanStatus === "scanning" ? "running" as const : 
              scan.scanStatus === "completed" ? "completed" as const : 
              scan.scanStatus === "failed" ? "failed" as const : 
              scan.scanStatus === "pending" ? "pending" as const : "running" as const,
      progress: scan.scanStatus === "completed" ? 100 : 
                scan.scanStatus === "scanning" ? 50 : 
                scan.scanStatus === "pending" ? 0 : 0,
      phase: scan.scanStatus === "completed" ? "Scan completed" : 
             scan.scanStatus === "scanning" ? "Testing OWASP Top 10..." : 
             scan.scanStatus === "pending" ? "Pending" : "Pending",
      createdAt: scan.createdAt,
    })),
  ];

  // Get most recent 5 scans, prioritizing running scans
  const activeScans = allScans
    .sort((a, b) => {
      // Running scans first
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      // Then by created date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5);

  // Calculate dashboard metrics from actual data
  const totalFindings = allFindings?.length || 0;
  
  // Calculate status counts first (needed for health score)
  const resolvedCount = allFindings?.filter(f => isFindingResolved(f)).length || 0;
  const inProgressCount = allFindings?.filter(f => f.status === "in-progress").length || 0;
  const openCount = allFindings?.filter(f => f.status === "open").length || 0;
  
  // Only count OPEN and IN-PROGRESS findings for severity penalties (resolved findings don't count)
  const activeFindings = allFindings?.filter(f => f.status === "open" || f.status === "in-progress") || [];
  const criticalCount = allFindings?.filter(f => f.severity === "CRITICAL").length || 0;
  const highCount = allFindings?.filter(f => f.severity === "HIGH").length || 0;
  const mediumCount = allFindings?.filter(f => f.severity === "MEDIUM").length || 0;
  const activeCriticalCount = activeFindings.filter(f => f.severity === "CRITICAL").length;
  const activeHighCount = activeFindings.filter(f => f.severity === "HIGH").length;
  const activeMediumCount = activeFindings.filter(f => f.severity === "MEDIUM").length;
  
  // Calculate security health score (100 - weighted penalty for ACTIVE findings only)
  const calculateHealthScore = () => {
    if (totalFindings === 0) return 100;
    // Only penalize open and in-progress findings, not resolved ones
    const criticalPenalty = activeCriticalCount * 10;
    const highPenalty = activeHighCount * 5;
    const mediumPenalty = activeMediumCount * 2;
    const totalPenalty = criticalPenalty + highPenalty + mediumPenalty;
    // Add bonus points for resolving findings
    const resolutionBonus = Math.min(20, resolvedCount * 2);
    return Math.max(0, Math.min(100, 100 - totalPenalty + resolutionBonus));
  };
  const healthScore = calculateHealthScore();
  
  // Calculate scan success rate
  const completedScans = allScans.filter(s => s.status === "completed").length;
  const failedScans = allScans.filter(s => s.status === "failed").length;
  const totalCompletedOrFailed = completedScans + failedScans;
  const successRate = totalCompletedOrFailed > 0 
    ? Math.round((completedScans / totalCompletedOrFailed) * 100) 
    : 0; // Show 0% when no scans exist

  // Track pending scan notifications
  const previousRunningScansRef = useRef<number>(0);
  const pendingNotificationShownRef = useRef<boolean>(false);

  // Monitor for pending scans when active scans complete
  useEffect(() => {
    const runningScans = allScans.filter(s => s.status === "running");
    const pendingScans = allScans.filter(s => s.status === "pending");
    
    // Check if active scans just completed and there are pending scans
    if (
      previousRunningScansRef.current > 0 && 
      runningScans.length === 0 && 
      pendingScans.length > 0 &&
      !pendingNotificationShownRef.current
    ) {
      pendingNotificationShownRef.current = true;
      toast({
        title: "Active Scans Completed",
        description: `You have ${pendingScans.length} pending scan${pendingScans.length > 1 ? 's' : ''}. Would you like to start them now?`,
        action: (
          <ToastAction 
            altText="View Pending Scans" 
            onClick={() => setLocation("/scans")}
          >
            View Scans
          </ToastAction>
        ),
        duration: 10000,
      });
    }
    
    // Reset notification flag when new scans start running
    if (runningScans.length > 0) {
      pendingNotificationShownRef.current = false;
    }
    
    previousRunningScansRef.current = runningScans.length;
  }, [allScans, toast, setLocation]);

  // Helper function to map database status to FindingCard status
  const mapStatus = (status: string): "OPEN" | "IN_PROGRESS" | "RESOLVED" => {
    const statusMap: Record<string, "OPEN" | "IN_PROGRESS" | "RESOLVED"> = {
      "open": "OPEN",
      "in-progress": "IN_PROGRESS",
      "resolved": "RESOLVED"
    };
    return statusMap[status.toLowerCase()] || "OPEN";
  };

  const rescanMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("POST", `/api/findings/${findingId}/rescan`);
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Re-scan initiated",
        description: "The finding is being re-scanned for updated security analysis",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate re-scan",
        variant: "destructive",
      });
    },
  });

  const handleOpenRemediation = (finding: Finding) => {
    setSelectedFinding(finding);
    setRemediationOpen(true);
  };

  const handleRescan = (id: string) => {
    rescanMutation.mutate(id);
  };

  const handleApplyFix = () => {
    // Invalidate queries to refresh the findings lists
    queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/findings/archived"] });
  };

  const navigateToFindings = (params?: { severity?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.severity) queryParams.set("severity", params.severity);
    if (params?.status) queryParams.set("status", params.status);
    const queryString = queryParams.toString();
    setLocation(`/findings${queryString ? `?${queryString}` : ""}`);
  };

  const handleHealthScoreClick = () => {
    navigateToFindings({ status: "open" });
  };

  const handleOpenFindingsClick = () => {
    navigateToFindings({ status: "open" });
  };

  const handleCriticalIssuesClick = () => {
    navigateToFindings({ severity: "critical", status: "open" });
  };

  const handleScanSuccessClick = () => {
    setLocation("/scans");
  };

  const handleScanClick = (scanId: string, scanType: "mvp" | "mobile" | "web") => {
    setLocation(`/scan-details/${scanType}/${scanId}`);
  };

  const handleGlobalFixSuccess = (jobId: string) => {
    setGlobalFixJobId(jobId);
    setGlobalFixProgressOpen(true);
  };

  // Count unresolved findings
  const unresolvedFindings = allFindings?.filter(f => !isFindingResolved(f)) || [];
  const hasUnresolvedIssues = unresolvedFindings.length > 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Aithon Shield</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Cybersecurity Testing & Remediation Platform
          </p>
        </div>
      </div>

      {/* Start Your Security Assessment Heading */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-4">Start Your Security Assessment</h2>
      </div>

      {/* Choose Your Workflow Section */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Choose Your Workflow</h2>
            <p className="text-sm text-muted-foreground">
              Start with a new application or work with an existing one
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              size="lg"
              variant="outline"
              className="group h-auto py-6 flex flex-col items-start gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary active:bg-primary/90 transition-all"
              onClick={() => setNewAppWorkflowOpen(true)}
              data-testid="button-new-app-workflow"
            >
              <div className="flex items-center gap-2 w-full">
                <div className="h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
                  <Shield className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">New App</div>
                  <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/80 font-normal transition-colors">Scan, fix, and upload to new source</div>
                </div>
              </div>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="group h-auto py-6 flex flex-col items-start gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary active:bg-primary/90 transition-all"
              onClick={() => setExistingAppWorkflowOpen(true)}
              data-testid="button-existing-app-workflow"
            >
              <div className="flex items-center gap-2 w-full">
                <div className="h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
                  <Code className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-base">Existing App</div>
                  <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/80 font-normal transition-colors">Download, scan, fix, and re-upload</div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </Card>

      <NewAppWorkflowDialog 
        open={newAppWorkflowOpen}
        onOpenChange={setNewAppWorkflowOpen}
      />
      <ExistingAppWorkflowDialog
        open={existingAppWorkflowOpen}
        onOpenChange={setExistingAppWorkflowOpen}
      />
      <GlobalFixDialog
        open={globalFixOpen}
        onOpenChange={setGlobalFixOpen}
        onSuccess={handleGlobalFixSuccess}
      />
      {globalFixJobId && (
        <GlobalFixProgressDialog
          open={globalFixProgressOpen}
          onOpenChange={setGlobalFixProgressOpen}
          jobId={globalFixJobId}
        />
      )}

      {/* Global Fix All Button */}
      {hasUnresolvedIssues && (
        <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 dark:from-yellow-500/10 dark:to-orange-500/10 border-yellow-500/30 dark:border-yellow-500/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-700 dark:text-yellow-400" />
                Unresolved Security Issues Detected
              </h3>
              <p className="text-sm text-muted-foreground">
                You have {unresolvedFindings.length} unresolved issue{unresolvedFindings.length !== 1 ? 's' : ''} across your scans. 
                Apply AI-powered fixes to all issues with a single action.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => {
                if (isWorkflowBlocked('global-fix')) {
                  toast({
                    title: "Global Fix In Progress",
                    description: "Please complete or cancel the minimized Global Fix dialog before starting a new one.",
                    action: <ToastAction altText="Restore" onClick={() => restoreDialog('global-fix-dialog')}>Restore</ToastAction>
                  });
                  return;
                }
                setGlobalFixOpen(true);
              }}
              className="bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white border border-yellow-700 dark:border-yellow-600"
              data-testid="button-fix-all-issues"
            >
              <Zap className="w-4 h-4 mr-2" />
              Fix All Unresolved Issues
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <SecurityHealthScore 
          score={allScans.length === 0 ? 0 : healthScore} 
          trend={
            allScans.length === 0 || (healthScore >= 50 && healthScore < 90)
              ? undefined
              : { 
                  value: healthScore >= 90 ? 8 : -12, 
                  direction: healthScore >= 90 ? "up" : "down"
                }
          } 
          onClick={handleHealthScoreClick}
          totalFindings={totalFindings}
          resolvedCount={resolvedCount}
          inProgressCount={inProgressCount}
          openCount={openCount}
          data-testid="text-security-health-score"
        />
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <MetricCard
            title="Open Findings"
            value={totalFindings}
            trend={totalFindings > 0 ? { value: 12, direction: "up" } : undefined}
            icon={Shield}
            onClick={handleOpenFindingsClick}
          />
          <MetricCard
            title="Critical Issues"
            value={criticalCount}
            trend={criticalCount > 0 ? { value: 3, direction: "up" } : undefined}
            icon={AlertTriangle}
            onClick={handleCriticalIssuesClick}
          />
          <MetricCard
            title="Scan Success"
            value={totalCompletedOrFailed === 0 ? "N/A" : `${successRate}%`}
            trend={totalCompletedOrFailed > 0 && successRate >= 90 ? { value: 4, direction: "up" } : undefined}
            icon={CheckCircle}
            onClick={handleScanSuccessClick}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div>
            <h2 className="text-lg md:text-xl font-semibold mb-4">Recent Findings</h2>
            {recentFindings.length > 0 ? (
              recentFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  id={finding.id}
                  title={finding.title}
                  severity={finding.severity.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"}
                  cwe={finding.cwe}
                  owasp={[]}
                  affectedAsset={finding.asset}
                  status={mapStatus(finding.status)}
                  detectedDate={finding.detected}
                  riskScore={finding.riskScore / 10}
                  aiRemediation={true}
                  scanName={(finding as any).scanName}
                  fixesApplied={finding.fixesApplied || false}
                  onRemediation={() => handleOpenRemediation({ 
                    id: finding.id, 
                    title: finding.title, 
                    severity: finding.severity.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
                  })}
                  onRescan={() => handleRescan(finding.id)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No findings available. Run a scan to get started.
              </div>
            )}
        </div>
        </div>
        <div className="space-y-4 md:space-y-6">
          <div>
            <PriorityWidget findings={allFindings || []} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-semibold mb-4">Active Scans</h2>
            <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
              {activeScans.length > 0 ? (
                activeScans.map((scan) => (
                  <ScanProgressCard
                    key={scan.id}
                    projectName={scan.name}
                    status={scan.status === "pending" ? "running" : scan.status}
                    progress={scan.progress}
                    currentPhase={scan.phase}
                    startedAt={formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
                    onClick={() => handleScanClick(scan.id, scan.type)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active scans. Start a scan to see progress here.
                </div>
              )}
            </div>
            {allScans.length > 5 && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation("/scans")}
                  data-testid="button-view-all-projects"
                >
                  View All Projects ({allScans.length})
                </Button>
              </div>
            )}
          </div>
          <ThreatFeed />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div>
          <h2 className="text-lg md:text-xl font-semibold mb-4">Severity Trends</h2>
          <SeverityChart />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
            Industry Benchmark
            <Badge variant="outline" className="text-xs">Security Standards</Badge>
          </h2>
          <Card className="p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Your Score: {allScans.length === 0 ? 0 : healthScore}/100
                  </span>
                  <span className="text-sm text-muted-foreground">Industry Avg: 65/100</span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className={`h-full ${
                      allScans.length === 0 ? 'bg-muted' :
                      healthScore >= 65 ? 'bg-green-500' : 'bg-orange-500'
                    }`} 
                    style={{ width: `${allScans.length === 0 ? 0 : healthScore}%` }} 
                  />
                  <div className="absolute top-0 left-[65%] h-full w-0.5 bg-foreground/30" />
                </div>
                {allScans.length > 0 && totalFindings > 0 && (
                  <div className={`flex items-center gap-2 mt-2 text-sm ${healthScore >= 65 ? 'text-green-500' : 'text-orange-500'}`}>
                    <TrendingUp className="w-4 h-4" />
                    <span>
                      {healthScore >= 65 
                        ? `${healthScore - 65}% better than industry average` 
                        : `${65 - healthScore}% below industry average`}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                <div className="h-[1px] w-full bg-border -mt-4 mb-4" />
                <div className="flex items-center justify-between text-sm">
                  <span>Critical Findings</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{criticalCount}</span>
                    <span className="text-muted-foreground">vs 14 avg</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total Findings</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{totalFindings}</span>
                    <span className="text-muted-foreground">vs 127 avg</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Scan Coverage</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{allScans.length > 0 ? '100%' : '0%'}</span>
                    <span className="text-muted-foreground">vs 78% avg</span>
                  </div>
                </div>
              </div>

              {allScans.length === 0 && (
                <div className="pt-4 mt-4 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    Run your first scan to see how you compare to industry standards
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-4">Attack Surface Visualization</h2>
        <RiskMapVisualization />
      </div>

      {allScans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-semibold">Your Projects</h2>
            {allScans.length > 6 && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  if (isMobile) {
                    setLocation('/scans');
                  } else {
                    window.open('/scans', '_blank', 'noopener,noreferrer');
                  }
                }}
                data-testid="button-view-all-projects-header"
              >
                View All ({allScans.length})
              </Button>
            )}
          </div>
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {/* MVP Scans */}
              {mvpScans
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((scan) => {
                  const scanFindings = allFindings?.filter(f => f.scanId === scan.id) || [];
                  const displayName = scan.projectName || scan.repositoryUrl || "Unnamed MVP Project";
                  
                  return (
                    <ProjectCard
                      key={scan.id}
                      id={scan.id}
                      name={displayName}
                      type="mvp"
                      lastScan={formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
                      findingsCount={scanFindings.length}
                      criticalCount={scanFindings.filter(f => f.severity === "CRITICAL").length}
                      onScan={() => handleScanClick(scan.id, "mvp")}
                    />
                  );
                })}
              {/* Mobile Scans */}
              {mobileScans
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((scan) => {
                  const scanFindings = allFindings?.filter(f => f.scanId === scan.id) || [];
                  const displayName = scan.appName || "Unnamed Mobile App";
                  
                  return (
                    <ProjectCard
                      key={scan.id}
                      id={scan.id}
                      name={displayName}
                      type="mobile"
                      lastScan={formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
                      findingsCount={scanFindings.length}
                      criticalCount={scanFindings.filter(f => f.severity === "CRITICAL").length}
                      onScan={() => handleScanClick(scan.id, "mobile")}
                    />
                  );
                })}
              {/* Web Scans */}
              {webScans
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((scan) => {
                  const scanFindings = allFindings?.filter(f => f.scanId === scan.id) || [];
                  const displayName = scan.appName || scan.appUrl || "Unnamed Web App";
                  
                  return (
                    <ProjectCard
                      key={scan.id}
                      id={scan.id}
                      name={displayName}
                      type="web"
                      lastScan={formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
                      findingsCount={scanFindings.length}
                      criticalCount={scanFindings.filter(f => f.severity === "CRITICAL").length}
                      onScan={() => handleScanClick(scan.id, "web")}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {selectedFinding && (
        <RemediationDialog
          open={remediationOpen}
          onOpenChange={setRemediationOpen}
          findingTitle={selectedFinding.title}
          severity={selectedFinding.severity}
          findingId={selectedFinding.id}
          fixesApplied={selectedFinding.fixesApplied}
          status={selectedFinding.status}
          onApplyFix={handleApplyFix}
        />
      )}
    </div>
  );
}
