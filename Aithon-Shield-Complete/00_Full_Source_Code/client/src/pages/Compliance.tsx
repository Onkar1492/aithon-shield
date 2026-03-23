import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, AlertTriangle, FileText, Shield, Download, Eye, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warn";
  findingsCount?: number;
}

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  coverage: number;
  status: "good" | "fair" | "poor";
  passed: number;
  failed: number;
  controls: ComplianceControl[];
}

const complianceFrameworks: ComplianceFramework[] = [
  {
    id: "owasp-top10",
    name: "OWASP Top 10",
    description: "The Open Web Application Security Project Top 10 security risks",
    coverage: 85,
    status: "good",
    passed: 8,
    failed: 2,
    controls: [
      { id: "A01", name: "Broken Access Control", description: "Restrictions on authenticated users are not properly enforced", status: "pass" },
      { id: "A02", name: "Cryptographic Failures", description: "Failures related to cryptography leading to exposure of sensitive data", status: "pass" },
      { id: "A03", name: "Injection", description: "SQL, NoSQL, OS command injection vulnerabilities", status: "fail", findingsCount: 3 },
      { id: "A04", name: "Insecure Design", description: "Missing or ineffective control design", status: "pass" },
      { id: "A05", name: "Security Misconfiguration", description: "Missing or insecure configuration", status: "warn", findingsCount: 1 },
      { id: "A06", name: "Vulnerable Components", description: "Using components with known vulnerabilities", status: "pass" },
      { id: "A07", name: "Auth Failures", description: "Authentication and session management issues", status: "pass" },
      { id: "A08", name: "Data Integrity Failures", description: "Software and data integrity failures", status: "pass" },
      { id: "A09", name: "Security Logging Failures", description: "Insufficient logging and monitoring", status: "fail", findingsCount: 2 },
      { id: "A10", name: "SSRF", description: "Server-Side Request Forgery", status: "pass" },
    ],
  },
  {
    id: "nist-csf",
    name: "NIST Cybersecurity Framework",
    description: "Framework for improving critical infrastructure cybersecurity",
    coverage: 72,
    status: "fair",
    passed: 15,
    failed: 6,
    controls: [
      { id: "ID.AM", name: "Asset Management", description: "Identify and manage assets", status: "pass" },
      { id: "ID.BE", name: "Business Environment", description: "Business context and risk profile", status: "pass" },
      { id: "ID.GV", name: "Governance", description: "Policies and procedures", status: "warn", findingsCount: 2 },
      { id: "ID.RA", name: "Risk Assessment", description: "Identify and assess risks", status: "pass" },
      { id: "PR.AC", name: "Access Control", description: "Manage access to assets", status: "fail", findingsCount: 4 },
      { id: "PR.AT", name: "Awareness Training", description: "Security awareness training", status: "pass" },
      { id: "PR.DS", name: "Data Security", description: "Data protection controls", status: "pass" },
      { id: "PR.IP", name: "Information Protection", description: "Security policies and procedures", status: "fail", findingsCount: 3 },
      { id: "DE.AE", name: "Anomalies Events", description: "Detect anomalous activity", status: "pass" },
      { id: "DE.CM", name: "Security Monitoring", description: "Continuous security monitoring", status: "pass" },
    ],
  },
  {
    id: "soc2",
    name: "SOC 2 Type II",
    description: "Service Organization Control 2 compliance framework",
    coverage: 68,
    status: "fair",
    passed: 12,
    failed: 5,
    controls: [
      { id: "CC1", name: "Control Environment", description: "Demonstrates commitment to integrity and values", status: "pass" },
      { id: "CC2", name: "Communication", description: "Internal and external communication", status: "pass" },
      { id: "CC3", name: "Risk Assessment", description: "Identifies and analyzes risks", status: "warn", findingsCount: 1 },
      { id: "CC4", name: "Monitoring Activities", description: "Evaluates control effectiveness", status: "pass" },
      { id: "CC5", name: "Control Activities", description: "Policies and procedures to mitigate risks", status: "fail", findingsCount: 2 },
      { id: "CC6", name: "Logical Access", description: "Restricts logical access", status: "pass" },
      { id: "CC7", name: "System Operations", description: "Manages system operations", status: "pass" },
      { id: "CC8", name: "Change Management", description: "Manages system changes", status: "fail", findingsCount: 3 },
      { id: "CC9", name: "Risk Mitigation", description: "Mitigates risks from vendors", status: "pass" },
    ],
  },
  {
    id: "iso27001",
    name: "ISO 27001",
    description: "International standard for information security management",
    coverage: 45,
    status: "poor",
    passed: 9,
    failed: 11,
    controls: [
      { id: "A.5", name: "Information Security Policies", description: "Management direction for information security", status: "fail", findingsCount: 2 },
      { id: "A.6", name: "Organization of Info Security", description: "Internal organization and mobile devices", status: "warn", findingsCount: 1 },
      { id: "A.7", name: "Human Resource Security", description: "Security before, during, and after employment", status: "pass" },
      { id: "A.8", name: "Asset Management", description: "Responsibility for and classification of assets", status: "fail", findingsCount: 3 },
      { id: "A.9", name: "Access Control", description: "User access management", status: "fail", findingsCount: 5 },
      { id: "A.10", name: "Cryptography", description: "Cryptographic controls", status: "pass" },
      { id: "A.11", name: "Physical Security", description: "Secure areas and equipment", status: "pass" },
      { id: "A.12", name: "Operations Security", description: "Operational procedures and responsibilities", status: "fail", findingsCount: 4 },
    ],
  },
  {
    id: "hipaa",
    name: "HIPAA",
    description: "Health Insurance Portability and Accountability Act requirements",
    coverage: 78,
    status: "fair",
    passed: 14,
    failed: 4,
    controls: [
      { id: "164.308", name: "Administrative Safeguards", description: "Policies and procedures", status: "pass" },
      { id: "164.310", name: "Physical Safeguards", description: "Facility access and workstation security", status: "pass" },
      { id: "164.312", name: "Technical Safeguards", description: "Access controls and audit controls", status: "warn", findingsCount: 2 },
      { id: "164.314", name: "Organizational Requirements", description: "Business associate contracts", status: "pass" },
      { id: "164.316", name: "Documentation", description: "Policies and procedures documentation", status: "fail", findingsCount: 2 },
    ],
  },
  {
    id: "gdpr",
    name: "GDPR",
    description: "General Data Protection Regulation compliance requirements",
    coverage: 82,
    status: "good",
    passed: 10,
    failed: 2,
    controls: [
      { id: "Art5", name: "Data Processing Principles", description: "Lawfulness, fairness, and transparency", status: "pass" },
      { id: "Art6", name: "Lawfulness of Processing", description: "Legal bases for processing", status: "pass" },
      { id: "Art13", name: "Information to Data Subjects", description: "Transparency requirements", status: "pass" },
      { id: "Art17", name: "Right to Erasure", description: "Right to be forgotten", status: "warn", findingsCount: 1 },
      { id: "Art25", name: "Data Protection by Design", description: "Privacy by design and default", status: "pass" },
      { id: "Art32", name: "Security of Processing", description: "Appropriate technical measures", status: "fail", findingsCount: 2 },
    ],
  },
];

