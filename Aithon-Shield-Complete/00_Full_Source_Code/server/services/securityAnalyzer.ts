/**
 * Security Analyzer Service
 * Feature 3: Shared Vulnerability Detection
 * 
 * Extracts vulnerability detection patterns from the linter scan endpoint
 * into reusable functions for MVP, Web, and Mobile scan services.
 */

import type { Vulnerability } from './types';

/**
 * Helper function to find line numbers matching a pattern
 */
function findMatchingLines(code: string, pattern: RegExp): Array<{ line: number; content: string }> {
  const lines = code.split('\n');
  const matches: Array<{ line: number; content: string }> = [];
  
  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      matches.push({ line: index + 1, content: line.trim() });
    }
  });
  
  return matches;
}

/**
 * Helper function to find first matching line
 */
function findFirstMatch(code: string, pattern: RegExp): { line: number; content: string } | null {
  const matches = findMatchingLines(code, pattern);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Detect SQL Injection vulnerabilities
 * 
 * Detects:
 * - Template literals in SQL queries (JS/TS)
 * - String concatenation in SQL queries
 * - f-strings or % formatting in Python SQL queries
 */
export function detectSQLInjection(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isPython = language.toLowerCase() === 'python';
  
  const sqlPatterns = isPython
    ? [
        // Python: f-string, %-format, or concatenation inside execute()
        /(?:cursor|conn|db)\.execute\s*\(\s*(?:f["']|["'][^"']*%[^s]|["'][^"']*\+)/i,
        /(?:cursor|conn|db)\.execute\s*\(\s*["'][^"']*(SELECT|INSERT|UPDATE|DELETE)[^"']*["']\s*%/i,
        /(?:cursor|conn|db)\.execute\s*\(\s*f["']/i,
        /(?:cursor|conn|db)\.execute\s*\(.*\+\s*\w/i,
      ]
    : [
        // JS/TS: template literals or concatenation in SQL
        /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*\$\{/i,
        /(?:query|sql|stmt)\s*[+=]\s*[`"'].*\+\s*\w/i,
        /db\.(query|execute|run)\s*\(\s*[`"'].*\$\{/i,
      ];
  
  for (const pattern of sqlPatterns) {
    const match = findFirstMatch(code, pattern);
    if (match) {
      const location = filePath ? `${filePath}:${match.line}` : `Line ${match.line}`;
      vulnerabilities.push({
        title: 'SQL Injection — Unsanitised Input in Query',
        description: `${location}: \`${match.content}\`\n\nThis line builds a SQL query by embedding a variable directly into the query string. An attacker who controls that variable can inject arbitrary SQL — reading, modifying, or deleting any data in the database.`,
        severity: 'CRITICAL',
        category: 'Code Security',
        cwe: '89',
        location,
        remediation: isPython
          ? 'Pass user values as the second argument to cursor.execute() — never build the SQL string from them.'
          : 'Use parameterised queries: pass the SQL string with placeholders (? or $1) and values separately. Never build SQL with string concatenation.',
        aiSuggestion: isPython
          ? `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — use parameterised query:\n  # BEFORE (vulnerable):\n  ${match.content}\n\n  # AFTER (safe):\n  cursor.execute("SELECT * FROM users WHERE name = %s", (username,))\n  # The second argument tuple is sanitised automatically by the DB driver`
          : `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — use parameterised query:\n  // BEFORE (vulnerable):\n  ${match.content}\n\n  // AFTER (safe):\n  const q = 'SELECT * FROM users WHERE id = ?';\n  db.query(q, [id]);  // driver sanitises values automatically`,
        riskScore: 95,
        exploitabilityScore: 90,
        impactScore: 100,
      });
      break; // Only report first match
    }
  }
  
  return vulnerabilities;
}

/**
 * Detect hardcoded credentials (passwords, API keys, tokens, secrets)
 */
export function detectHardcodedCredentials(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isPython = language.toLowerCase() === 'python';
  
  const secretPattern = /(?:password|passwd|pwd|secret|api_key|apikey|access_key|auth_token|private_key|client_secret)\s*[:=]\s*["'`][A-Za-z0-9!@#$%^&*()\-_+=]{6,}/i;
  const match = findFirstMatch(code, secretPattern);
  
  if (match) {
    const varMatch = match.content.match(/^(\w+)\s*[:=]/);
    const varName = varMatch ? varMatch[1] : 'credential';
    const location = filePath ? `${filePath}:${match.line}` : `Line ${match.line}`;
    
    vulnerabilities.push({
      title: 'Hardcoded Credential in Source Code',
      description: `${location}: \`${match.content}\`\n\nA secret value is hard-coded directly into the source file. If this file is committed to version control (Git, GitHub, etc.) the secret is exposed to everyone with read access — including public repositories. Secrets embedded in code cannot be rotated without a code change.`,
      severity: 'CRITICAL',
      category: 'Code Security',
      cwe: '798',
      location,
      remediation: isPython
        ? 'Load the value from an environment variable using os.environ.get(). Store secrets in a .env file (excluded from git via .gitignore) or a secrets manager.'
        : 'Load the value from process.env at runtime. Store secrets in a .env file excluded from git, or use a secrets manager (AWS Secrets Manager, Vault, etc.).',
      aiSuggestion: isPython
        ? `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — load from environment:\n  import os\n\n  # BEFORE (dangerous):\n  ${match.content}\n\n  # AFTER (safe):\n  ${varName} = os.environ.get("${varName.toUpperCase()}")\n  if not ${varName}:\n      raise EnvironmentError("${varName.toUpperCase()} environment variable is not set")\n\n  # Add to .env file (never commit this file):\n  # ${varName.toUpperCase()}=your_actual_secret_here\n  # And add .env to .gitignore`
        : `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — load from environment:\n  // BEFORE (dangerous):\n  ${match.content}\n\n  // AFTER (safe):\n  const ${varName} = process.env.${varName.toUpperCase()};\n  if (!${varName}) throw new Error("${varName.toUpperCase()} environment variable is required");\n\n  // .env file (never commit this):\n  // ${varName.toUpperCase()}=your_actual_secret_here`,
      riskScore: 100,
      exploitabilityScore: 100,
      impactScore: 100,
    });
  }
  
  return vulnerabilities;
}

/**
 * Detect Cross-Site Scripting (XSS) vulnerabilities
 * 
 * Detects:
 * - innerHTML usage
 * - document.write()
 * - dangerouslySetInnerHTML (React)
 */
export function detectXSS(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isJS = language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript';
  
  if (!isJS) {
    return vulnerabilities; // XSS is primarily a web/JS vulnerability
  }
  
  const xssPattern = /\.innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML/;
  const match = findFirstMatch(code, xssPattern);
  
  if (match) {
    const method = match.content.includes('document.write') ? 'document.write()'
      : match.content.includes('dangerouslySetInnerHTML') ? 'dangerouslySetInnerHTML'
      : 'innerHTML';
    const location = filePath ? `${filePath}:${match.line}` : `Line ${match.line}`;
    
    vulnerabilities.push({
      title: `XSS Vulnerability — Unsafe DOM Write via ${method}`,
      description: `${location}: \`${match.content}\`\n\nThis line writes content directly into the DOM using ${method}. If the content contains any user-supplied, URL-derived, or API-returned data, an attacker can inject a <script> tag or event handler that executes in the victim's browser — stealing sessions, redirecting to phishing sites, or performing actions on behalf of the user (Cross-Site Scripting).`,
      severity: 'HIGH',
      category: 'Code Security',
      cwe: '79',
      location,
      remediation: 'Use textContent (not innerHTML) for plain text. If HTML must be rendered, sanitize it first with DOMPurify.sanitize() before assignment. Never write unsanitised data to the DOM.',
      aiSuggestion: `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED:\n  // BEFORE (vulnerable):\n  ${match.content}\n\n  // AFTER — plain text (no HTML interpretation):\n  element.textContent = userContent;\n\n  // AFTER — if HTML formatting is required:\n  import DOMPurify from 'dompurify';\n  element.innerHTML = DOMPurify.sanitize(userContent);\n  // DOMPurify strips all script tags and dangerous attributes`,
      riskScore: 85,
      exploitabilityScore: 80,
      impactScore: 90,
    });
  }
  
  return vulnerabilities;
}

/**
 * Detect Command Injection vulnerabilities
 * 
 * Detects:
 * - subprocess with shell=True (Python)
 * - os.system, os.popen (Python)
 */
export function detectCommandInjection(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isPython = language.toLowerCase() === 'python';
  
  if (!isPython) {
    return vulnerabilities; // Command injection patterns are Python-specific here
  }
  
  const shellPatterns = [
    /subprocess\.\w+\s*\(.*shell\s*=\s*True/i,
    /os\.system\s*\(/,
    /os\.popen\s*\(/,
  ];
  
  for (const pattern of shellPatterns) {
    const match = findFirstMatch(code, pattern);
    if (match) {
      const location = filePath ? `${filePath}:${match.line}` : `Line ${match.line}`;
      vulnerabilities.push({
        title: 'Command Injection — Shell Execution with User Input',
        description: `${location}: \`${match.content}\`\n\nThis line passes a command to the system shell (shell=True, os.system, or os.popen). If any part of the command string is derived from user input, an attacker can append shell metacharacters (; | && || $()) to run arbitrary operating system commands — reading files, creating users, exfiltrating data, or installing malware.`,
        severity: 'CRITICAL',
        category: 'Code Security',
        cwe: '78',
        location,
        remediation: 'Use subprocess.run() with shell=False (the default) and pass the command as a list. Never interpolate user input into shell strings.',
        aiSuggestion: `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — pass command as list, no shell:\n  # BEFORE (dangerous — shell=True):\n  ${match.content}\n\n  # AFTER (safe — list form, shell=False by default):\n  import subprocess\n  result = subprocess.run(["ping", hostname], capture_output=True, text=True)\n  # Each element is passed as a literal argument — no shell interpretation\n  # Attacker cannot inject shell metacharacters`,
        riskScore: 95,
        exploitabilityScore: 90,
        impactScore: 100,
      });
      break;
    }
  }
  
  return vulnerabilities;
}

/**
 * Detect insecure deserialization vulnerabilities
 * 
 * Detects:
 * - pickle.loads() (Python)
 * - yaml.load() without SafeLoader (Python)
 */
export function detectInsecureDeserialization(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isPython = language.toLowerCase() === 'python';
  
  if (!isPython) {
    return vulnerabilities; // Deserialization patterns are Python-specific here
  }
  
  // Check for pickle.loads()
  const picklePattern = /pickle\.loads?\s*\(/;
  const pickleMatch = findFirstMatch(code, picklePattern);
  if (pickleMatch) {
    const location = filePath ? `${filePath}:${pickleMatch.line}` : `Line ${pickleMatch.line}`;
    vulnerabilities.push({
      title: 'Insecure Deserialization — pickle.load()',
      description: `${location}: \`${pickleMatch.content}\`\n\nPickle can deserialize any Python object, including ones with __reduce__ methods that execute arbitrary code on load. If the data being unpickled comes from an untrusted source (user upload, network, database), an attacker can craft a payload that runs any code when your application calls pickle.load(). This is a well-known Python-specific RCE vector.`,
      severity: 'CRITICAL',
      category: 'Code Security',
      cwe: '502',
      location,
      remediation: 'Never unpickle data from untrusted sources. Use json.loads() or msgpack for serialisation between services. If you must use pickle, sign and verify the data with hmac before deserializing.',
      aiSuggestion: `VULNERABLE LINE (${location}):\n  ${pickleMatch.content}\n\nFIXED — use JSON instead:\n  # BEFORE (dangerous):\n  ${pickleMatch.content}\n\n  # AFTER (safe — JSON only supports data, not code):\n  import json\n  data = json.loads(raw_bytes.decode('utf-8'))\n\n  # If binary format is required, use msgpack (data-only):\n  import msgpack\n  data = msgpack.unpackb(raw_bytes, raw=False)`,
      riskScore: 95,
      exploitabilityScore: 90,
      impactScore: 100,
    });
  }
  
  // Check for yaml.load() without SafeLoader
  const yamlPattern = /yaml\.load\s*\([^)]*\)(?!\s*,\s*Loader\s*=\s*yaml\.SafeLoader)/;
  const yamlMatch = findFirstMatch(code, yamlPattern) || findFirstMatch(code, /yaml\.load\s*\(/);
  if (yamlMatch) {
    const location = filePath ? `${filePath}:${yamlMatch.line}` : `Line ${yamlMatch.line}`;
    vulnerabilities.push({
      title: 'Unsafe YAML Deserialization — yaml.load() Without SafeLoader',
      description: `${location}: \`${yamlMatch.content}\`\n\nPyYAML's yaml.load() without Loader=yaml.SafeLoader can deserialize Python objects including those that execute system commands via the !!python/object/apply: tag. Supplying a crafted YAML document can achieve Remote Code Execution. yaml.safe_load() only allows standard YAML data types.`,
      severity: 'HIGH',
      category: 'Code Security',
      cwe: '502',
      location,
      remediation: 'Replace yaml.load() with yaml.safe_load(), or explicitly pass Loader=yaml.SafeLoader.',
      aiSuggestion: `VULNERABLE LINE (${location}):\n  ${yamlMatch.content}\n\nFIXED — use safe_load:\n  # BEFORE (dangerous):\n  ${yamlMatch.content}\n\n  # AFTER (safe):\n  data = yaml.safe_load(stream)\n\n  # OR explicitly set the loader:\n  data = yaml.load(stream, Loader=yaml.SafeLoader)`,
      riskScore: 85,
      exploitabilityScore: 80,
      impactScore: 90,
    });
  }
  
  return vulnerabilities;
}

/**
 * Detect sensitive data exposure in logs
 * 
 * Detects:
 * - console.log with sensitive keywords
 * - print() with sensitive keywords
 * - logging calls with sensitive keywords
 */
export function detectSensitiveDataExposure(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isPython = language.toLowerCase() === 'python';
  
  const logPatterns = isPython
    ? [
        /print\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
        /logging\.\w+\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
      ]
    : [
        /console\.log\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
        /logging\.\w+\s*\(.*(?:password|passwd|token|secret|key|auth|credential)/i,
      ];
  
  for (const pattern of logPatterns) {
    const match = findFirstMatch(code, pattern);
    if (match) {
      const location = filePath ? `${filePath}:${match.line}` : `Line ${match.line}`;
      vulnerabilities.push({
        title: 'Sensitive Data Exposed in Logs',
        description: `${location}: \`${match.content}\`\n\nThis line logs a value whose name suggests it contains a credential or secret (password, token, key, etc.). Log files are stored on disk, shipped to log aggregators (Splunk, CloudWatch, Datadog), and accessible to many people. Logging secrets means they leak outside the application boundary.`,
        severity: 'HIGH',
        category: 'Code Security',
        cwe: '532',
        location,
        remediation: 'Never log raw credential values. Log only boolean presence (!!token) or a masked version (\'****\' + token.slice(-4)).',
        aiSuggestion: isPython
          ? `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — log presence, not value:\n  # BEFORE (leaks secret):\n  ${match.content}\n\n  # AFTER (safe — logs only whether it exists):\n  print("Auth token present:", bool(auth_token))\n\n  # AFTER (safe — masked, shows last 4 chars only):\n  print("Token (masked):", "****" + auth_token[-4:])`
          : `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — log presence, not value:\n  // BEFORE (leaks secret):\n  ${match.content}\n\n  // AFTER (safe — logs only whether it exists):\n  console.log('Auth token present:', !!authToken);\n\n  // AFTER (safe — masked):\n  console.log('Token (masked):', '****' + authToken.slice(-4));`,
        riskScore: 75,
        exploitabilityScore: 70,
        impactScore: 80,
      });
      break;
    }
  }
  
  return vulnerabilities;
}

/**
 * Detect authentication flaws
 * 
 * Detects:
 * - Missing authentication middleware on sensitive routes
 */
export function detectAuthenticationFlaws(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const isJS = language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript';
  
  if (!isJS) {
    return vulnerabilities; // Auth middleware patterns are JS/TS-specific here
  }
  
  const routePattern = /app\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"` ]+['"`]\s*,\s*(?:async\s*)?\(req/i;
  const hasAuthMiddleware = /requireAuth|authenticate|isAuthenticated|verifyToken|passport\.authenticate|middleware.*auth/i.test(code);
  const hasSensitiveKeywords = /user|account|admin|profile|order|payment/i.test(code);
  
  const match = findFirstMatch(code, routePattern);
  if (match && !hasAuthMiddleware && hasSensitiveKeywords) {
    const location = filePath ? `${filePath}:${match.line}` : `Line ${match.line}`;
    vulnerabilities.push({
      title: 'Missing Authentication Middleware on Sensitive Route',
      description: `${location}: \`${match.content}\`\n\nThis route handler accesses user, account, or payment data but no authentication middleware was detected in the code. Without authentication checks, unauthenticated users can access protected resources — OWASP A01: Broken Access Control.`,
      severity: 'HIGH',
      category: 'Code Security',
      cwe: '306',
      location,
      remediation: 'Add authentication middleware before the route handler. Verify the session or JWT token and reject requests that are not authenticated.',
      aiSuggestion: `VULNERABLE LINE (${location}):\n  ${match.content}\n\nFIXED — add authentication middleware:\n  // BEFORE (open to unauthenticated access):\n  ${match.content}\n\n  // AFTER (require authenticated session first):\n  app.get('/api/profile', requireAuth, async (req, res) => {\n    // requireAuth middleware verifies JWT/session and rejects if invalid\n  });`,
      riskScore: 80,
      exploitabilityScore: 75,
      impactScore: 85,
    });
  }
  
  return vulnerabilities;
}

/**
 * Detect OWASP Top 10 issues
 * 
 * Combines multiple detection functions to provide comprehensive OWASP Top 10 coverage:
 * - A01: Broken Access Control (authentication flaws)
 * - A02: Cryptographic Failures (hardcoded credentials)
 * - A03: Injection (SQL injection, command injection)
 * - A04: Insecure Design (authentication flaws)
 * - A05: Security Misconfiguration (insecure deserialization)
 * - A07: Identification and Authentication Failures (authentication flaws)
 * - A08: Software and Data Integrity Failures (insecure deserialization)
 * - A09: Security Logging and Monitoring Failures (sensitive data exposure)
 */
export function detectOWASPTop10Issues(
  code: string,
  language: string,
  filePath?: string
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  // Combine all detection functions
  vulnerabilities.push(...detectSQLInjection(code, language, filePath));
  vulnerabilities.push(...detectHardcodedCredentials(code, language, filePath));
  vulnerabilities.push(...detectXSS(code, language, filePath));
  vulnerabilities.push(...detectCommandInjection(code, language, filePath));
  vulnerabilities.push(...detectInsecureDeserialization(code, language, filePath));
  vulnerabilities.push(...detectSensitiveDataExposure(code, language, filePath));
  vulnerabilities.push(...detectAuthenticationFlaws(code, language, filePath));
  
  return vulnerabilities;
}
