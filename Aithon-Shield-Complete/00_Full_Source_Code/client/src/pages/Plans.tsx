import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  CreditCard,
  Check,
  X,
  Crown,
  Sparkles,
  Building2,
  Zap,
} from "lucide-react";
import type {
  TierPlan,
  TierFeature,
  TierName,
} from "@shared/tierConfig";

interface PlansResponse {
  plans: TierPlan[];
  features: TierFeature[];
  limits: Record<TierName, { maxPrivateRepos: number; maxScansPerMonth: number; hasAiFeatures: boolean; hasEnterpriseFeatures: boolean }>;
}

interface CurrentPlanResponse {
  tier: TierName;
  plan: TierPlan;
  limits: { maxPrivateRepos: number; maxScansPerMonth: number; hasAiFeatures: boolean; hasEnterpriseFeatures: boolean };
  subscriptionStatus: string;
}

const tierIcons: Record<TierName, React.ReactNode> = {
  free: <Zap className="h-6 w-6 text-blue-400" />,
  pro: <Sparkles className="h-6 w-6 text-yellow-400" />,
  enterprise: <Building2 className="h-6 w-6 text-purple-400" />,
};

const tierColors: Record<TierName, string> = {
  free: "border-blue-500/30 bg-blue-500/5",
  pro: "border-yellow-500/50 bg-yellow-500/5",
  enterprise: "border-purple-500/30 bg-purple-500/5",
};

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm">{value}</span>;
  }
  return value ? (
    <Check className="h-4 w-4 text-green-500 mx-auto" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

export default function PlansPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const currentTier = (user?.subscriptionTier ?? "free") as TierName;

  const { data: plansData, isLoading: plansLoading } = useQuery<PlansResponse>({
    queryKey: ["/api/plans"],
  });

  const { data: currentData } = useQuery<CurrentPlanResponse>({
    queryKey: ["/api/plans/current"],
  });

  const upgradeMutation = useMutation({
    mutationFn: async (tier: TierName) => {
      const res = await apiRequest("POST", "/api/plans/upgrade", { tier });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: data.message || "Plan updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Upgrade failed", description: e.message, variant: "destructive" });
    },
  });

  const plans = plansData?.plans ?? [];
  const features = plansData?.features ?? [];
  const activeTier = currentData?.tier ?? currentTier;

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
          <CreditCard className="h-9 w-9 text-primary" aria-hidden />
          Plans & Pricing
        </h1>
        <p className="text-muted-foreground mt-2 text-base md:text-lg max-w-2xl mx-auto">
          Aithon Shield is <strong>free for open-source projects</strong>. Upgrade for unlimited
          private repos, AI-powered remediation, and enterprise governance.
        </p>
        <div className="mt-3">
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Crown className="h-3.5 w-3.5 mr-1.5 text-yellow-500" />
            Your current plan: <strong className="ml-1">{plans.find((p) => p.id === activeTier)?.name ?? activeTier}</strong>
          </Badge>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isActive = plan.id === activeTier;
          const isUpgrade =
            (activeTier === "free" && (plan.id === "pro" || plan.id === "enterprise")) ||
            (activeTier === "pro" && plan.id === "enterprise");
          const isDowngrade =
            (activeTier === "enterprise" && (plan.id === "pro" || plan.id === "free")) ||
            (activeTier === "pro" && plan.id === "free");

          return (
            <Card
              key={plan.id}
              className={`p-6 relative flex flex-col ${
                plan.recommended ? "border-2 " + tierColors[plan.id] : tierColors[plan.id]
              } ${isActive ? "ring-2 ring-primary" : ""}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
                </div>
              )}
              {isActive && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                    Current
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                {tierIcons[plan.id]}
                <h3 className="text-xl font-bold">{plan.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>

              <div className="mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.price !== "Custom" && (
                  <span className="text-sm text-muted-foreground ml-1">/ {plan.priceNote}</span>
                )}
                {plan.price === "Custom" && (
                  <span className="text-sm text-muted-foreground ml-2">{plan.priceNote}</span>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {h.startsWith("Everything in") ? (
                      <Sparkles className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    )}
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={isActive ? "outline" : plan.recommended ? "default" : "outline"}
                disabled={isActive || upgradeMutation.isPending}
                onClick={() => {
                  if (plan.id === "enterprise" && !isActive) {
                    toast({ title: "Contact sales", description: "Enterprise plans are customized. Contact sales@aithonshield.com." });
                    return;
                  }
                  upgradeMutation.mutate(plan.id);
                }}
                data-testid={`button-plan-${plan.id}`}
              >
                {upgradeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isActive ? "Current Plan" : isDowngrade ? `Switch to ${plan.name}` : plan.cta}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* OSS callout */}
      <Card className="p-6 border-blue-500/30 bg-blue-500/5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-400" />
              Free for Open Source
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Aithon Shield is committed to securing the open-source ecosystem. Public repositories
              get <strong>unlimited scans</strong> on the Free tier — SAST, SCA, secrets detection,
              and SBOM generation at no cost. No credit card required.
            </p>
          </div>
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 px-4 py-2 text-sm whitespace-nowrap">
            Unlimited OSS Scans
          </Badge>
        </div>
      </Card>

      {/* Feature comparison table */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">Feature Comparison</h2>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Feature</TableHead>
                <TableHead className="text-center w-[140px]">
                  <div className="flex items-center justify-center gap-1">
                    {tierIcons.free}
                    <span>Free / OSS</span>
                  </div>
                </TableHead>
                <TableHead className="text-center w-[140px]">
                  <div className="flex items-center justify-center gap-1">
                    {tierIcons.pro}
                    <span>Pro</span>
                  </div>
                </TableHead>
                <TableHead className="text-center w-[140px]">
                  <div className="flex items-center justify-center gap-1">
                    {tierIcons.enterprise}
                    <span>Enterprise</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{f.name}</TableCell>
                  <TableCell className="text-center">
                    <FeatureValue value={f.free} />
                  </TableCell>
                  <TableCell className="text-center">
                    <FeatureValue value={f.pro} />
                  </TableCell>
                  <TableCell className="text-center">
                    <FeatureValue value={f.enterprise} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
