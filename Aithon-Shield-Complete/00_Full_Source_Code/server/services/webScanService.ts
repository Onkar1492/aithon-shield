/**
 * Web Scan Service
 * Feature 7: Web Application DAST (Dynamic Application Security Testing)
 * 
 * Performs comprehensive web application security scanning including:
 * - Web crawling and page discovery
 * - OWASP Top 10 vulnerability testing
 * - SSL/TLS configuration analysis
 * - Security headers validation
 * 
 * Note: Full browser automation requires Puppeteer/Playwright. This implementation
 * uses basic HTTP requests. For JavaScript-rendered SPAs, install puppeteer or playwright.
 */

import type { Page, Form, AuthConfig, Vulnerability, ScanResult, WebScanConfig, ProgressCallback } from './types';
import { validateWebAppUrl } from './scanValidation';
import { runProofBasedDast } from './proofBasedDastService';
import { isDemoMode } from "../demoMode";
import { demoScanVulnerabilities } from "../demoScanResults";

/**
 * Crawl web application and discover pages, forms, and endpoints
 * 
 * Note: Simplified implementation using HTTP requests. For full SPA support,
 * install puppeteer or playwright for browser automation.
 */
export async function crawlWebApplication(
  baseUrl: string,
  authConfig?: AuthConfig,
  progressCallback?: ProgressCallback
): Promise<Page[]> {
  // Validate web app URL format
  const validation = validateWebAppUrl(baseUrl);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid web application URL');
  }

  const pages: Page[] = [];
  const visitedUrls = new Set<string>();
  const urlQueue: string[] = [baseUrl];
  const maxPages = 50; // Limit crawling depth
  
  if (progressCallback) {
    await progressCallback(0, 'Starting web crawl...');
  }
  
  try {
    while (urlQueue.length > 0 && pages.length < maxPages) {
      const currentUrl = urlQueue.shift()!;
      
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);
      
      try {
        // Fetch page content
        const headers: HeadersInit = {};
        
        // Add authentication if provided
        if (authConfig) {
          if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
            const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          } else if (authConfig.type === 'api-key' && authConfig.apiKey) {
            headers[authConfig.tokenHeader || 'Authorization'] = `Bearer ${authConfig.apiKey}`;
          }
        }
        
        const response = await fetch(currentUrl, {
          headers,
          redirect: 'follow',
        });
        
        if (!response.ok) continue;
        
        const html = await response.text();
        
        // Extract links
        const linkRegex = /href=["']([^"']+)["']/gi;
        const links: string[] = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          const link = match[1];
          if (link && !link.startsWith('#') && !link.startsWith('javascript:')) {
            try {
              const absoluteUrl = new URL(link, currentUrl).href;
              if (absoluteUrl.startsWith(baseUrl) && !visitedUrls.has(absoluteUrl)) {
                links.push(absoluteUrl);
                urlQueue.push(absoluteUrl);
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
        
        // Extract forms
        const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
        const forms: Form[] = [];
        while ((match = formRegex.exec(html)) !== null) {
          const formHtml = match[1];
          const actionMatch = formHtml.match(/action=["']([^"']+)["']/i);
          const methodMatch = formHtml.match(/method=["']([^"']+)["']/i);
          const inputRegex = /<input[^>]*>/gi;
          const inputs: Array<{ name: string; type: string; required: boolean }> = [];
          
          let inputMatch;
          while ((inputMatch = inputRegex.exec(formHtml)) !== null) {
            const inputHtml = inputMatch[0];
            const nameMatch = inputHtml.match(/name=["']([^"']+)["']/i);
            const typeMatch = inputHtml.match(/type=["']([^"']+)["']/i);
            const required = /required/i.test(inputHtml);
            
            if (nameMatch) {
              inputs.push({
                name: nameMatch[1],
                type: typeMatch ? typeMatch[1] : 'text',
                required,
              });
            }
          }
          
          forms.push({
            action: actionMatch ? new URL(actionMatch[1], currentUrl).href : currentUrl,
            method: methodMatch ? methodMatch[1].toUpperCase() : 'GET',
            inputs,
          });
        }
        
        // Extract API endpoints (look for common patterns)
        const endpointRegex = /(?:fetch|axios|\.get|\.post|\.put|\.delete)\s*\(["']([^"']+)["']/gi;
        const endpoints: string[] = [];
        while ((match = endpointRegex.exec(html)) !== null) {
          const endpoint = match[1];
          try {
            const absoluteUrl = new URL(endpoint, currentUrl).href;
            if (absoluteUrl.startsWith(baseUrl)) {
              endpoints.push(absoluteUrl);
            }
          } catch {
            // Invalid URL, skip
          }
        }
        
        pages.push({
          url: currentUrl,
          forms,
          links,
          endpoints,
        });
        
        if (progressCallback) {
          const progress = Math.floor((pages.length / maxPages) * 30);
          await progressCallback(progress, `Crawled ${pages.length} pages`);
        }
      } catch (error) {
        // Skip pages that can't be fetched
        continue;
      }
    }
  } catch (error: any) {
    if (progressCallback) {
      await progressCallback(30, `Crawl error: ${error.message}`);
    }
  }
  
  if (progressCallback) {
    await progressCallback(30, `Crawl complete. Found ${pages.length} pages`);
  }
  
  return pages;
}

/**
 * Perform OWASP Top 10 vulnerability testing
 */
export async function performOWASPTesting(
  pages: Page[],
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];
  
  if (progressCallback) {
    await progressCallback(30, 'Starting OWASP Top 10 testing...');
  }
  
  // Test each page
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    
    // Test 1: Injection vulnerabilities (SQL, NoSQL, Command)
    for (const form of page.forms) {
      // Test SQL Injection
      const sqlPayloads = ["' OR '1'='1", "1' UNION SELECT NULL--", "admin'--"];
      for (const payload of sqlPayloads) {
        try {
          const testUrl = new URL(form.action);
          if (form.method === 'GET') {
            form.inputs.forEach(input => {
              testUrl.searchParams.set(input.name, payload);
            });
            const response = await fetch(testUrl.toString());
            const text = await response.text();
            
            // Check for SQL error patterns
            if (/SQL syntax|mysql_fetch|PostgreSQL|ORA-\d{5}|Microsoft.*ODBC/i.test(text)) {
              vulnerabilities.push({
                title: 'SQL Injection Vulnerability Detected',
                description: `Form at ${form.action} appears vulnerable to SQL injection. Error messages in response suggest database interaction.`,
                severity: 'CRITICAL',
                category: 'OWASP A03: Injection',
                cwe: '89',
                location: form.action,
                remediation: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL queries.',
                aiSuggestion: `VULNERABLE FORM: ${form.action}\n\nFIXED — use parameterized queries:\n  // BEFORE (vulnerable):\n  const query = \`SELECT * FROM users WHERE name = '\${userInput}'\`;\n\n  // AFTER (safe):\n  const query = 'SELECT * FROM users WHERE name = ?';\n  db.query(query, [userInput]);`,
                riskScore: 95,
                exploitabilityScore: 90,
                impactScore: 100,
              });
              break;
            }
          }
        } catch {
          // Skip if test fails
        }
      }
    }
    
    // Test 2: XSS vulnerabilities
    const xssPayloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'javascript:alert(1)'];
    for (const payload of xssPayloads) {
      try {
        const testUrl = new URL(page.url);
        testUrl.searchParams.set('test', payload);
        const response = await fetch(testUrl.toString());
        const text = await response.text();
        
        // Check if payload is reflected in response
        if (text.includes(payload) && !text.includes('&lt;script&gt;')) {
          vulnerabilities.push({
            title: 'Reflected XSS Vulnerability Detected',
            description: `Page at ${page.url} reflects user input without proper encoding, making it vulnerable to XSS attacks.`,
            severity: 'HIGH',
            category: 'OWASP A03: Injection',
            cwe: '79',
            location: page.url,
            remediation: 'Encode all user input before rendering. Use Content Security Policy (CSP) headers.',
            aiSuggestion: `VULNERABLE PAGE: ${page.url}\n\nFIXED — encode user input:\n  // BEFORE (vulnerable):\n  element.innerHTML = userInput;\n\n  // AFTER (safe):\n  element.textContent = userInput;\n  // Or use DOMPurify.sanitize(userInput)`,
            riskScore: 85,
            exploitabilityScore: 80,
            impactScore: 90,
          });
          break;
        }
      } catch {
        // Skip if test fails
      }
    }
    
    // Test 3: Broken Authentication (check for common issues)
    for (const form of page.forms) {
      // Check if login form uses HTTP instead of HTTPS
      if (form.action.startsWith('http://') && 
          (form.inputs.some(i => i.type === 'password') || 
           form.action.toLowerCase().includes('login'))) {
        vulnerabilities.push({
          title: 'Login Form Over HTTP',
          description: `Login form at ${form.action} is served over HTTP instead of HTTPS, exposing credentials to interception.`,
          severity: 'HIGH',
          category: 'OWASP A02: Broken Authentication',
          cwe: '319',
          location: form.action,
          remediation: 'Always use HTTPS for authentication forms. Redirect HTTP to HTTPS.',
          aiSuggestion: `VULNERABLE FORM: ${form.action}\n\nFIXED — use HTTPS:\n  // Redirect HTTP to HTTPS:\n  if (req.protocol === 'http') {\n    return res.redirect('https://' + req.hostname + req.url);\n  }`,
          riskScore: 80,
          exploitabilityScore: 75,
          impactScore: 85,
        });
      }
    }
    
    // Test 4: Sensitive Data Exposure (check for common patterns)
    try {
      const response = await fetch(page.url);
      const text = await response.text();
      
      // Check for exposed API keys, tokens, etc.
      if (/(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/i.test(text)) {
        vulnerabilities.push({
          title: 'Sensitive Data Exposed in Page Source',
          description: `Page at ${page.url} contains what appears to be hardcoded credentials or API keys in the HTML source.`,
          severity: 'HIGH',
          category: 'OWASP A01: Broken Access Control',
          cwe: '200',
          location: page.url,
          remediation: 'Remove hardcoded credentials from client-side code. Use environment variables or secure API endpoints.',
          aiSuggestion: `VULNERABLE PAGE: ${page.url}\n\nFIXED — remove from source:\n  // BEFORE (dangerous):\n  const apiKey = "sk_live_1234567890";\n\n  // AFTER (safe):\n  const apiKey = process.env.API_KEY;`,
          riskScore: 75,
          exploitabilityScore: 70,
          impactScore: 80,
        });
      }
    } catch {
      // Skip if fetch fails
    }
    
    if (progressCallback) {
      const progress = 30 + Math.floor(((i + 1) / pages.length) * 40);
      await progressCallback(progress, `Testing page ${i + 1}/${pages.length}`);
    }
  }
  
  if (progressCallback) {
    await progressCallback(70, `OWASP testing complete. Found ${vulnerabilities.length} vulnerabilities`);
  }
  
  return vulnerabilities;
}

