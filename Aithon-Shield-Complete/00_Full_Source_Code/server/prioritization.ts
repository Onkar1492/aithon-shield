import type { Finding } from "@shared/schema";

/**
 * Auto-Prioritization Engine
 * Calculates priority scores based on severity, exploitability, impact, and attack surface
 */

interface PriorityScores {
  exploitabilityScore: number;
  impactScore: number;
  attackSurfaceScore: number;
  priorityScore: number;
}

const SEVERITY_WEIGHTS = {
  Critical: 100,
  High: 75,
  Medium: 50,
  Low: 25,
};

const CWE_EXPLOITABILITY: Record<string, number> = {
  "CWE-89": 95,  // SQL Injection - highly exploitable
  "CWE-79": 90,  // XSS - highly exploitable
  "CWE-78": 95,  // OS Command Injection - highly exploitable
  "CWE-352": 85, // CSRF - exploitable
  "CWE-862": 80, // Missing Authorization - exploitable
  "CWE-798": 90, // Hard-coded Credentials - highly exploitable
  "CWE-22": 85,  // Path Traversal - exploitable
  "CWE-94": 95,  // Code Injection - highly exploitable
  "CWE-611": 70, // XXE - moderately exploitable
  "CWE-918": 75, // SSRF - moderately exploitable
  "CWE-306": 85, // Missing Authentication - highly exploitable
  "CWE-502": 80, // Deserialization - exploitable
  "CWE-770": 60, // Resource Exhaustion - moderately exploitable
  "CWE-327": 70, // Weak Crypto - moderately exploitable
  "CWE-326": 65, // Inadequate Encryption - moderately exploitable
};

const CWE_IMPACT: Record<string, number> = {
  "CWE-89": 95,  // SQL Injection - data breach
  "CWE-79": 75,  // XSS - session hijacking, data theft
  "CWE-78": 100, // OS Command Injection - full system compromise
  "CWE-352": 70, // CSRF - unauthorized actions
  "CWE-862": 90, // Missing Authorization - data access
  "CWE-798": 95, // Hard-coded Credentials - full access
  "CWE-22": 85,  // Path Traversal - file access
  "CWE-94": 100, // Code Injection - full compromise
  "CWE-611": 80, // XXE - file disclosure
  "CWE-918": 85, // SSRF - internal network access
  "CWE-306": 95, // Missing Authentication - unauthorized access
  "CWE-502": 90, // Deserialization - code execution
  "CWE-770": 70, // Resource Exhaustion - DoS
  "CWE-327": 75, // Weak Crypto - data exposure
  "CWE-326": 75, // Inadequate Encryption - data exposure
};

const ASSET_ATTACK_SURFACE: Record<string, number> = {
  // High exposure
  "API Endpoint": 90,
  "Web Application": 85,
  "Authentication System": 95,
  "Payment Gateway": 100,
  "User Database": 95,
  "Admin Panel": 90,
  
  // Medium exposure
  "Backend Service": 70,
  "File Upload": 75,
  "Session Management": 80,
  "Configuration File": 65,
  
  // Lower exposure
  "Internal Service": 50,
  "Logging System": 45,
  "Cache Layer": 40,
};

/**
 * Calculate exploitability score based on CWE and severity
 */
function calculateExploitability(cwe: string, severity: string): number {
  const baseScore = CWE_EXPLOITABILITY[cwe] || 50;
  const severityBonus = severity === "Critical" ? 10 : severity === "High" ? 5 : 0;
  return Math.min(100, baseScore + severityBonus);
}

/**
 * Calculate business impact score based on CWE and affected asset
 */
function calculateImpact(cwe: string, asset: string, severity: string): number {
  const baseScore = CWE_IMPACT[cwe] || 50;
  
  // Boost impact for critical assets
  const assetBonus = asset.toLowerCase().includes("database") ? 15 :
                     asset.toLowerCase().includes("auth") ? 15 :
                     asset.toLowerCase().includes("payment") ? 20 :
                     asset.toLowerCase().includes("admin") ? 10 : 0;
  
  const severityBonus = severity === "Critical" ? 10 : severity === "High" ? 5 : 0;
  
  return Math.min(100, baseScore + assetBonus + severityBonus);
}

/**
 * Calculate attack surface score based on asset type and exposure
 */
function calculateAttackSurface(asset: string, severity: string): number {
  // Check for exact matches first
  let baseScore = ASSET_ATTACK_SURFACE[asset];
  
  // If no exact match, check for partial matches
  if (!baseScore) {
    const assetLower = asset.toLowerCase();
    if (assetLower.includes("api") || assetLower.includes("endpoint")) {
      baseScore = 85;
    } else if (assetLower.includes("web") || assetLower.includes("frontend")) {
      baseScore = 80;
    } else if (assetLower.includes("auth") || assetLower.includes("login")) {
      baseScore = 90;
    } else if (assetLower.includes("database") || assetLower.includes("db")) {
      baseScore = 95;
    } else if (assetLower.includes("admin")) {
      baseScore = 85;
    } else if (assetLower.includes("payment")) {
      baseScore = 100;
    } else if (assetLower.includes("file")) {
      baseScore = 70;
    } else {
      baseScore = 60; // default
    }
  }
  
  // Critical vulnerabilities in public-facing assets get higher scores
  const severityBonus = severity === "Critical" ? 10 : severity === "High" ? 5 : 0;
  
  return Math.min(100, baseScore + severityBonus);
}

/**
 * Calculate overall priority score
 * Weighted formula: (Severity * 0.30) + (Exploitability * 0.30) + (Impact * 0.25) + (Attack Surface * 0.15)
 */
function calculatePriorityScore(
  exploitability: number,
  impact: number,
  attackSurface: number,
  severity: string
): number {
  const severityWeight = SEVERITY_WEIGHTS[severity as keyof typeof SEVERITY_WEIGHTS] || 50;
  
  const priority = (
    severityWeight * 0.30 +
    exploitability * 0.30 +
    impact * 0.25 +
    attackSurface * 0.15
  );
  
  return Math.round(Math.min(100, Math.max(0, priority)));
}

/**
 * Main function to calculate all priority scores for a finding
 */
export function calculatePriorityScores(finding: {
  severity: string;
  cwe: string;
  asset: string;
}): PriorityScores {
  const exploitabilityScore = calculateExploitability(finding.cwe, finding.severity);
  const impactScore = calculateImpact(finding.cwe, finding.asset, finding.severity);
  const attackSurfaceScore = calculateAttackSurface(finding.asset, finding.severity);
  const priorityScore = calculatePriorityScore(
    exploitabilityScore,
    impactScore,
    attackSurfaceScore,
    finding.severity
  );
  
  return {
    exploitabilityScore,
    impactScore,
    attackSurfaceScore,
    priorityScore,
  };
}

/**
 * Determine if a finding is "Fix This First" priority
 * Criteria: Priority score >= 85 OR (Critical severity AND exploitability >= 80)
 */
export function isFixThisFirst(
  priorityScore: number,
  severity: string,
  exploitabilityScore: number
): boolean {
  return priorityScore >= 85 || (severity === "Critical" && exploitabilityScore >= 80);
}

/**
 * Get priority tier label for UI display
 */
export function getPriorityTier(priorityScore: number): string {
  if (priorityScore >= 85) return "Urgent";
  if (priorityScore >= 70) return "High";
  if (priorityScore >= 50) return "Medium";
  return "Low";
}
