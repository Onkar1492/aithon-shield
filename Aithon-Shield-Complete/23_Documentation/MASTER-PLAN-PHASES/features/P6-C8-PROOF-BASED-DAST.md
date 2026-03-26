# P6-C8 — Proof-Based DAST (Exploit Confirmation with Evidence)

**Phase:** 6  
**Category:** 2 (Competitive gap — Invicti's differentiator)  
**Status:** implemented — pending user verification

---

## What it does

Extends the existing web DAST scanner to **confirm vulnerabilities with evidence** instead of just detecting patterns. Each proof-based finding includes:

- The exact HTTP request that triggered the vulnerability
- A snippet of the server response showing the match
- The pattern that was matched and where (body, header, URL, status)
- A ready-to-run `curl` command to reproduce the finding
- Step-by-step reproduction instructions
- A confidence level: **definite**, **firm**, or **tentative**

This follows the model used by Invicti (formerly Netsparker), which differentiates "confirmed" findings from "possible" ones.

---

## Files changed / created

| File | Change |
|------|--------|
| `server/services/proofBasedDastService.ts` | **New** — proof-based DAST engine with SQLi, XSS, header, and SSL probes |
| `server/services/types.ts` | Added `DastProofEvidence` interface and `dastProof` field to `Vulnerability` |
| `server/services/webScanService.ts` | Integrated `runProofBasedDast()` into the scan orchestration pipeline |
| `server/routes.ts` | Updated web scan finding creation to persist `dastProof` JSON; added demo endpoint |
| `shared/schema.ts` | Added `dast_proof` text column to `findings` table; extended insert schema |
| `client/src/pages/ScanDetails.tsx` | Added "Exploit Proof Evidence" panel in finding detail dialog; added green "Proof" badge on finding cards |

---

## How it works

### Proof engine (`proofBasedDastService.ts`)

The engine runs **after** the standard OWASP testing phase and **before** SSL/header checks. It performs safe, read-only probes:

| Probe | What it does | Confidence |
|-------|-------------|------------|
| **SQL Injection** | Sends benign payloads (`' OR '1'='1'`, `UNION SELECT NULL`) to form actions; matches database error patterns (MySQL, PostgreSQL, Oracle, SQLite, MSSQL) | definite |
| **Reflected XSS** | Injects a unique canary HTML tag (`<aithon-xss-{timestamp}>`) via query params; checks if it appears unescaped in the response | definite |
| **Missing Security Headers** | HEAD request to check for HSTS, CSP, X-Frame-Options, X-Content-Type-Options | definite |
| **SSL/TLS** | Checks if the URL uses `http://` instead of `https://` | definite |

### Evidence structure (`DastProofEvidence`)

```typescript
interface DastProofEvidence {
  requestMethod: string;      // GET, POST, HEAD
  requestUrl: string;         // Full URL with payload
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseStatus: number;     // HTTP status code
  responseSnippet: string;    // Truncated response (max 500 chars)
  matchedPattern: string;     // What was matched
  matchedLocation: "body" | "header" | "status" | "url";
  curlCommand: string;        // Ready-to-run curl command
  confirmed: boolean;         // true if exploit was confirmed
  confidence: "definite" | "firm" | "tentative";
  reproductionSteps: string[];
}
```

### Persistence

The `dastProof` field is stored as a JSON string in the new `dast_proof` text column on the `findings` table. The frontend parses it when rendering the finding detail dialog.

### UI

- **Finding card** — A green "Proof" badge with a shield icon appears next to findings that have proof evidence
- **Finding detail dialog** — A new "Exploit Proof Evidence" section shows the request, response, matched pattern (highlighted in red), curl command, and reproduction steps

---

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/web-scans/:id/demo-proof-dast` | Generate demo proof-based DAST findings for testing |

Proof findings are standard findings returned by `GET /api/findings` with a populated `dastProof` field.

---

## Testing

### API test

```bash
# Generate demo proof findings for an existing web scan
curl -b cookie.txt -X POST http://localhost:5001/api/web-scans/<scan-id>/demo-proof-dast

# Verify findings have proof evidence
curl -b cookie.txt http://localhost:5001/api/findings | \
  python3 -c "import json,sys; [print(f['title']) for f in json.load(sys.stdin) if f.get('dastProof')]"
```

### Browser test

1. Navigate to a web scan's details page
2. Look for findings with green "Proof" badges
3. Click "View Details" on a proof finding
4. Verify the "Exploit Proof Evidence" panel shows request, response, matched pattern, curl command, and reproduction steps

---

## Remaining work

- Browser-based probing (Puppeteer/Playwright) for JavaScript-rendered SPAs
- Stored XSS detection with multi-step probes
- CSRF token validation probes
- Open redirect confirmation
- SSRF detection with out-of-band callbacks
- HAR file export for proof evidence
