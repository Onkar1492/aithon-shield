import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, AlertTriangle, Download, Code, ExternalLink } from "lucide-react";
import type { MvpCodeScan } from "@shared/schema";

export default function MvpPreview() {
  const params = useParams();
  const scanId = params.scanId;

  const { data: scan, isLoading } = useQuery<MvpCodeScan>({
    queryKey: ["/api/mvp-scans", scanId],
    enabled: !!scanId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground" data-testid="text-loading">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h2 className="text-xl font-bold" data-testid="heading-not-found">Preview Not Found</h2>
              <p className="text-muted-foreground mt-2" data-testid="text-not-found-description">
                The scan you're looking for doesn't exist or has been removed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold" data-testid="heading-preview-title">
            {scan.projectName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-preview-subtitle">
            Security-Enhanced MVP Preview
          </p>
        </div>

        <Card data-testid="card-scan-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="heading-scan-info">
              <Code className="h-5 w-5" />
              Scan Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground" data-testid="label-platform">Platform</p>
                <p className="font-medium capitalize" data-testid="text-platform">{scan.platform}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="label-branch">Branch</p>
                <p className="font-medium" data-testid="text-branch">{scan.branch}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="label-scan-status">Status</p>
                <Badge variant={scan.scanStatus === "completed" ? "default" : "secondary"} data-testid="badge-scan-status">
                  {scan.scanStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="label-findings">Total Findings</p>
                <p className="font-medium" data-testid="text-findings">{scan.findingsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {scan.scanStatus === "completed" && (
          <Card data-testid="card-security-summary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="heading-security-summary">
                <Shield className="h-5 w-5" />
                Security Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-muted-foreground" data-testid="label-critical">Critical Issues</p>
                  <p className="text-2xl font-bold text-destructive" data-testid="text-critical">{scan.criticalCount}</p>
                </div>
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <p className="text-sm text-muted-foreground" data-testid="label-high">High Issues</p>
                  <p className="text-2xl font-bold text-orange-500" data-testid="text-high">{scan.highCount}</p>
                </div>
              </div>

              <div className="p-4 bg-accent/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <p className="font-medium" data-testid="heading-fixes-applied">Security Fixes Applied</p>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-fixes-description">
                  This preview includes all recommended security enhancements and vulnerability patches. 
                  The application has been hardened against common attack vectors.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-preview-info">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground" data-testid="text-preview-info">
                This is a preview of your application with security fixes applied. 
                You can test the functionality before deploying to production.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {scan.previewUrl && (
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  asChild
                  data-testid="button-view-app"
                >
                  <a href={scan.previewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    View Application
                  </a>
                </Button>
              )}

              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => window.location.href = '/mvp-code-scan'}
                data-testid="button-back-to-dashboard"
              >
                Back to Dashboard
              </Button>
            </div>

            <div className="pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground" data-testid="text-powered-by">
                Secured by Aithon Shield
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
