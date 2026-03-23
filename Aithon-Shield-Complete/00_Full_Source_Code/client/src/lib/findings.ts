import type { Finding } from "@shared/schema";

/**
 * Determines if a finding has been resolved.
 * A finding is considered resolved if:
 * - fixesApplied is true (fixes were applied via workflow), OR
 * - status is 'resolved' (manually marked as resolved)
 */
export function isFindingResolved(finding: { fixesApplied?: boolean | null; status?: string | null }): boolean {
  return (
    finding.fixesApplied === true ||
    (typeof finding.status === 'string' && finding.status.toUpperCase().trim() === 'RESOLVED')
  );
}
