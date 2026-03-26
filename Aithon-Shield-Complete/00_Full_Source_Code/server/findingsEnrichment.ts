import type { Finding } from "@shared/schema";
import { computeFixConfidence, type FixConfidencePayload } from "@shared/fixConfidence";

export type FindingWithFixConfidence = Finding & { fixConfidence: FixConfidencePayload };

export function enrichFindingWithFixConfidence<T extends Finding>(row: T): T & { fixConfidence: FixConfidencePayload } {
  return {
    ...row,
    fixConfidence: computeFixConfidence(row),
  };
}

export function enrichFindingsList<T extends Finding>(rows: T[]): (T & { fixConfidence: FixConfidencePayload })[] {
  return rows.map(enrichFindingWithFixConfidence);
}
