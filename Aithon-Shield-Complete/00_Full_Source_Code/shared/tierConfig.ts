export type TierName = "free" | "pro" | "enterprise";

export interface TierFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

export interface TierPlan {
  id: TierName;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  highlights: string[];
  cta: string;
  recommended?: boolean;
}

export const TIER_PLANS: TierPlan[] = [
  {
    id: "free",
    name: "Free / OSS",
    tagline: "Perfect for open-source projects and individual developers",
    price: "$0",
    priceNote: "forever",
    highlights: [
      "Unlimited scans on public repos",
      "SAST, SCA & secrets detection",
      "Up to 3 private repos",
      "Basic findings dashboard",
      "Community support",
      "SBOM generation (CycloneDX)",
    ],
    cta: "Current Plan",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For teams shipping production software",
    price: "$99",
    priceNote: "per seat / month",
    highlights: [
      "Everything in Free, plus:",
      "Unlimited private repos",
      "AI remediation (Shield Advisor)",
      "Fix confidence scoring",
      "Scheduled scans & drift detection",
      "Jira / Linear integration",
      "SLA enforcement engine",
      "Developer score cards",
      "Priority email support",
    ],
    cta: "Upgrade to Pro",
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations with compliance and governance needs",
    price: "Custom",
    priceNote: "contact sales",
    highlights: [
      "Everything in Pro, plus:",
      "SSO (SAML / OIDC)",
      "Project-level RBAC & orgs",
      "Compliance evidence packages",
      "Webhook / SIEM integration",
      "Container & IaC scanning",
      "Attack path graph",
      "Risk acceptance workflow",
      "White-label option",
      "Dedicated support & SLA",
    ],
    cta: "Contact Sales",
  },
];

export const TIER_FEATURES: TierFeature[] = [
  { name: "Public / OSS repo scans", free: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "Private repo scans", free: "3 repos", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "Scans per month", free: "20", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "SAST (static analysis)", free: true, pro: true, enterprise: true },
  { name: "SCA (dependency vulnerabilities)", free: true, pro: true, enterprise: true },
  { name: "Secrets detection", free: true, pro: true, enterprise: true },
  { name: "SBOM generation", free: "CycloneDX", pro: "CycloneDX + SPDX", enterprise: "CycloneDX + SPDX" },
  { name: "Findings dashboard", free: true, pro: true, enterprise: true },
  { name: "Shield Advisor (AI chat)", free: false, pro: true, enterprise: true },
  { name: "AI fix confidence scoring", free: false, pro: true, enterprise: true },
  { name: "Secrets rotation workflow", free: false, pro: true, enterprise: true },
  { name: "Dependency upgrade planner", free: false, pro: true, enterprise: true },
  { name: "Scheduled scans", free: false, pro: true, enterprise: true },
  { name: "CVE watchlist", free: false, pro: true, enterprise: true },
  { name: "Developer score cards", free: false, pro: true, enterprise: true },
  { name: "Jira / Linear sync", free: false, pro: true, enterprise: true },
  { name: "SLA enforcement", free: false, pro: true, enterprise: true },
  { name: "IaC scanning", free: false, pro: false, enterprise: true },
  { name: "Container layer scanning", free: false, pro: false, enterprise: true },
  { name: "Attack path graph", free: false, pro: false, enterprise: true },
  { name: "SSO (SAML / OIDC)", free: false, pro: false, enterprise: true },
  { name: "Project-level RBAC", free: false, pro: false, enterprise: true },
  { name: "Compliance evidence packages", free: false, pro: false, enterprise: true },
  { name: "Webhook / SIEM integration", free: false, pro: false, enterprise: true },
  { name: "Risk acceptance workflow", free: false, pro: false, enterprise: true },
  { name: "VEX output", free: false, pro: false, enterprise: true },
  { name: "White-label / agencies", free: false, pro: false, enterprise: true },
  { name: "Support", free: "Community", pro: "Priority email", enterprise: "Dedicated + SLA" },
];

export const TIER_LIMITS: Record<TierName, { maxPrivateRepos: number; maxScansPerMonth: number; hasAiFeatures: boolean; hasEnterpriseFeatures: boolean }> = {
  free: { maxPrivateRepos: 3, maxScansPerMonth: 20, hasAiFeatures: false, hasEnterpriseFeatures: false },
  pro: { maxPrivateRepos: Infinity, maxScansPerMonth: Infinity, hasAiFeatures: true, hasEnterpriseFeatures: false },
  enterprise: { maxPrivateRepos: Infinity, maxScansPerMonth: Infinity, hasAiFeatures: true, hasEnterpriseFeatures: true },
};
