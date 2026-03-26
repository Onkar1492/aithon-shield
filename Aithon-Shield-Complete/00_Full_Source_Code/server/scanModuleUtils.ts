/** Normalize security module list from workflow metadata; empty array falls back to defaults. */
export function resolvedSecurityModules(
  meta: Record<string, unknown> | null | undefined,
  defaults: string[],
): string[] {
  const raw = meta?.securityModules;
  if (!Array.isArray(raw)) return defaults;
  const list = raw.filter((x): x is string => typeof x === "string");
  return list.length > 0 ? list : defaults;
}
