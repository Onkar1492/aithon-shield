export type TierName = "free" | "starter" | "pro";

export interface TierFeature {
  name: string;
  free: boolean | string;
  starter: boolean | string;
  pro: boolean | string;
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
    id: "starter",
    name: "Starter",
    tagline: "Unlimited scanning and core automation for growing teams",
    price: "$19.99",
    priceNote: "per seat / month",
    highlights: [
      "Everything in Free, plus:",
      "Unlimited private repos & scans",
      "CVE watchlist & scheduled scans",
      "Merge gate & AithonShield.yml",
      "Security onboarding wizard",
      "Dependency upgrade planner",
      "Email support",
    ],
    cta: "Upgrade to Starter",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "AI-powered security depth for serious product teams",
    price: "$49.99",
    priceNote: "per seat / month",
    highlights: [
      "Everything in Starter, plus:",
      "AI remediation (Shield Advisor) & fix confidence",
      "VS Code extension & API security testing",
      "False-positive suppression & findings deduplication",
      "Multi-repo dashboard, SCA reachability, typosquatting detection",
      "SAST–DAST correlation, proof-based DAST",
      "Mobile real-device DAST & runtime monitoring",
      "IaC & container scanning & risk acceptance",
      "Secrets rotation, Jira/Linear, SLA, developer score cards",
      "Priority email support",
    ],
    cta: "Upgrade to Pro",
    recommended: true,
  },
];

export const TIER_FEATURES: TierFeature[] = [
  { name: "Public / OSS repo scans", free: "Unlimited", starter: "Unlimited", pro: "Unlimited" },
  { name: "Private repo scans", free: "3 repos", starter: "Unlimited", pro: "Unlimited" },
  { name: "Scans per month", free: "20", starter: "Unlimited", pro: "Unlimited" },
  { name: "SAST (static analysis)", free: true, starter: true, pro: true },
  { name: "SCA (dependency vulnerabilities)", free: true, starter: true, pro: true },
  { name: "Secrets detection", free: true, starter: true, pro: true },
  { name: "SBOM generation", free: "CycloneDX", starter: "CycloneDX + SPDX", pro: "CycloneDX + SPDX" },
  { name: "Findings dashboard", free: true, starter: true, pro: true },
  { name: "CVE watchlist", free: false, starter: true, pro: true },
  { name: "Scheduled scans", free: false, starter: true, pro: true },
  { name: "Merge gate", free: false, starter: true, pro: true },
  { name: "AithonShield.yml policy", free: false, starter: true, pro: true },
  { name: "Security onboarding wizard", free: false, starter: true, pro: true },
  { name: "Dependency upgrade planner", free: false, starter: true, pro: true },
  { name: "Shield Advisor (AI chat)", free: false, starter: false, pro: true },
  { name: "AI fix confidence scoring", free: false, starter: false, pro: true },
  { name: "Secrets rotation workflow", free: false, starter: false, pro: true },
  { name: "Developer score cards", free: false, starter: false, pro: true },
  { name: "Jira / Linear sync", free: false, starter: false, pro: true },
  { name: "SLA enforcement", free: false, starter: false, pro: true },
  { name: "VS Code extension", free: false, starter: false, pro: true },
  { name: "API security testing", free: false, starter: false, pro: true },
  { name: "False-positive suppression (ML)", free: false, starter: false, pro: true },
  { name: "Findings deduplication", free: false, starter: false, pro: true },
  { name: "Multi-repo dashboard", free: false, starter: false, pro: true },
  { name: "SCA reachability analysis", free: false, starter: false, pro: true },
  { name: "Supply chain typosquatting detection", free: false, starter: false, pro: true },
  { name: "SAST-DAST correlation", free: false, starter: false, pro: true },
  { name: "Proof-based DAST", free: false, starter: false, pro: true },
  { name: "Mobile real-device DAST", free: false, starter: false, pro: true },
  { name: "Mobile runtime monitoring", free: false, starter: false, pro: true },
  { name: "IaC scanning", free: false, starter: false, pro: true },
  { name: "Container layer scanning", free: false, starter: false, pro: true },
  { name: "Risk acceptance workflow", free: false, starter: false, pro: true },
  { name: "Support", free: "Community", starter: "Email", pro: "Priority email" },
];

export type TierLimits = {
  maxPrivateRepos: number;
  maxScansPerMonth: number;
  hasAiFeatures: boolean;
  hasStarterFeatures: boolean;
  hasProFeatures: boolean;
};

export const TIER_LIMITS: Record<TierName, TierLimits> = {
  free: {
    maxPrivateRepos: 3,
    maxScansPerMonth: 20,
    hasAiFeatures: false,
    hasStarterFeatures: false,
    hasProFeatures: false,
  },
  starter: {
    maxPrivateRepos: Infinity,
    maxScansPerMonth: Infinity,
    hasAiFeatures: false,
    hasStarterFeatures: true,
    hasProFeatures: false,
  },
  pro: {
    maxPrivateRepos: Infinity,
    maxScansPerMonth: Infinity,
    hasAiFeatures: true,
    hasStarterFeatures: true,
    hasProFeatures: true,
  },
};
