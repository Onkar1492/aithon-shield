import YAML from "yaml";
import { z } from "zod";

const failOnSchema = z
  .object({
    critical: z.number().int().min(0).optional(),
    high: z.number().int().min(0).optional(),
    medium: z.number().int().min(0).optional(),
    low: z.number().int().min(0).optional(),
  })
  .strict();

const scanSchema = z
  .object({
    modules: z.array(z.string()).optional(),
    exclude_paths: z.array(z.string()).optional(),
  })
  .passthrough()
  .optional();

const policySchema = z
  .object({
    fail_on: failOnSchema.optional(),
    sla: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()
  .optional();

const suppressionSchema = z
  .object({
    id: z.string(),
    finding: z.string().optional(),
    reason: z.string().optional(),
    /** YAML may parse dates; coerce to string for storage / display */
    expires: z.coerce.string().optional(),
  })
  .strict();

const complianceSchema = z
  .object({
    frameworks: z.array(z.string()).optional(),
  })
  .passthrough()
  .optional();

/** Parsed `.aithonshield.yml` (known keys validated; extra keys preserved). */
export const aithonShieldConfigSchema = z
  .object({
    scan: scanSchema,
    policy: policySchema,
    suppressions: z.array(suppressionSchema).optional(),
    compliance: complianceSchema,
  })
  .passthrough();

export type AithonShieldConfig = z.infer<typeof aithonShieldConfigSchema>;

export type SeverityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type FailOnEvaluation = {
  pass: boolean;
  violations: string[];
};

/**
 * If any severity count exceeds the configured max (inclusive ceiling), the gate fails.
 * `fail_on.critical: 0` means zero critical findings allowed.
 */
export function evaluatePolicyFailOn(
  failOn: z.infer<typeof failOnSchema> | undefined,
  counts: SeverityCounts,
): FailOnEvaluation {
  if (!failOn) return { pass: true, violations: [] };
  const violations: string[] = [];
  const check = (label: keyof SeverityCounts, max: number | undefined) => {
    if (max === undefined) return;
    const n = counts[label];
    if (n > max) {
      violations.push(`${label}: ${n} findings exceeds allowed maximum ${max}`);
    }
  };
  check("critical", failOn.critical);
  check("high", failOn.high);
  check("medium", failOn.medium);
  check("low", failOn.low);
  return { pass: violations.length === 0, violations };
}

export type ParseAithonShieldYamlResult =
  | { ok: true; config: AithonShieldConfig }
  | { ok: false; error: string; yamlError?: boolean; zodError?: z.ZodError };

/** Parse YAML text and validate known structure. */
export function parseAithonShieldYaml(yamlText: string): ParseAithonShieldYamlResult {
  const trimmed = yamlText.trim();
  if (!trimmed) {
    return { ok: false, error: "YAML is empty", yamlError: true };
  }
  let doc: unknown;
  try {
    doc = YAML.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `YAML parse error: ${msg}`, yamlError: true };
  }
  if (doc == null || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, error: "Root YAML value must be a mapping (object)", yamlError: true };
  }
  const parsed = aithonShieldConfigSchema.safeParse(doc);
  if (!parsed.success) {
    return { ok: false, error: "Config does not match expected shape", zodError: parsed.error };
  }
  return { ok: true, config: parsed.data };
}

/** Example committed to repos (docs / Settings default). */
export const AITHON_SHIELD_YML_EXAMPLE = `scan:
  modules: [sast, sca, secrets]
  exclude_paths: [vendor/, node_modules/, test/]

policy:
  fail_on:
    critical: 0
    high: 5
  sla:
    critical: 24h
    high: 7d

suppressions:
  - id: CWE-79-false-positive
    finding: "XSS in sanitized output"
    reason: "Output is sanitized by DOMPurify"
    expires: "2026-06-01"

compliance:
  frameworks: [owasp-top-10, soc2]
`;
