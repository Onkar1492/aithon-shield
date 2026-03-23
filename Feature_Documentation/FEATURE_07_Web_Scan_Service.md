# Feature 7: Web App Scan Service (DAST)

**Feature ID:** FEATURE-07  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 10-12 hours  
**Dependencies:** Features 2-3 (Types, Security Analyzer)  
**Related Todos:** Task 3

---

## Overview

Create comprehensive web application DAST (Dynamic Application Security Testing) service that crawls web apps, performs OWASP Top 10 testing, SSL/TLS analysis, and security headers checks.

---

## Requirements

### Functions to Implement

1. **`crawlWebApplication(baseUrl: string, authConfig?: AuthConfig, progressCallback?: ProgressCallback): Promise<Page[]>`**
   - Crawls web application using Puppeteer/Playwright
   - Discovers links, forms, API endpoints
   - Handles JavaScript-rendered content

2. **`performOWASPTesting(pages: Page[], progressCallback?: ProgressCallback): Promise<Vulnerability[]>`**
   - Tests OWASP Top 10 vulnerabilities
   - Injection, XSS, broken auth, etc.
   - Returns vulnerability findings

3. **`performSSLTLSAnalysis(url: string): Promise<Vulnerability[]>`**
   - Analyzes SSL/TLS configuration
   - Checks certificate validity
   - Checks cipher suites

4. **`checkSecurityHeaders(url: string): Promise<Vulnerability[]>`**
   - Checks security headers
   - HSTS, CSP, X-Frame-Options, etc.

5. **`scanWebApp(appUrl: string, config: WebScanConfig, progressCallback?: ProgressCallback): Promise<ScanResult>`**
   - Main web scan function
   - Orchestrates all testing
   - Returns complete results

---

## Implementation Details

### Files to Create

1. **`server/services/webScanService.ts`**
   - Main web scan service

2. **`server/services/webCrawler.ts`**
   - Web crawling logic

3. **`server/services/owaspTester.ts`**
   - OWASP Top 10 testing

4. **`server/services/sslAnalyzer.ts`**
   - SSL/TLS analysis

### Dependencies Required

- `puppeteer` or `playwright` - Browser automation
- `node-fetch` - HTTP requests

### OWASP Top 10 Tests

1. **Injection** - SQL, NoSQL, Command, LDAP
2. **Broken Authentication** - Login forms, session management
3. **Sensitive Data Exposure** - Unencrypted data, weak encryption
4. **XXE** - XML External Entities
5. **Broken Access Control** - IDOR, privilege escalation
6. **Security Misconfiguration** - Default credentials, exposed dirs
7. **XSS** - Reflected, stored, DOM-based
8. **Insecure Deserialization** - Deserialization endpoints
9. **Known Vulnerabilities** - Outdated frameworks
10. **Insufficient Logging** - Missing security event logging

---

## Function Signatures

```typescript
export interface Page {
  url: string;
  forms: Form[];
  links: string[];
  endpoints: string[];
}

export interface AuthConfig {
  type: 'basic' | 'form' | 'api-key';
  username?: string;
  password?: string;
  apiKey?: string;
  loginUrl?: string;
}

export async function crawlWebApplication(
  baseUrl: string,
  authConfig?: AuthConfig,
  progressCallback?: ProgressCallback
): Promise<Page[]>;

export async function performOWASPTesting(
  pages: Page[],
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;

export async function performSSLTLSAnalysis(
  url: string
): Promise<Vulnerability[]>;

export async function checkSecurityHeaders(
  url: string
): Promise<Vulnerability[]>;

export async function scanWebApp(
  appUrl: string,
  config: WebScanConfig,
  progressCallback?: ProgressCallback
): Promise<ScanResult>;
```

---

## Progress Tracking

- **Crawling** (0-30%): Pages discovered
- **OWASP Testing** (30-70%): Tests performed
- **SSL/TLS Analysis** (70-85%): Certificate checks
- **Headers Check** (85-95%): Header validation
- **Finalizing** (95-100%): Results aggregation

---

## Error Handling

- App unreachable: Connection timeout, DNS failure
- Authentication failures: Invalid credentials
- SSL errors: Certificate issues
- Rate limiting: 429 responses with backoff

---

## Testing

### Test Cases

1. **Web Crawling**
   - Test SPA crawling
   - Test form discovery
   - Test authentication
   - Test rate limiting

2. **OWASP Testing**
   - Test injection vulnerabilities
   - Test XSS vulnerabilities
   - Test authentication flaws
   - Test all Top 10 categories

3. **SSL/TLS Analysis**
   - Test valid certificates
   - Test expired certificates
   - Test weak ciphers

4. **Full Scan**
   - Test end-to-end scan
   - Test progress tracking
   - Test error handling

---

## Acceptance Criteria

- [ ] Web crawling works for SPAs
- [ ] OWASP Top 10 tests functional
- [ ] SSL/TLS analysis accurate
- [ ] Security headers checked
- [ ] Progress tracking works
- [ ] Error handling comprehensive
- [ ] Unit tests pass
- [ ] Integration tests pass

---

## Notes

- Uses Puppeteer/Playwright for browser automation
- Respects robots.txt (with warning)
- Handles JavaScript-rendered content
- Will be integrated in Feature 10 (Endpoint Updates)

---

## Next Steps

After this feature is complete:
- Feature 10: Web Endpoint Updates (will use this service)
- Feature 12: Error Handling (will enhance this)
