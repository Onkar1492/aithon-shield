import type { Vulnerability, DastProofEvidence } from "./types";

function buildCurl(method: string, url: string): string {
  return `curl -sS -X ${method} ${JSON.stringify(url)}`;
}

function truncateSnippet(s: string, n = 400): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

/**
 * P6-C9 — Real-device oriented DAST slice: safe HTTP probes against a user-supplied backend URL.
 * Full device-farm instrumentation is out of scope; this produces evidence-backed findings like web DAST.
 */
export async function runRealDeviceMobileDast(opts: {
  platform: "ios" | "android";
  backendApiUrl?: string | null;
  appName: string;
  appId: string;
}): Promise<Vulnerability[]> {
  const raw = (opts.backendApiUrl || "").trim();
  const urlStr = raw
    ? raw.startsWith("http")
      ? raw
      : `https://${raw.replace(/^\/\//, "")}`
    : "";

  const out: Vulnerability[] = [];

  if (!urlStr) {
    const proof: DastProofEvidence = {
      requestMethod: "GET",
      requestUrl: "about:blank",
      responseStatus: 0,
      responseSnippet: "No backendApiUrl in workflow metadata — configure it to run live probes.",
      matchedPattern: "missing_backend_url",
      matchedLocation: "url",
      curlCommand: "# Add workflowMetadata.backendApiUrl on the mobile scan",
      confirmed: false,
      confidence: "tentative",
      reproductionSteps: [
        "Open the mobile scan → Edit configuration.",
        "Set workflow metadata: backendApiUrl to your API base (https://…).",
        "Re-run the scan with Real device DAST enabled.",
      ],
    };
    out.push({
      title: "Mobile real-device DAST — backend URL not configured",
      description:
        "Real-device DAST needs a reachable HTTPS API to probe. Add `workflowMetadata.backendApiUrl` (or pass it when starting the scan).",
      severity: "MEDIUM",
      category: "Mobile DAST",
      cwe: "200",
      location: "workflow:backendApiUrl",
      remediation: "Provide a valid backend base URL used by the mobile app.",
      aiSuggestion: "Set backendApiUrl in workflow metadata to your staging API.",
      riskScore: 40,
      exploitabilityScore: 10,
      impactScore: 35,
      dastProof: proof,
    });
    return out;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(urlStr, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "AithonShield-MobileRealDeviceDAST/1.0" },
    });
    clearTimeout(timer);
    const text = await res.text().catch(() => "");
    const snippet = truncateSnippet(text);

    const tlsOk = urlStr.startsWith("https://");
    if (!tlsOk) {
      const proof: DastProofEvidence = {
        requestMethod: "GET",
        requestUrl: urlStr,
        responseStatus: res.status,
        responseSnippet: snippet,
        matchedPattern: "cleartext_http",
        matchedLocation: "url",
        curlCommand: buildCurl("GET", urlStr),
        confirmed: true,
        confidence: "definite",
        reproductionSteps: [
          "Configure the app to use HTTPS for API calls.",
          "Re-test with TLS enabled on the backend.",
        ],
      };
      out.push({
        title: "Mobile API uses cleartext or non-HTTPS URL for DAST probe",
        description: `The configured backend URL is not HTTPS-only: ${urlStr}`,
        severity: "HIGH",
        category: "Mobile DAST",
        cwe: "319",
        location: urlStr,
        remediation: "Use https:// for all API traffic; enforce TLS.",
        aiSuggestion: "Switch backendApiUrl to https and enable certificate pinning where appropriate.",
        riskScore: 72,
        exploitabilityScore: 55,
        impactScore: 70,
        dastProof: proof,
      });
    }

    const proof: DastProofEvidence = {
      requestMethod: "GET",
      requestUrl: urlStr,
      responseStatus: res.status,
      responseSnippet: snippet,
      matchedPattern: "http_response_body",
      matchedLocation: "body",
      curlCommand: buildCurl("GET", urlStr),
      confirmed: true,
      confidence: res.ok ? "firm" : "tentative",
      reproductionSteps: [
        `GET ${urlStr} from a network that can reach your API.`,
        "Compare status and body with the proof snippet.",
      ],
    };

    out.push({
      title: `Mobile real-device DAST — API reachability (${opts.platform})`,
      description:
        `Probe succeeded with HTTP ${res.status}. Review response for sensitive data exposure. App: ${opts.appName} (${opts.appId}).`,
      severity: res.status >= 500 ? "HIGH" : "LOW",
      category: "Mobile DAST",
      cwe: "200",
      location: urlStr,
      remediation: "Ensure API responses do not leak secrets; enforce auth on all routes.",
      aiSuggestion: "Add rate limiting and strip stack traces from error payloads.",
      riskScore: res.status >= 500 ? 60 : 25,
      exploitabilityScore: 30,
      impactScore: 40,
      dastProof: proof,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const proof: DastProofEvidence = {
      requestMethod: "GET",
      requestUrl: urlStr,
      responseStatus: 0,
      responseSnippet: truncateSnippet(msg),
      matchedPattern: "fetch_error",
      matchedLocation: "body",
      curlCommand: buildCurl("GET", urlStr),
      confirmed: true,
      confidence: "firm",
      reproductionSteps: [
        "Verify the URL is reachable from the scanner host.",
        "Check firewall / DNS / TLS certificates.",
      ],
    };
    out.push({
      title: "Mobile real-device DAST — backend probe failed",
      description: `Could not complete GET request: ${msg}`,
      severity: "MEDIUM",
      category: "Mobile DAST",
      cwe: "693",
      location: urlStr,
      remediation: "Ensure the API is reachable and uses a valid TLS certificate.",
      aiSuggestion: "Test the URL with curl from the same environment as the server.",
      riskScore: 45,
      exploitabilityScore: 20,
      impactScore: 35,
      dastProof: proof,
    });
  }

  return out;
}
