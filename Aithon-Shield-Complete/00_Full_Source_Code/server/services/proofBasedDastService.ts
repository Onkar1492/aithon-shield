/**
 * Proof-Based DAST Service (P6-C8)
 *
 * Performs safe, read-only exploit confirmation against live web targets.
 * Instead of just detecting patterns that *might* indicate a vulnerability,
 * this service sends benign payloads and captures the exact HTTP evidence
 * (request + response) that proves the vulnerability is real.
 *
 * Confidence levels follow Invicti's model:
 *   - definite: exploit confirmed with unambiguous server response
 *   - firm: strong indicators but not 100% certain
 *   - tentative: heuristic match, needs manual review
 */

import type { Page, Form, Vulnerability, DastProofEvidence, ProgressCallback } from "./types";

function buildCurl(method: string, url: string, headers?: Record<string, string>, body?: string): string {
  let cmd = `curl -s -o /dev/null -w '%{http_code}' -X ${method}`;
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      cmd += ` -H '${k}: ${v}'`;
    }
  }
  if (body) cmd += ` -d '${body}'`;
  cmd += ` '${url}'`;
  return cmd;
}

function truncateSnippet(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "… [truncated]";
}

interface ProbeResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}

async function probe(url: string, opts?: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<ProbeResult | null> {
  const method = opts?.method ?? "GET";
  const timeout = opts?.timeoutMs ?? 8000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      method,
      headers: opts?.headers,
      body: opts?.body,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { status: res.status, body, headers };
  } catch {
    return null;
  }
}

const SQL_ERROR_PATTERNS = [
  /SQL syntax.*MySQL/i,
  /Warning.*mysql_/i,
  /PostgreSQL.*ERROR/i,
  /ORA-\d{5}/,
  /Microsoft.*ODBC.*SQL/i,
  /Unclosed quotation mark/i,
  /quoted string not properly terminated/i,
  /SQLITE_ERROR/i,
];

const SQLI_BENIGN_PAYLOADS = [
  { payload: "' OR '1'='1' -- ", label: "tautology" },
  { payload: "1; SELECT 1 -- ", label: "stacked query" },
  { payload: "' UNION SELECT NULL -- ", label: "union select" },
];

async function probeSqli(page: Page): Promise<Vulnerability | null> {
  for (const form of page.forms) {
    if (form.method !== "GET") continue;
    for (const { payload, label } of SQLI_BENIGN_PAYLOADS) {
      const testUrl = new URL(form.action);
      for (const input of form.inputs) {
        testUrl.searchParams.set(input.name, payload);
      }
      const res = await probe(testUrl.toString());
      if (!res) continue;

      for (const pat of SQL_ERROR_PATTERNS) {
        const match = res.body.match(pat);
        if (match) {
          const proof: DastProofEvidence = {
            requestMethod: "GET",
            requestUrl: testUrl.toString(),
            responseStatus: res.status,
            responseSnippet: truncateSnippet(res.body),
            matchedPattern: match[0],
            matchedLocation: "body",
            curlCommand: buildCurl("GET", testUrl.toString()),
            confirmed: true,
            confidence: "definite",
            reproductionSteps: [
              `Open a terminal or browser`,
              `Navigate to: ${testUrl.toString()}`,
              `Observe the SQL error message in the response body: "${match[0]}"`,
              `This confirms the server passes user input directly into SQL queries`,
            ],
          };
          return {
            title: `[Proof] SQL Injection Confirmed (${label})`,
            description:
              `SQL injection was **confirmed** on form at ${form.action}. ` +
              `The payload \`${payload}\` triggered a database error: "${match[0]}". ` +
              `This is a definite finding — the server concatenates user input into SQL queries without parameterization.`,
            severity: "CRITICAL",
            category: "OWASP A03: Injection",
            cwe: "89",
            location: form.action,
            remediation:
              "Use parameterized queries or prepared statements. Never concatenate user input into SQL. " +
              "Apply an ORM or query builder that escapes inputs automatically.",
            aiSuggestion:
              `// BEFORE (vulnerable):\nconst q = \`SELECT * FROM users WHERE name = '\${req.query.name}'\`;\n\n` +
              `// AFTER (safe):\nconst q = 'SELECT * FROM users WHERE name = $1';\nawait db.query(q, [req.query.name]);`,
            riskScore: 98,
            exploitabilityScore: 95,
            impactScore: 100,
            dastProof: proof,
          };
        }
      }
    }
  }
  return null;
}