export default function Compliance() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | null>(null);

  const handleExportReport = (frameworkId: string, frameworkName: string) => {
    toast({
      title: "Export Started",
      description: `Generating ${frameworkName} compliance report...`,
    });

    // Generate and download the compliance report as JSON
    setTimeout(() => {
      const framework = complianceFrameworks.find(f => f.id === frameworkId);
      if (!framework) return;

      const reportData = {
        framework: framework.name,
        description: framework.description,
        generatedAt: new Date().toISOString(),
        coverage: framework.coverage,
        status: framework.status,
        passed: framework.passed,
        failed: framework.failed,
        controls: framework.controls,
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${frameworkId}_compliance_report_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: `${frameworkName} compliance report has been downloaded.`,
      });
    }, 1500);
  };

  const handleViewFindings = (controlId: string) => {
    // Navigate to findings page with filter
    setLocation(`/findings?compliance=${controlId}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance & Standards</h1>
          <p className="text-muted-foreground mt-1">
            Track your security posture against industry frameworks
          </p>
        </div>
        <Button 
          onClick={() => {
            toast({
              title: "Export All Reports",
              description: "Generating comprehensive compliance report for all frameworks...",
            });

            // Generate comprehensive report with all frameworks
            setTimeout(() => {
              const allFrameworksData = {
                title: "Aithon Shield - Comprehensive Compliance Report",
                generatedAt: new Date().toISOString(),
                frameworks: complianceFrameworks.map(f => ({
                  name: f.name,
                  description: f.description,
                  coverage: f.coverage,
                  status: f.status,
                  passed: f.passed,
                  failed: f.failed,
                  controls: f.controls,
                })),
              };

              const blob = new Blob([JSON.stringify(allFrameworksData, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `compliance_all_frameworks_${Date.now()}.json`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);

              toast({
                title: "Export Complete",
                description: "All compliance reports have been downloaded.",
              });
            }, 2000);
          }}
          data-testid="button-export-all"
        >
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {complianceFrameworks.slice(0, 3).map((framework) => (
          <Card key={framework.id} className="p-6 shadow-sm" data-testid={`card-compliance-${framework.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{framework.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {framework.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{framework.coverage}%</span>
                <Badge
                  variant={
                    framework.status === "good"
                      ? "default"
                      : framework.status === "fair"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {framework.status === "good"
                    ? "Compliant"
                    : framework.status === "fair"
                    ? "Partial"
                    : "Non-Compliant"}
                </Badge>
              </div>
              <Progress value={framework.coverage} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  {framework.passed} passed
                </div>
                <div className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-4 h-4" />
                  {framework.failed} failed
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedFramework(framework)}
                  data-testid={`button-view-details-${framework.id}`}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Details
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExportReport(framework.id, framework.name)}
                  data-testid={`button-export-${framework.id}`}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">OWASP Top 10 Detailed Coverage</h2>
        <Card className="p-6">
          <div className="space-y-3">
            {complianceFrameworks[0].controls?.map((control) => (
              <div
                key={control.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer"
                onClick={() => handleViewFindings(control.id)}
                data-testid={`control-${control.id}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {control.status === "pass" ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : control.status === "warn" ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      {control.id}: {control.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {control.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      control.status === "pass"
                        ? "outline"
                        : control.status === "warn"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {control.status === "pass"
                      ? "Passed"
                      : control.status === "warn"
                      ? "Warning"
                      : "Failed"}
                  </Badge>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {complianceFrameworks.slice(3).map((framework) => (
          <Card key={framework.id} className="p-6 shadow-sm" data-testid={`card-compliance-${framework.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{framework.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {framework.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{framework.coverage}%</span>
                <Badge
                  variant={
                    framework.status === "good"
                      ? "default"
                      : framework.status === "fair"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {framework.status === "good"
                    ? "Compliant"
                    : framework.status === "fair"
                    ? "Partial"
                    : "Non-Compliant"}
                </Badge>
              </div>
              <Progress value={framework.coverage} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  {framework.passed} passed
                </div>
                <div className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-4 h-4" />
                  {framework.failed} failed
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedFramework(framework)}
                  data-testid={`button-view-details-${framework.id}`}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Details
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleExportReport(framework.id, framework.name)}
                  data-testid={`button-export-${framework.id}`}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Framework Details Dialog */}
      <Dialog open={!!selectedFramework} onOpenChange={() => setSelectedFramework(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-framework-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {selectedFramework?.name} Details
            </DialogTitle>
            <DialogDescription>
              {selectedFramework?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Coverage Score</div>
                <div className="text-2xl font-bold">{selectedFramework?.coverage}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge
                  variant={
                    selectedFramework?.status === "good"
                      ? "default"
                      : selectedFramework?.status === "fair"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {selectedFramework?.status === "good"
                    ? "Compliant"
                    : selectedFramework?.status === "fair"
                    ? "Partial"
                    : "Non-Compliant"}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Controls</div>
                <div className="text-sm">
                  <span className="text-green-500 font-medium">{selectedFramework?.passed} passed</span>
                  {" / "}
                  <span className="text-red-500 font-medium">{selectedFramework?.failed} failed</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Control Details</h3>
              {selectedFramework?.controls?.map((control) => (
                <div
                  key={control.id}
                  className="p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => {
                    handleViewFindings(control.id);
                    setSelectedFramework(null);
                  }}
                  data-testid={`dialog-control-${control.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {control.status === "pass" ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : control.status === "warn" ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">
                          {control.id}: {control.name}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {control.description}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        control.status === "pass"
                          ? "outline"
                          : control.status === "warn"
                          ? "secondary"
                          : "destructive"
                      }
                      className="ml-2"
                    >
                      {control.status === "pass"
                        ? "Passed"
                        : control.status === "warn"
                        ? "Warning"
                        : "Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                className="flex-1"
                onClick={() => {
                  handleExportReport(selectedFramework?.id || "", selectedFramework?.name || "");
                  setSelectedFramework(null);
                }}
                data-testid="button-export-dialog"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