/**
 * Perform SSL/TLS configuration analysis
 */
export async function performSSLTLSAnalysis(url: string): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];
  
  try {
    const urlObj = new URL(url);
    
    // Check if HTTPS is used
    if (urlObj.protocol !== 'https:') {
      vulnerabilities.push({
        title: 'Application Not Using HTTPS',
        description: `Application at ${url} is not using HTTPS, exposing all traffic to interception and man-in-the-middle attacks.`,
        severity: 'CRITICAL',
        category: 'SSL/TLS Configuration',
        cwe: '319',
        location: url,
        remediation: 'Enable HTTPS/TLS for all application traffic. Obtain SSL certificate and configure server.',
        aiSuggestion: `VULNERABLE APPLICATION: ${url}\n\nFIXED — enable HTTPS:\n  // Configure SSL certificate in server:\n  // Use Let's Encrypt for free certificates\n  // Redirect HTTP to HTTPS`,
        riskScore: 100,
        exploitabilityScore: 95,
        impactScore: 100,
      });
      return vulnerabilities;
    }
    
    // Basic SSL check - in production, use a proper SSL checker library
    try {
      const response = await fetch(url, { method: 'HEAD' });
      // If fetch succeeds, SSL is working (basic check)
      // For detailed analysis, use libraries like node-ssl-checker
    } catch (error: any) {
      if (error.message.includes('certificate') || error.message.includes('SSL')) {
        vulnerabilities.push({
          title: 'SSL Certificate Error',
          description: `SSL certificate for ${url} has issues: ${error.message}`,
          severity: 'HIGH',
          category: 'SSL/TLS Configuration',
          cwe: '295',
          location: url,
          remediation: 'Fix SSL certificate issues. Ensure certificate is valid, not expired, and properly configured.',
          aiSuggestion: `SSL ERROR: ${url}\n\nFIXED — check certificate:\n  // Verify certificate:\n  // 1. Check expiration date\n  // 2. Verify certificate chain\n  // 3. Ensure proper configuration`,
          riskScore: 85,
          exploitabilityScore: 80,
          impactScore: 90,
        });
      }
    }
  } catch (error) {
    // URL parsing error
  }
  
  return vulnerabilities;
}