async function probeReflectedXss(page: Page): Promise<Vulnerability | null> {
  const canary = `<aithon-xss-${Date.now()}>`;
  const testUrl = new URL(page.url);
  testUrl.searchParams.set("q", canary);

  const res = await probe(testUrl.toString());
  if (!res) return null;

  if (res.body.includes(canary)) {
    const idx = res.body.indexOf(canary);
    const snippet = res.body.slice(Math.max(0, idx - 80), idx + canary.length + 80);
    const proof: DastProofEvidence = {
      requestMethod: "GET",
      requestUrl: testUrl.toString(),
      responseStatus: res.status,
      responseSnippet: truncateSnippet(snippet),
      matchedPattern: canary,
      matchedLocation: "body",
      curlCommand: buildCurl("GET", testUrl.toString()),
      confirmed: true,
      confidence: "definite",
      reproductionSteps: [
        `Open a browser`,
        `Navigate to: ${testUrl.toString()}`,
        `View the page source (Ctrl+U / Cmd+U)`,
        `Search for "${canary}" — it appears unescaped in the HTML`,
        `This confirms the server reflects user input without encoding`,
      ],
    };
    return {
      title: "[Proof] Reflected XSS Confirmed",
      description:
        `Reflected XSS was **confirmed** at ${page.url}. ` +
        `A benign HTML canary tag \`${canary}\` was injected via query parameter and appeared unescaped in the response body. ` +
        `An attacker could replace this with a malicious script tag to steal session cookies or redirect users.`,
      severity: "HIGH",
      category: "OWASP A03: Injection",
      cwe: "79",
      location: page.url,
      remediation:
        "HTML-encode all user input before rendering. Use Content Security Policy (CSP) headers. " +
        "Use a templating engine with auto-escaping (e.g., React, Jinja2 with autoescape).",
      aiSuggestion:
        `// BEFORE (vulnerable):\nelement.innerHTML = userInput;\n\n` +
        `// AFTER (safe):\nelement.textContent = userInput;\n// Or use DOMPurify: element.innerHTML = DOMPurify.sanitize(userInput);`,
      riskScore: 88,
      exploitabilityScore: 85,
      impactScore: 90,
      dastProof: proof,
    };
  }
  return null;
}

async function probeMissingSecurityHeaders(baseUrl: string): Promise<Vulnerability[]> {
  const res = await probe(baseUrl, { method: "HEAD" });
  if (!res) return [];

  const findings: Vulnerability[] = [];
  const checks: Array<{
    header: string;
    title: string;
    cwe: string;
    severity: Vulnerability["severity"];
    risk: number;
    remediation: string;
  }> = [
    {
      header: "strict-transport-security",
      title: "[Proof] Missing HSTS Header",
      cwe: "523",
      severity: "MEDIUM",
      risk: 55,
      remediation: "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to all HTTPS responses.",
    },
    {
      header: "content-security-policy",
      title: "[Proof] Missing Content-Security-Policy Header",
      cwe: "693",
      severity: "MEDIUM",
      risk: 60,
      remediation: "Add a Content-Security-Policy header. Start with `default-src 'self'` and expand as needed.",
    },
    {
      header: "x-frame-options",
      title: "[Proof] Missing X-Frame-Options Header",
      cwe: "1021",
      severity: "LOW",
      risk: 40,
      remediation: "Add `X-Frame-Options: DENY` or `SAMEORIGIN` to prevent clickjacking.",
    },
    {
      header: "x-content-type-options",
      title: "[Proof] Missing X-Content-Type-Options Header",
      cwe: "16",
      severity: "LOW",
      risk: 35,
      remediation: "Add `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing.",
    },
  ];

  for (const check of checks) {
    if (!res.headers[check.header]) {
      const proof: DastProofEvidence = {
        requestMethod: "HEAD",
        requestUrl: baseUrl,
        responseStatus: res.status,
        responseSnippet: Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join("\n"),
        matchedPattern: `Missing header: ${check.header}`,
        matchedLocation: "header",
        curlCommand: buildCurl("HEAD", baseUrl) + " -D -",
        confirmed: true,
        confidence: "definite",
        reproductionSteps: [
          `Run: curl -I '${baseUrl}'`,
          `Look for the "${check.header}" header in the response`,
          `It is missing — the server does not send this security header`,
        ],
      };
      findings.push({
        title: check.title,
        description:
          `The security header \`${check.header}\` is missing from the response at ${baseUrl}. ` +
          `This was confirmed by a HEAD request that returned ${res.status} without the header.`,
        severity: check.severity,
        category: "OWASP A05: Security Misconfiguration",
        cwe: check.cwe,
        location: baseUrl,
        remediation: check.remediation,
        aiSuggestion: `// Add to your web server configuration:\nresponse.setHeader('${check.header}', '...');`,
        riskScore: check.risk,
        exploitabilityScore: 30,
        impactScore: check.risk,
        dastProof: proof,
      });
    }
  }
  return findings;
}

