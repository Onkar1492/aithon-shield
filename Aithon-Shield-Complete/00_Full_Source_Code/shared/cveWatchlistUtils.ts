/** Match NVD-style CVE identifiers in free text (case-insensitive). */
const CVE_PATTERN = /CVE-\d{4}-\d{4,}/gi;

export function normalizeCveId(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(t)) return null;
  return t;
}

export function extractCveIdsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const set = new Set<string>();
  const m = text.matchAll(CVE_PATTERN);
  for (const match of m) {
    set.add(match[0].toUpperCase());
  }
  return [...set];
}
