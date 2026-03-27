/**
 * P5-C10 — Static API security analysis from OpenAPI 3.x documents (JSON or YAML).
 * Does not send attack traffic; evaluates auth coverage, transport hints, and spec hygiene.
 */
import { parse as parseYaml } from "yaml";

const FETCH_TIMEOUT_MS = 22_000;
const MAX_SPEC_CHARS = 2_000_000;

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

export type ApiSecuritySpecInput = {
  specText: string;
  specSourceLabel: string;
  baseUrlOverride?: string | null;
};

export type ApiSecurityFinding = {
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  cwe: string;
  location: string;
  remediation: string;
  aiSuggestion: string;
  riskScore: number;
  exploitabilityScore: number;
  impactScore: number;
};

function scoresFor(sev: ApiSecurityFinding["severity"]): Pick<
  ApiSecurityFinding,
  "riskScore" | "exploitabilityScore" | "impactScore"
> {
  const m = {
    CRITICAL: { riskScore: 95, exploitabilityScore: 88, impactScore: 92 },
    HIGH: { riskScore: 78, exploitabilityScore: 70, impactScore: 76 },
    MEDIUM: { riskScore: 52, exploitabilityScore: 45, impactScore: 50 },
    LOW: { riskScore: 28, exploitabilityScore: 22, impactScore: 26 },
  };
  return m[sev];
}

function baseFinding(
  partial: Omit<ApiSecurityFinding, "riskScore" | "exploitabilityScore" | "impactScore">,
): ApiSecurityFinding {
  return { ...partial, ...scoresFor(partial.severity) };
}

