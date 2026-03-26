/**
 * Fix confidence + explainability (deterministic heuristic).
 * Scores are not ML predictions; they summarize severity, CWE/category, remediation depth,
 * and location sensitivity to guide human review before applying fixes.
 */

export type FixSideEffectRisk = "low" | "medium" | "high";

export type FixConfidencePayload = {
  /** 0–100; higher = more confidence the suggested remediation class fits this finding. */
  score: number;
  /** Short rationale for the score and risk. */
  explainability: string;
  sideEffectRisk: FixSideEffectRisk;
};

export type FixConfidenceInput = {
  severity: string;
  category: string;
  cwe: string;
  title?: string | null;
  remediation?: string | null;
  aiSuggestion?: string | null;
  location?: string | null;
  exploitabilityScore?: number | null;
  impactScore?: number | null;
  status?: string | null;
  fixesApplied?: boolean | null;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lower(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

export function computeFixConfidence(finding: FixConfidenceInput): FixConfidencePayload {
  const st = lower(finding.status);
  if (finding.fixesApplied || st === "resolved" || st === "fixed") {
    return {
      score: 95,
      explainability:
        "This finding is already marked resolved. The score reflects workflow state; re-scan to verify in code if needed.",
      sideEffectRisk: "low",
    };
  }

  let score = 72;
  const sev = lower(finding.severity);
  if (sev === "critical") score -= 10;
  else if (sev === "high") score -= 6;
  else if (sev === "medium") score -= 2;
  else if (sev === "low") score += 4;

  const blob = [finding.category, finding.title, finding.cwe].map(lower).join(" ");
  if (/sql|injection|sqli/.test(blob)) score += 5;
  if (/xss|cross-site scripting/.test(blob)) score += 3;
  if (/csrf|cross-site request forgery/.test(blob)) score += 2;
  if (/path traversal|lfi|rfi|ssrf/.test(blob)) score += 2;

  const remLen = (finding.remediation ?? "").trim().length;
  if (remLen > 120) score += 4;
  else if (remLen > 40) score += 2;
  else if (remLen > 0 && remLen < 25) score -= 6;

  const aiLen = (finding.aiSuggestion ?? "").trim().length;
  if (aiLen > 100) score += 4;
  else if (aiLen > 40) score += 2;

  const ex = finding.exploitabilityScore ?? 0;
  const im = finding.impactScore ?? 0;
  if (ex >= 85) score -= 3;
  if (im >= 85) score -= 2;

  const loc = lower(finding.location);
  let sideEffectRisk: FixSideEffectRisk = "low";
  if (/auth|password|token|session|middleware|cookie|jwt|oauth|login/.test(loc)) {
    sideEffectRisk = "medium";
    score -= 4;
  }
  if (/payment|crypto|wallet|billing|pii|ssn|credit/.test(loc)) {
    sideEffectRisk = "medium";
    score -= 3;
  }
  if (sev === "critical" && sideEffectRisk === "medium") {
    sideEffectRisk = "high";
  }

  score = clamp(Math.round(score), 42, 98);

  const parts: string[] = [];
  if (sev === "critical" || sev === "high") {
    parts.push(`Higher-severity issues often need extra manual validation (${sev}).`);
  } else {
    parts.push(`Severity is ${finding.severity}; suggested fixes are typically easier to reason about.`);
  }
  if (sideEffectRisk !== "low") {
    parts.push("The reported location touches sensitive or auth-related code; review for regressions.");
  } else {
    parts.push("Side-effect risk is lower based on location and category heuristics.");
  }
  if (remLen > 0) {
    parts.push("Remediation text length was factored in; longer guidance usually means a clearer patch path.");
  }

  return {
    score,
    explainability: parts.slice(0, 3).join(" "),
    sideEffectRisk,
  };
}
