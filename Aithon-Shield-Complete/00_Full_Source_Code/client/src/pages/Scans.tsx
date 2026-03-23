import { ScanProgressCard } from "@/components/ScanProgressCard";
import { NewScanDialog } from "@/components/NewScanDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Calendar, Clock, Pause, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { MvpCodeScan, MobileAppScan, WebAppScan, PipelineScan, ContainerScan, NetworkScan, LinterScan } from "@shared/schema";

export default function Scans() {
  const [, setLocation] = useLocation();

  // Fetch all scan types
  const { data: mvpScans = [] } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
  });
  const { data: mobileScans = [] } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
  });
  const { data: webScans = [] } = useQuery<WebAppScan[]>({
    queryKey: ["/api/web-scans"],
  });
  const { data: pipelineScans = [] } = useQuery<PipelineScan[]>({
    queryKey: ["/api/pipeline-scans"],
  });
  const { data: containerScans = [] } = useQuery<ContainerScan[]>({
    queryKey: ["/api/container-scans"],
  });
  const { data: networkScans = [] } = useQuery<NetworkScan[]>({
    queryKey: ["/api/network-scans"],
  });
  const { data: linterScans = [] } = useQuery<LinterScan[]>({
    queryKey: ["/api/linter-scans"],
  });

  // Combine and format all scans
  type CombinedScan = {
    id: string;
    project: string;
    type: "MVP Code" | "Mobile App" | "Web App" | "CI/CD Pipeline" | "Container" | "Network" | "Code Linter";
    scanType: "mvp" | "mobile" | "web" | "pipeline" | "container" | "network" | "linter";
    status: string;
    findings: number;
    completedAt: Date;
  };

  const allScans: CombinedScan[] = [
    ...mvpScans.map(scan => ({
      id: scan.id,
      project: scan.projectName,
      type: "MVP Code" as const,
      scanType: "mvp" as const,
      status: scan.scanStatus,
      findings: scan.findingsCount || 0,
      completedAt: scan.createdAt,
    })),
    ...mobileScans.map(scan => ({
      id: scan.id,
      project: scan.appName,
      type: "Mobile App" as const,
      scanType: "mobile" as const,
      status: scan.scanStatus,
      findings: scan.findingsCount || 0,
      completedAt: scan.createdAt,
    })),
    ...webScans.map(scan => ({
      id: scan.id,
      project: scan.appName,
      type: "Web App" as const,
      scanType: "web" as const,
      status: scan.scanStatus,
      findings: scan.findingsCount || 0,
      completedAt: scan.createdAt,
    })),
    ...pipelineScans.map(scan => ({
      id: scan.id,
      project: scan.repositoryName,
      type: "CI/CD Pipeline" as const,
      scanType: "pipeline" as const,
      status: scan.scanStatus,
      findings: scan.findingsCount || 0,
      completedAt: scan.createdAt,
    })),
    ...containerScans.map(scan => ({
      id: scan.id,
      project: scan.imageName,
      type: "Container" as const,
      scanType: "container" as const,
      status: scan.scanStatus,
      findings: (scan.criticalCount || 0) + (scan.highCount || 0) + (scan.mediumCount || 0),
      completedAt: scan.createdAt,
    })),
    ...networkScans.map(scan => ({
      id: scan.id,
      project: scan.targetHost,
      type: "Network" as const,
      scanType: "network" as const,
      status: scan.scanStatus,
      findings: scan.openPortsCount || 0,
      completedAt: scan.createdAt,
    })),
    ...linterScans.map(scan => ({
      id: scan.id,
      project: scan.projectName,
      type: "Code Linter" as const,
      scanType: "linter" as const,
      status: scan.scanStatus,
      findings: scan.issuesCount || 0,
      completedAt: scan.createdAt,
    })),
  ];

  // Sort by most recent first
  const sortedScans = allScans.sort((a, b) => 
    new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  // Get active (running/scanning) scans
  const activeScans = sortedScans.filter(scan => 
    scan.status === "scanning" || scan.status === "in-progress"
  );

  // Get completed scans
  const completedScans = sortedScans.filter(scan =>
    scan.status === "completed" || scan.status === "failed"
  );

  const handleViewScan = (scan: CombinedScan) => {
    setLocation(`/scan-details/${scan.scanType}/${scan.id}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Scans</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor security scanning operations
          </p>
        </div>
        <NewScanDialog />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Scheduled Scans</h2>
          <Button variant="outline" size="sm" data-testid="button-add-schedule">
            <Calendar className="w-4 h-4 mr-2" />
            Add Schedule
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base">Daily Full Scan</h3>
                  <Badge variant="outline">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Runs daily at 2:00 AM UTC
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Every Day
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    2:00 AM UTC
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" data-testid="button-pause-schedule">
                <Pause className="w-4 h-4" />
              </Button>
            </div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base">Weekly Compliance Scan</h3>
                  <Badge variant="secondary">Paused</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Runs every Monday at 9:00 AM UTC
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Monday
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    9:00 AM UTC
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" data-testid="button-resume-schedule">
                <Play className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Active Scans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScanProgressCard
            projectName="E-Commerce API"
            status="running"
            progress={67}
            currentPhase="Running DAST tests..."
            startedAt="10 minutes ago"
          />
          <ScanProgressCard
            projectName="Mobile App (iOS)"
            status="running"
            progress={34}
            currentPhase="Analyzing dependencies..."
            startedAt="25 minutes ago"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Scan History</h2>
        {completedScans.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No scan history yet. Start a scan to see results here.</p>
          </Card>
        ) : (
          <div className="rounded-md border" data-testid="table-scan-history">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedScans.map((scan) => (
                  <TableRow key={scan.id} className="hover-elevate">
                    <TableCell className="font-medium">{scan.project}</TableCell>
                    <TableCell>{scan.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={scan.status === "completed" ? "default" : "destructive"}
                      >
                        {scan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{scan.findings}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(scan.completedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewScan(scan)}
                        data-testid={`button-view-scan-${scan.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
