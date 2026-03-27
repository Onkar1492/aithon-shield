import { useEffect } from "react";
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
  TierLimits,
} from "@shared/tierConfig";

interface PlansResponse {
  plans: TierPlan[];
  features: TierFeature[];
  limits: Record<TierName, TierLimits>;
}

interface CurrentPlanResponse {
  tier: TierName;
  plan: TierPlan;
  limits: TierLimits;
  subscriptionStatus: string;
}

interface BillingStatusResponse {
  stripeSubscriptionBillingEnabled: boolean;
}

const TIER_ORDER: Record<TierName, number> = { free: 0, starter: 1, pro: 2 };

const tierIcons: Record<TierName, React.ReactNode> = {
  free: <Zap className="h-6 w-6 text-blue-400" />,
  starter: <Building2 className="h-6 w-6 text-emerald-400" />,
  pro: <Sparkles className="h-6 w-6 text-yellow-400" />,
};

const tierColors: Record<TierName, string> = {
  free: "border-blue-500/30 bg-blue-500/5",
  starter: "border-emerald-500/40 bg-emerald-500/5",
  pro: "border-yellow-500/50 bg-yellow-500/5",
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

  const { data: billingStatus } = useQuery<BillingStatusResponse>({
    queryKey: ["/api/billing/status"],
  });

  const stripeBilling = billingStatus?.stripeSubscriptionBillingEnabled === true;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("checkout") === "success") {
      window.history.replaceState({}, "", "/plans");
      (async () => {
        try {
          await apiRequest("POST", "/api/billing/sync", {});
        } catch {}
        await queryClient.invalidateQueries({ queryKey: ["/api/plans/current"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
        toast({ title: "Checkout complete", description: "Your plan has been updated." });
      })();
    }
    if (q.get("checkout") === "canceled") {
      toast({ title: "Checkout canceled", variant: "destructive" });
      window.history.replaceState({}, "", "/plans");
    }
  }, [toast]);

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

  const checkoutMutation = useMutation({
    mutationFn: async (tier: "starter" | "pro") => {
      const res = await apiRequest("POST", "/api/billing/checkout-session", { tier });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Checkout failed");
      return data as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: Error) => {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal-session", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Portal failed");
      return data as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: Error) => {
      toast({ title: "Could not open billing portal", description: e.message, variant: "destructive" });
    },
  });

  const plans = plansData?.plans ?? [];
  const features = plansData?.features ?? [];
  const activeTier = currentData?.tier ?? currentTier;

  const canManageStripe =
    stripeBilling && Boolean(user?.stripeCustomerId) && (activeTier === "starter" || activeTier === "pro");

  function handlePlanAction(plan: TierPlan) {
    const isActive = plan.id === activeTier;
    if (isActive) return;

    const cur = TIER_ORDER[activeTier] ?? 0;
    const tgt = TIER_ORDER[plan.id] ?? 0;
    const isDowngrade = tgt < cur;

    if (isDowngrade || plan.id === "free") {
      upgradeMutation.mutate(plan.id);
      return;
    }

    if ((plan.id === "starter" || plan.id === "pro") && stripeBilling) {
      checkoutMutation.mutate(plan.id);
      return;
    }

    upgradeMutation.mutate(plan.id);
  }

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
          <CreditCard className="h-9 w-9 text-primary" aria-hidden />
          Plans & Pricing
        </h1>
        <p className="text-muted-foreground mt-2 text-base md:text-lg max-w-2xl mx-auto">
          Aithon Shield is <strong>free for open-source projects</strong>. Paid plans add unlimited private
          scanning, automation, and — on Pro — AI-assisted remediation and advanced testing.
        </p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Crown className="h-3.5 w-3.5 mr-1.5 text-yellow-500" />
            Your current plan: <strong className="ml-1">{plans.find((p) => p.id === activeTier)?.name ?? activeTier}</strong>
          </Badge>
          {canManageStripe ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
              data-testid="button-manage-subscription"
            >
              {portalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Manage subscription (Stripe)
            </Button>
          ) : null}
          {!stripeBilling ? (
            <p className="text-xs text-muted-foreground max-w-md">
              Stripe subscription checkout is not configured on this server. Plan changes use demo upgrade until{" "}
              <code className="text-xs">STRIPE_SECRET_KEY</code>, <code className="text-xs">STRIPE_PRICE_STARTER</code>, and{" "}
              <code className="text-xs">STRIPE_PRICE_PRO</code> are set.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isActive = plan.id === activeTier;
          const cur = TIER_ORDER[activeTier] ?? 0;
          const tgt = TIER_ORDER[plan.id] ?? 0;
          const isDowngrade = tgt < cur;

          const busy =
            upgradeMutation.isPending ||
            checkoutMutation.isPending ||
            (checkoutMutation.variables === plan.id && checkoutMutation.isPending);

          return (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col ${
                plan.recommended ? "border-2 " + tierColors[plan.id] : tierColors[plan.id]
              } ${isActive ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {tierIcons[plan.id]}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {isActive && (
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                      Current
                    </Badge>
                  )}
                  {plan.recommended && (
                    <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>

              <div className="mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground ml-1">/ {plan.priceNote}</span>
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
                disabled={isActive || busy}
                onClick={() => handlePlanAction(plan)}
                data-testid={`button-plan-${plan.id}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isActive ? "Current Plan" : isDowngrade ? `Switch to ${plan.name}` : plan.cta}
              </Button>
            </Card>
          );
        })}
      </div>

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

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">Feature Comparison</h2>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Feature</TableHead>
                <TableHead className="text-center w-[120px]">
                  <div className="flex items-center justify-center gap-1">
                    {tierIcons.free}
                    <span>Free</span>
                  </div>
                </TableHead>
                <TableHead className="text-center w-[120px]">
                  <div className="flex items-center justify-center gap-1">
                    {tierIcons.starter}
                    <span>Starter</span>
                  </div>
                </TableHead>
                <TableHead className="text-center w-[120px]">
                  <div className="flex items-center justify-center gap-1">
                    {tierIcons.pro}
                    <span>Pro</span>
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
                    <FeatureValue value={f.starter} />
                  </TableCell>
                  <TableCell className="text-center">
                    <FeatureValue value={f.pro} />
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