/**
 * Check security headers
 */
export async function checkSecurityHeaders(url: string): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const headers = response.headers;
    
    // Check for HSTS header
    if (!headers.get('strict-transport-security')) {
      vulnerabilities.push({
        title: 'Missing HSTS Header',
        description: `Application at ${url} does not include Strict-Transport-Security header, allowing downgrade attacks.`,
        severity: 'MEDIUM',
        category: 'Security Headers',
        cwe: '319',
        location: url,
        remediation: 'Add Strict-Transport-Security header with max-age directive.',
        aiSuggestion: `MISSING HEADER: ${url}\n\nFIXED — add HSTS header:\n  // Express.js example:\n  app.use((req, res, next) => {\n    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');\n    next();\n  });`,
        riskScore: 60,
        exploitabilityScore: 55,
        impactScore: 65,
      });
    }
    
    // Check for CSP header
    if (!headers.get('content-security-policy')) {
      vulnerabilities.push({
        title: 'Missing Content Security Policy',
        description: `Application at ${url} does not include Content-Security-Policy header, vulnerable to XSS attacks.`,
        severity: 'HIGH',
        category: 'Security Headers',
        cwe: '79',
        location: url,
        remediation: 'Add Content-Security-Policy header to prevent XSS attacks.',
        aiSuggestion: `MISSING HEADER: ${url}\n\nFIXED — add CSP header:\n  // Example CSP:\n  res.setHeader('Content-Security-Policy', \"default-src 'self'; script-src 'self' 'unsafe-inline';\");`,
        riskScore: 75,
        exploitabilityScore: 70,
        impactScore: 80,
      });
    }
    
    // Check for X-Frame-Options
    if (!headers.get('x-frame-options')) {
      vulnerabilities.push({
        title: 'Missing X-Frame-Options Header',
        description: `Application at ${url} does not include X-Frame-Options header, vulnerable to clickjacking attacks.`,
        severity: 'MEDIUM',
        category: 'Security Headers',
        cwe: '1021',
        location: url,
        remediation: 'Add X-Frame-Options header with DENY or SAMEORIGIN value.',
        aiSuggestion: `MISSING HEADER: ${url}\n\nFIXED — add X-Frame-Options:\n  res.setHeader('X-Frame-Options', 'DENY');`,
        riskScore: 55,
        exploitabilityScore: 50,
        impactScore: 60,
      });
    }
    
    // Check for X-Content-Type-Options
    if (!headers.get('x-content-type-options')) {
      vulnerabilities.push({
        title: 'Missing X-Content-Type-Options Header',
        description: `Application at ${url} does not include X-Content-Type-Options header, vulnerable to MIME sniffing attacks.`,
        severity: 'LOW',
        category: 'Security Headers',
        cwe: '693',
        location: url,
        remediation: 'Add X-Content-Type-Options header with nosniff value.',
        aiSuggestion: `MISSING HEADER: ${url}\n\nFIXED — add header:\n  res.setHeader('X-Content-Type-Options', 'nosniff');`,
        riskScore: 40,
        exploitabilityScore: 35,
        impactScore: 45,
      });
    }
  } catch (error) {
    // Skip if fetch fails
  }
  
  return vulnerabilities;
}

