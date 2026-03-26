import type { Finding } from "@shared/schema";
import { computeFixConfidence, type FixConfidencePayload } from "@shared/fixConfidence";

/**
 * Prefer server-provided `fixConfidence`; otherwise compute with the same shared
 * heuristic as the API so the UI stays correct if the client is newer than the
 * running server or the field is missing from the JSON payload.
 */
export function getFixConfidenceForFinding(
  finding: Finding & { fixConfidence?: FixConfidencePayload | null },
): FixConfidencePayload {
  if (finding.fixConfidence != null) {
    return finding.fixConfidence;
  }
  return computeFixConfidence({
    severity: finding.severity,
    category: finding.category,
    cwe: finding.cwe,
    title: finding.title,
    remediation: finding.remediation,
    aiSuggestion: finding.aiSuggestion,
    location: finding.location,
    exploitabilityScore: finding.exploitabilityScore,
    impactScore: finding.impactScore,
    status: finding.status,
    fixesApplied: finding.fixesApplied,
  });
}