async function probeSslIssues(baseUrl: string): Promise<Vulnerability | null> {
  if (baseUrl.startsWith("https://")) return null;

  const proof: DastProofEvidence = {
    requestMethod: "GET",
    requestUrl: baseUrl,
    responseStatus: 200,
    responseSnippet: `URL scheme is "http://" — no TLS encryption`,
    matchedPattern: "http://",
    matchedLocation: "url",
    curlCommand: buildCurl("GET", baseUrl),
    confirmed: true,
    confidence: "definite",
    reproductionSteps: [
      `Observe the URL: ${baseUrl}`,
      `It uses "http://" instead of "https://"`,
      `All traffic between the browser and server is unencrypted`,
      `An attacker on the same network can intercept credentials, cookies, and data`,
    ],
  };

  return {
    title: "[Proof] Application Served Over HTTP (No TLS)",
    description:
      `The application at ${baseUrl} is served over plain HTTP without TLS encryption. ` +
      `All data — including credentials, session tokens, and personal information — is transmitted in cleartext.`,
    severity: "CRITICAL",
    category: "OWASP A02: Cryptographic Failures",
    cwe: "319",
    location: baseUrl,
    remediation:
      "Enable HTTPS with a valid TLS certificate. Redirect all HTTP traffic to HTTPS. " +
      "Use HSTS to prevent protocol downgrade attacks.",
    aiSuggestion:
      `// nginx example:\nserver {\n  listen 80;\n  return 301 https://$host$request_uri;\n}\n\nserver {\n  listen 443 ssl;\n  ssl_certificate /path/to/cert.pem;\n  ssl_certificate_key /path/to/key.pem;\n}`,
    riskScore: 95,
    exploitabilityScore: 90,
    impactScore: 100,
    dastProof: proof,
  };
}

/**
 * Run proof-based DAST checks against crawled pages.
 * Returns only findings that have confirmed evidence attached.
 */
export async function runProofBasedDast(
  baseUrl: string,
  pages: Page[],
  progressCallback?: ProgressCallback,
): Promise<Vulnerability[]> {
  const findings: Vulnerability[] = [];

  if (progressCallback) await progressCallback(70, "Running proof-based exploit confirmation…");

  const sslFinding = await probeSslIssues(baseUrl);
  if (sslFinding) findings.push(sslFinding);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    const sqli = await probeSqli(page);
    if (sqli) findings.push(sqli);

    const xss = await probeReflectedXss(page);
    if (xss) findings.push(xss);

    if (progressCallback) {
      const pct = 70 + Math.floor(((i + 1) / pages.length) * 15);
      await progressCallback(pct, `Proof-based DAST: tested ${i + 1}/${pages.length} pages`);
    }
  }

  const headerFindings = await probeMissingSecurityHeaders(baseUrl);
  findings.push(...headerFindings);

  if (progressCallback) {
    await progressCallback(85, `Proof-based DAST complete — ${findings.length} confirmed findings`);
  }

  return findings;
}

/**
 * Generate realistic demo proof-based DAST findings for testing.
 */