/**
 * Main web application scan function
 * 
 * Orchestrates complete web application security scanning:
 * 1. Crawling (0-30%)
 * 2. OWASP Testing (30-70%)
 * 3. SSL/TLS Analysis (70-85%)
 * 4. Headers Check (85-95%)
 * 5. Finalize (95-100%)
 */
export async function scanWebApp(
  appUrl: string,
  config: WebScanConfig,
  progressCallback?: ProgressCallback
): Promise<ScanResult> {
  const startTime = Date.now();

  if (isDemoMode()) {
    if (progressCallback) {
      await progressCallback(5, "Demo mode: skipping live crawl, SSL, and header checks");
      await progressCallback(100, "Demo web scan complete");
    }
    return {
      vulnerabilities: demoScanVulnerabilities("web"),
      scanId: config.scanId,
      scanType: "web",
      completedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }

  const allVulnerabilities: Vulnerability[] = [];
  const defaultMods = ["SAST", "DAST", "SCA", "Secrets"];
  const mods = config.securityModules?.length ? config.securityModules : defaultMods;
  const runDast = mods.includes("DAST");
  const runSslHeaders = mods.includes("Secrets") || mods.includes("DAST");

  try {
    if (progressCallback) {
      await progressCallback(0, "Starting web application scan...");
    }

    if (mods.includes("SAST") && progressCallback) {
      await progressCallback(5, "SAST on live URL: not available in this engine (use MVP repo scan for static analysis)");
    }
    if (mods.includes("SCA") && progressCallback) {
      await progressCallback(8, "SCA on live URL: not available in this engine (use MVP repo scan for dependencies)");
    }

    const authConfig: AuthConfig | undefined = config.authenticationType
      ? {
          type: config.authenticationType as "basic" | "form" | "api-key",
          username: config.username,
          password: config.password,
          apiKey: config.password,
          loginUrl: undefined,
        }
      : undefined;

    // Step 1–2: Crawl + OWASP (DAST)
    if (runDast) {
      const pages = await crawlWebApplication(
        appUrl,
        authConfig,
        async (progress, stage) => {
          if (progressCallback) {
            await progressCallback(Math.floor(progress * 0.3), stage);
          }
        },
      );
      const owaspVulnerabilities = await performOWASPTesting(
        pages,
        async (progress, stage) => {
          if (progressCallback) {
            await progressCallback(30 + Math.floor((progress - 30) * 0.4), stage);
          }
        },
      );
      allVulnerabilities.push(...owaspVulnerabilities);
    } else if (progressCallback) {
      await progressCallback(30, "DAST skipped (dynamic crawl + OWASP tests disabled)");
    }

    // Step 3: Proof-Based DAST — exploit confirmation (70-85%)
    const proofFindings = await runProofBasedDast(
      appUrl,
      pages,
      async (progress, stage) => {
        if (progressCallback) await progressCallback(progress, stage);
      },
    );
    allVulnerabilities.push(...proofFindings);

    // Step 4: SSL/TLS Analysis (85-90%)
    if (runSslHeaders) {
      if (progressCallback) {
        await progressCallback(70, "Analyzing SSL/TLS configuration...");
      }
      const sslVulnerabilities = await performSSLTLSAnalysis(appUrl);
      allVulnerabilities.push(...sslVulnerabilities);
      if (progressCallback) {
        await progressCallback(85, "SSL/TLS analysis complete");
      }
    } else if (progressCallback) {
      await progressCallback(70, "SSL/TLS checks skipped (enable DAST or Secrets)");
    }

    // Step 5: Security Headers Check (90-95%)
    if (runSslHeaders) {
      if (progressCallback) {
        await progressCallback(85, "Checking security headers...");
      }
      const headerVulnerabilities = await checkSecurityHeaders(appUrl);
      allVulnerabilities.push(...headerVulnerabilities);
      if (progressCallback) {
        await progressCallback(95, "Security headers check complete");
      }
    }
    
    // Step 6: Finalize (95-100%)
    const duration = Date.now() - startTime;
    
    if (progressCallback) {
      await progressCallback(100, `Scan complete. Found ${allVulnerabilities.length} vulnerabilities`);
    }
    
    return {
      vulnerabilities: allVulnerabilities,
      scanId: config.scanId,
      scanType: 'web',
      completedAt: new Date(),
      duration,
    };
  } catch (error: any) {
    if (progressCallback) {
      await progressCallback(100, `Scan failed: ${error.message}`);
    }
    throw error;
  }
}
