import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Shield,
  Code,
  Smartphone,
  Globe,
  Activity,
  Radar,
  CalendarClock,
  Settings,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Rocket,
} from "lucide-react";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  features: { label: string; path: string }[];
}

const STEPS: WizardStep[] = [
  {
    id: "welcome",
    title: "Welcome to Aithon Shield",
    description:
      "Your enterprise security testing platform. This quick tour highlights the key areas so you can start securing your applications right away.",
    icon: Shield,
    features: [],
  },
  {
    id: "scans",
    title: "Run security scans",
    description:
      "Aithon Shield supports multiple scan types. Pick the one that matches your app, paste a URL or upload code, and get findings in minutes.",
    icon: Code,
    features: [
      { label: "MVP / Code Scan — paste a repo URL or code snippet", path: "/mvp-code-scan" },
      { label: "Mobile App Scan — iOS or Android bundle analysis", path: "/mobile-app-scan" },
      { label: "Web App Scan — DAST against a live URL", path: "/web-app-scan" },
      { label: "Code Linter Scan — static lint rules", path: "/linter-scan" },
    ],
  },
  {
    id: "findings",
    title: "Review and remediate findings",
    description:
      "Every scan produces findings ranked by severity and auto-prioritized. You can apply AI-suggested fixes, track status, and archive resolved items.",
    icon: Sparkles,
    features: [
      { label: "Findings — filter by severity, status, priority", path: "/findings" },
      { label: "Shield Advisor — AI chat for remediation guidance", path: "/settings" },
      { label: "Archive — resolved findings history", path: "/archive" },
    ],
  },
  {
    id: "monitoring",
    title: "Continuous monitoring",
    description:
      "Stay ahead of threats with scheduled scans, a CVE watchlist, and a security health timeline that tracks your MTTR and regressions.",
    icon: Activity,
    features: [
      { label: "Security Health — MTTR, regressions, timeline", path: "/security-health" },
      { label: "Developer score cards — per-project engagement scores", path: "/developer-score-cards" },
      { label: "Attack path graph — interactive phase view of findings", path: "/attack-path" },
      { label: "Scheduled Scans — recurring scans with drift detection", path: "/scheduled-scans" },
      { label: "CVE Watchlist — alerts when watched CVEs appear", path: "/cve-watchlist" },
    ],
  },
  {
    id: "governance",
    title: "Governance and compliance",
    description:
      "Enforce policies with .aithonshield.yml, gate merges in CI/CD, generate SBOMs, and keep an immutable audit log of every action.",
    icon: Settings,
    features: [
      { label: "Settings → Security as code (.aithonshield.yml)", path: "/settings" },
      { label: "Settings → Issue trackers (Jira / Linear)", path: "/settings" },
      { label: "SLA — remediation deadlines and breaches", path: "/sla" },
      { label: "Risk exceptions — accepted risk with justification", path: "/risk-exceptions" },
      { label: "Compliance — evidence package (ZIP) for auditors", path: "/compliance" },
      { label: "Compliance — VEX document (JSON) for CVE triage", path: "/compliance" },
      { label: "Settings → Merge gate (GitHub Check Runs)", path: "/settings" },
      { label: "Audit Log — immutable event history", path: "/audit-log" },
      { label: "Compliance — framework mapping", path: "/compliance" },
    ],
  },
  {
    id: "ready",
    title: "You're all set!",
    description:
      "Start by running your first scan. You can revisit this guide anytime from Settings. Happy securing!",
    icon: Rocket,
    features: [],
  },
];

export function SecurityOnboardingWizard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/complete", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  if (!user || user.onboardingCompletedAt) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (isLast) {
      completeMutation.mutate();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    completeMutation.mutate();
  };

  const handleFeatureClick = (path: string) => {
    completeMutation.mutate();
    setLocation(path);
  };

  const Icon = current.icon;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{current.title}</DialogTitle>
              <DialogDescription className="mt-1">
                Step {step + 1} of {STEPS.length}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Progress value={progress} className="h-1.5 mt-2" />

        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>

          {current.features.length > 0 && (
            <div className="grid gap-2">
              {current.features.map((f) => (
                <Card
                  key={f.label}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleFeatureClick(f.path)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleFeatureClick(f.path);
                  }}
                >
                  <span className="text-sm">{f.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Card>
              ))}
            </div>
          )}

          {isLast && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm">
                Click <strong>Get started</strong> to close this wizard and land on your dashboard.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={completeMutation.isPending}
              >
                Skip tour
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              disabled={completeMutation.isPending}
              data-testid="button-onboarding-next"
            >
              {isLast ? (
                <>
                  <Rocket className="h-4 w-4 mr-1" /> Get started
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