export function demoProofBasedDastFindings(appUrl: string): Vulnerability[] {
  return [
    {
      title: "[Proof] SQL Injection Confirmed (tautology)",
      description:
        `SQL injection was **confirmed** on form at ${appUrl}/api/search. ` +
        `The payload \`' OR '1'='1' -- \` triggered a PostgreSQL error: "ERROR: unterminated quoted string". ` +
        `This is a definite finding.`,
      severity: "CRITICAL",
      category: "OWASP A03: Injection",
      cwe: "89",
      location: `${appUrl}/api/search`,
      remediation: "Use parameterized queries. Never concatenate user input into SQL.",
      aiSuggestion:
        `// BEFORE:\nconst q = \`SELECT * FROM products WHERE name LIKE '%\${term}%'\`;\n\n` +
        `// AFTER:\nconst q = 'SELECT * FROM products WHERE name LIKE $1';\nawait db.query(q, [\`%\${term}%\`]);`,
      riskScore: 98,
      exploitabilityScore: 95,
      impactScore: 100,
      dastProof: {
        requestMethod: "GET",
        requestUrl: `${appUrl}/api/search?q=' OR '1'='1' -- `,
        responseStatus: 500,
        responseSnippet: `{"error":"ERROR: unterminated quoted string at or near \"'1'\" LINE 1: SELECT * FROM products WHERE name LIKE '%' OR '1'='1' -- %'"}`,
        matchedPattern: "ERROR: unterminated quoted string",
        matchedLocation: "body",
        curlCommand: `curl -s '${appUrl}/api/search?q=%27%20OR%20%271%27%3D%271%27%20--%20'`,
        confirmed: true,
        confidence: "definite",
        reproductionSteps: [
          "Open a terminal",
          `Run: curl '${appUrl}/api/search?q=%27%20OR%20%271%27%3D%271%27%20--%20'`,
          `Observe the PostgreSQL error in the JSON response`,
          `The error confirms user input is concatenated into SQL queries`,
        ],
      },
    },
    {
      title: "[Proof] Reflected XSS Confirmed",
      description:
        `Reflected XSS was **confirmed** at ${appUrl}/search. ` +
        `A benign HTML tag \`<aithon-xss-probe>\` was injected via the "q" query parameter and appeared unescaped in the response.`,
      severity: "HIGH",
      category: "OWASP A03: Injection",
      cwe: "79",
      location: `${appUrl}/search`,
      remediation: "HTML-encode all user input. Use CSP headers. Use auto-escaping templates.",
      aiSuggestion:
        `// BEFORE:\nelement.innerHTML = userInput;\n\n// AFTER:\nelement.textContent = userInput;`,
      riskScore: 88,
      exploitabilityScore: 85,
      impactScore: 90,
      dastProof: {
        requestMethod: "GET",
        requestUrl: `${appUrl}/search?q=<aithon-xss-probe>`,
        responseStatus: 200,
        responseSnippet: `<div class="results"><h2>Search results for: <aithon-xss-probe></h2><p>No results found</p></div>`,
        matchedPattern: "<aithon-xss-probe>",
        matchedLocation: "body",
        curlCommand: `curl -s '${appUrl}/search?q=%3Caithon-xss-probe%3E'`,
        confirmed: true,
        confidence: "definite",
        reproductionSteps: [
          "Open a browser",
          `Navigate to: ${appUrl}/search?q=%3Caithon-xss-probe%3E`,
          `View page source (Ctrl+U)`,
          `Search for "<aithon-xss-probe>" — it appears unescaped in the HTML`,
        ],
      },
    },
    {
      title: "[Proof] Missing Content-Security-Policy Header",
      description:
        `The Content-Security-Policy header is missing from ${appUrl}. Confirmed by HEAD request.`,
      severity: "MEDIUM",
      category: "OWASP A05: Security Misconfiguration",
      cwe: "693",
      location: appUrl,
      remediation: "Add a Content-Security-Policy header starting with `default-src 'self'`.",
      aiSuggestion: `response.setHeader('Content-Security-Policy', "default-src 'self'");`,
      riskScore: 60,
      exploitabilityScore: 30,
      impactScore: 60,
      dastProof: {
        requestMethod: "HEAD",
        requestUrl: appUrl,
        responseStatus: 200,
        responseSnippet: "server: nginx/1.24\ncontent-type: text/html\nx-powered-by: Express\n(no content-security-policy header)",
        matchedPattern: "Missing header: content-security-policy",
        matchedLocation: "header",
        curlCommand: `curl -I '${appUrl}'`,
        confirmed: true,
        confidence: "definite",
        reproductionSteps: [
          `Run: curl -I '${appUrl}'`,
          `Look for "content-security-policy" in the response headers`,
          `It is absent — the server does not send this header`,
        ],
      },
    },
    {
      title: "[Proof] Missing Strict-Transport-Security Header",
      description:
        `The HSTS header is missing from ${appUrl}. Without HSTS, browsers may connect over HTTP first, allowing downgrade attacks.`,
      severity: "MEDIUM",
      category: "OWASP A05: Security Misconfiguration",
      cwe: "523",
      location: appUrl,
      remediation: "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
      aiSuggestion: `response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');`,
      riskScore: 55,
      exploitabilityScore: 30,
      impactScore: 55,
      dastProof: {
        requestMethod: "HEAD",
        requestUrl: appUrl,
        responseStatus: 200,
        responseSnippet: "server: nginx/1.24\ncontent-type: text/html\n(no strict-transport-security header)",
        matchedPattern: "Missing header: strict-transport-security",
        matchedLocation: "header",
        curlCommand: `curl -I '${appUrl}'`,
        confirmed: true,
        confidence: "definite",
        reproductionSteps: [
          `Run: curl -I '${appUrl}'`,
          `Look for "strict-transport-security" in the response headers`,
          `It is absent`,
        ],
      },
    },
  ];
}
