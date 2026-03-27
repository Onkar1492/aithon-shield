import type { Finding } from "@shared/schema";
import { computeFingerprint } from "./findingsDeduplicationService";

export type FpSuppressionPayload = {
  score: number;
  label: "none" | "user_marks_likely_fp" | "user_confirms_true_positive";
  verdict?: "likely_fp" | "true_positive";
};

/**
 * P6-D5 — Heuristic false-positive signal from user fingerprint feedback (not a trained ML model).
 * Future: merge repo embeddings + dismissal history.
 */
export function enrichFindingFpSuppression(
  finding: Finding,
  verdictMap: Record<string, string>,
): FpSuppressionPayload {
  const fp = computeFingerprint(finding);
  const v = verdictMap[fp];
  if (v === "likely_fp") {
    return { score: 78, label: "user_marks_likely_fp", verdict: "likely_fp" };
  }
  if (v === "true_positive") {
    return { score: 0, label: "user_confirms_true_positive", verdict: "true_positive" };
  }
  return { score: 0, label: "none" };
}
