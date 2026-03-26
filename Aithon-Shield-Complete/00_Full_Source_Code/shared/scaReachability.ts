/**
 * SCA import reachability (heuristic). Values are stored on findings.sca_reachability.
 */

export const SCA_REACHABILITY_VALUES = ["import_referenced", "no_import_match", "not_analyzed"] as const;

export type ScaReachabilityValue = (typeof SCA_REACHABILITY_VALUES)[number];

export const SCA_REACHABILITY_LABELS: Record<ScaReachabilityValue, string> = {
  import_referenced: "Import referenced",
  no_import_match: "No import match",
  not_analyzed: "Not analyzed",
};

export const SCA_REACHABILITY_DESCRIPTIONS: Record<ScaReachabilityValue, string> = {
  import_referenced:
    "Your source files include an import or require that resolves to this package (static heuristic; not a full call graph).",
  no_import_match:
    "No matching import/require was found in scanned source files. The dependency may still be used indirectly, at runtime, or only in build tooling.",
  not_analyzed:
    "Reachability was not computed for this ecosystem in this scan (or there were no parsable source files).",
};

export function isScaReachabilityValue(v: string | null | undefined): v is ScaReachabilityValue {
  return v != null && (SCA_REACHABILITY_VALUES as readonly string[]).includes(v);
}

export function formatScaReachabilityLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  if (isScaReachabilityValue(v)) return SCA_REACHABILITY_LABELS[v];
  return v;
}