export async function fetchOpenApiSpecText(specUrl: string): Promise<{ text: string } | { error: string }> {
  const u = specUrl.trim();
  if (!u.startsWith("https://") && !u.startsWith("http://")) {
    return { error: "Spec URL must start with http:// or https://" };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(u, {
      signal: ctrl.signal,
      headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
    });
    const text = await r.text();
    if (!r.ok) {
      return { error: `HTTP ${r.status} fetching spec` };
    }
    if (text.length > MAX_SPEC_CHARS) {
      return { error: `Spec exceeds ${MAX_SPEC_CHARS} characters` };
    }
    return { text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { error: msg };
  } finally {
    clearTimeout(t);
  }
}

function parseOpenApiDocument(raw: string): { ok: true; doc: unknown } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: false, error: "Empty document" };
  if (t.length > MAX_SPEC_CHARS) {
    return { ok: false, error: `Spec exceeds ${MAX_SPEC_CHARS} characters` };
  }
  try {
    if (t.startsWith("{")) {
      return { ok: true, doc: JSON.parse(t) as unknown };
    }
    return { ok: true, doc: parseYaml(t) as unknown };
  } catch {
    return { ok: false, error: "Could not parse as JSON or YAML" };
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function sensitivePath(path: string): boolean {
  const p = path.toLowerCase();
  return /admin|password|token|secret|credential|auth|login|oauth|key|internal|private|user/.test(p);
}

function hasOperationSecurity(
  globalSecurity: unknown,
  opSecurity: unknown,
): { has: boolean; explicitOpLevel: boolean } {
  if (opSecurity !== undefined) {
    const arr = Array.isArray(opSecurity) ? opSecurity : [];
    return { has: arr.length > 0, explicitOpLevel: true };
  }
  const g = Array.isArray(globalSecurity) ? globalSecurity : [];
  return { has: g.length > 0, explicitOpLevel: false };
}

/**
 * Analyze OpenAPI 3.x document and return findings (static only).
 */
export function analyzeOpenApiApiSecurity(input: ApiSecuritySpecInput): { findings: ApiSecurityFinding[] } {
  const parsed = parseOpenApiDocument(input.specText);
  if (!parsed.ok) {
    return {
      findings: [
        baseFinding({
          title: "API spec: parse failed",
          description: `${parsed.error}\n\nSource: ${input.specSourceLabel}`,
          severity: "HIGH",
          category: "API Security",
          cwe: "1188",
          location: input.specSourceLabel,
          remediation: "Provide valid OpenAPI 3.x JSON or YAML.",
          aiSuggestion: "",
        }),
      ],
    };
  }
  const doc = parsed.doc;
  if (!isRecord(doc)) {
    return {
      findings: [
        baseFinding({
          title: "API spec: invalid root",
          description: "Document root must be an object.",
          severity: "HIGH",
          category: "API Security",
          cwe: "1188",
          location: input.specSourceLabel,
          remediation: "Use a standard OpenAPI 3.x root object.",
          aiSuggestion: "",
        }),
      ],
    };
  }

  const openapi = doc.openapi;
  if (typeof openapi !== "string" || !openapi.startsWith("3.")) {
    return {
      findings: [
        baseFinding({
          title: "API spec: not OpenAPI 3.x",
          description: `Expected \`openapi: "3.x.x"\`; found ${String(openapi)}. This analyzer supports OpenAPI 3.0 / 3.1 only.`,
          severity: "MEDIUM",
          category: "API Security",
          cwe: "1188",
          location: input.specSourceLabel,
          remediation: "Convert the document to OpenAPI 3.x or use a converter tool.",
          aiSuggestion: "",
        }),
      ],
    };
  }

  const paths = doc.paths;
  if (!isRecord(paths)) {
    return {
      findings: [
        baseFinding({
          title: "API spec: missing or invalid paths",
          description: "No `paths` object found — cannot enumerate API operations.",
          severity: "HIGH",
          category: "API Security",
          cwe: "1188",
          location: input.specSourceLabel,
          remediation: "Define `paths` with at least one operation.",
          aiSuggestion: "",
        }),
      ],
    };
  }

  const info = isRecord(doc.info) ? doc.info : {};
  const title = typeof info.title === "string" ? info.title : "API";
  const version = typeof info.version === "string" ? info.version : "?";

  const components = isRecord(doc.components) ? doc.components : {};
  const securitySchemes = isRecord(components.securitySchemes) ? components.securitySchemes : {};
  const schemeKeys = Object.keys(securitySchemes);

  const globalSecurity = doc.security;

  const pathKeys = Object.keys(paths).filter((k) => k.startsWith("/"));
  let opCount = 0;
  let unprotectedCount = 0;
  let unprotectedSensitiveCount = 0;
  const methodsSeen = new Set<string>();

  for (const path of pathKeys) {
    const item = paths[path];
    if (!isRecord(item)) continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!isRecord(op)) continue;
      opCount++;
      methodsSeen.add(method.toUpperCase());
      const { has } = hasOperationSecurity(globalSecurity, op.security);
      if (!has) {
        unprotectedCount++;
        if (sensitivePath(path) || method === "delete" || method === "patch" || method === "put") {
          unprotectedSensitiveCount++;
        }
      }
    }
  }

  const findings: ApiSecurityFinding[] = [];

  findings.push(
    baseFinding({
      title: `OpenAPI summary: ${title} (${version})`,
      description: `**Operations detected:** ${opCount} across **${pathKeys.length}** path(s).\n\nSource: ${input.specSourceLabel}\n\nThis is static analysis of the contract only — it does not probe your live API for runtime bugs.`,
      severity: "LOW",
      category: "API Security",
      cwe: "200",
      location: `openapi:${openapi}`,
      remediation: "Keep the published spec in sync with deployment and run DAST against staging for runtime issues.",
      aiSuggestion: "Add contract tests (Schemathesis, Dredd) in CI.",
    }),
  );

  if (schemeKeys.length === 0 && opCount > 0) {
    findings.push(
      baseFinding({
        title: "API spec: no securitySchemes defined",
        description:
          "`components.securitySchemes` is empty or missing. Consumers and gateways cannot infer intended auth mechanisms from the contract.",
        severity: "MEDIUM",
        category: "API Security",
        cwe: "1188",
        location: "components.securitySchemes",
        remediation: "Document OAuth2, API keys, mutual TLS, or other schemes your API actually enforces.",
        aiSuggestion: "",
      }),
    );
  }

  if (unprotectedCount > 0) {
    const sev: ApiSecurityFinding["severity"] =
      unprotectedSensitiveCount > 0 ? "HIGH" : unprotectedCount > 5 ? "MEDIUM" : "LOW";
    findings.push(
      baseFinding({
        title: `API operations without security requirement (${unprotectedCount})`,
        description: `**${unprotectedCount}** operation(s) inherit no \`security\` requirement (global security is empty and each operation omits \`security\` or sets it to \`[]\`). **${unprotectedSensitiveCount}** involve sensitive paths or state-changing methods.\n\nFalse positives are possible for public endpoints — review each route.`,
        severity: sev,
        category: "API Security",
        cwe: "306",
        location: `${unprotectedCount} operations`,
        remediation:
          "Add `security` at the root or per-operation. Mark intentionally public routes explicitly in docs and policy.",
        aiSuggestion: "",
      }),
    );
  }

  const serversRaw = doc.servers;
  const checkUrls: string[] = [];
  if (typeof input.baseUrlOverride === "string" && input.baseUrlOverride.trim()) {
    checkUrls.push(input.baseUrlOverride.trim());
  }
  if (Array.isArray(serversRaw)) {
    for (const s of serversRaw) {
      if (isRecord(s) && typeof s.url === "string") {
        checkUrls.push(s.url);
      }
    }
  }

  let cleartextServer = false;
  for (const url of checkUrls) {
    if (url.trim().toLowerCase().startsWith("http://")) {
      cleartextServer = true;
      break;
    }
  }
  if (cleartextServer) {
    findings.push(
      baseFinding({
        title: "API spec: cleartext (http://) server URL",
        description:
          "At least one `servers[].url` or the base URL override uses **http://**. Prefer **https://** for production APIs.",
        severity: "MEDIUM",
        category: "API Security",
        cwe: "319",
        location: "servers",
        remediation: "Use HTTPS endpoints in the published spec and enforce TLS on gateways.",
        aiSuggestion: "",
      }),
    );
  }

  if (opCount > 80) {
    findings.push(
      baseFinding({
        title: "Large published API surface",
        description: `**${opCount}** operations increase review burden and attack surface. Consider splitting specs per domain or using tags for ownership.`,
        severity: "LOW",
        category: "API Security",
        cwe: "200",
        location: `${opCount} operations`,
        remediation: "Apply rate limits, authentication, and per-scope authorization consistently.",
        aiSuggestion: "",
      }),
    );
  }

  if (opCount === 0) {
    findings.push(
      baseFinding({
        title: "API spec: no HTTP operations found",
        description: "Paths exist but no standard HTTP methods were detected under `paths`.",
        severity: "MEDIUM",
        category: "API Security",
        cwe: "1188",
        location: input.specSourceLabel,
        remediation: "Ensure operations are defined under each path (get, post, etc.).",
        aiSuggestion: "",
      }),
    );
  }

  return { findings };
}
