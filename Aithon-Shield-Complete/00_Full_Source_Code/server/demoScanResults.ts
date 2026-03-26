/**
 * Deterministic sample findings when AITHON_DEMO_MODE is on so scans complete without
 * cloning repos, crawling URLs, or downloading packages (for UI/workflow testing).
 */
import type { Vulnerability } from "./services/types";

const base = {
  severity: "LOW" as const,
  category: "Demo mode",
  cwe: "0",
  remediation: "N/A — demo mode does not run live analysis.",
  aiSuggestion: "",
  riskScore: 5,
  exploitabilityScore: 0,
  impactScore: 0,
};

export function demoScanVulnerabilities(kind: "mvp" | "web" | "mobile"): Vulnerability[] {
  if (kind === "mvp") {
    return [
      {
        ...base,
        title: "Demo: MVP scan completed (no repository clone)",
        description:
          "Live git clone and static analysis are skipped in demo mode. Use a real HTTPS Git URL in production to run SAST, SCA, IaC, and secrets detection.",
        location: "demo/mvp-scan",
      },
      {
        title: "Hardcoded AWS Credential in Source Code",
        description:
          "src/config/aws.ts:12: `AWS_SECRET_ACCESS_KEY = \"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\"`\n\nAn AWS secret access key is hard-coded directly into the source file. If this file is committed to version control the secret is exposed to everyone with read access.",
        severity: "CRITICAL" as const,
        category: "Code Security",
        cwe: "798",
        location: "src/config/aws.ts:12",
        remediation:
          "Load the value from an environment variable or AWS Secrets Manager. Store secrets in a .env file excluded from git via .gitignore.",
        aiSuggestion:
          "// BEFORE (dangerous):\nconst AWS_SECRET = \"wJalrXUtnFEMI/...\";\n\n// AFTER (safe):\nconst AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY;\nif (!AWS_SECRET) throw new Error(\"AWS_SECRET_ACCESS_KEY env var required\");",
        riskScore: 100,
        exploitabilityScore: 100,
        impactScore: 100,
      },
      {
        title: "Hardcoded Stripe API Key in Source Code",
        description:
          "src/payments/stripe.ts:8: `STRIPE_SECRET_KEY = \"sk_live_51abc123def456...\"`\n\nA Stripe live secret key is embedded in source code. Anyone with repo access can make charges against your Stripe account.",
        severity: "CRITICAL" as const,
        category: "Code Security",
        cwe: "798",
        location: "src/payments/stripe.ts:8",
        remediation:
          "Move the Stripe key to an environment variable or a secrets manager. Never commit live keys to version control.",
        aiSuggestion:
          "// BEFORE:\nconst stripe = new Stripe(\"sk_live_51abc...\");\n\n// AFTER:\nconst stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);",
        riskScore: 100,
        exploitabilityScore: 100,
        impactScore: 100,
      },
      {
        title: "Hardcoded Database URL with Credentials in Source Code",
        description:
          "src/db/connection.ts:5: `DATABASE_URL = \"postgresql://admin:SuperSecret123@prod-db.example.com:5432/myapp\"`\n\nA database connection string containing username and password is hard-coded. This exposes full database access to anyone who reads the code.",
        severity: "CRITICAL" as const,
        category: "Code Security",
        cwe: "798",
        location: "src/db/connection.ts:5",
        remediation:
          "Use an environment variable for DATABASE_URL. In production, use IAM-based authentication or a secrets manager.",
        aiSuggestion:
          "// BEFORE:\nconst db = new Pool({ connectionString: \"postgresql://admin:SuperSecret123@...\" });\n\n// AFTER:\nconst db = new Pool({ connectionString: process.env.DATABASE_URL });",
        riskScore: 100,
        exploitabilityScore: 95,
        impactScore: 100,
      },
      {
        title: "Hardcoded JWT Token in Source Code",
        description:
          "src/auth/tokens.ts:22: `jwt_secret = \"eyJhbGciOiJIUzI1NiIs...\"`\n\nA JWT signing secret is embedded in source code. Anyone who knows this secret can forge authentication tokens.",
        severity: "HIGH" as const,
        category: "Code Security",
        cwe: "798",
        location: "src/auth/tokens.ts:22",
        remediation:
          "Store the JWT secret in an environment variable or a secrets manager. Rotate it immediately if it has been committed to a public repository.",
        aiSuggestion:
          "// BEFORE:\nconst JWT_SECRET = \"eyJhbGciOiJIUzI1NiIs...\";\n\n// AFTER:\nconst JWT_SECRET = process.env.JWT_SECRET;\nif (!JWT_SECRET) throw new Error(\"JWT_SECRET required\");",
        riskScore: 90,
        exploitabilityScore: 90,
        impactScore: 95,
      },
      {
        title: 'Potential Typosquatting: "lodashs" is similar to "lodash"',
        description:
          'The package "lodashs" (4.17.21) has a name that is suspiciously similar to the popular package "lodash" ' +
          "(Levenshtein distance: 1, technique: single character substitution/addition/deletion). " +
          "Typosquatting is a supply-chain attack where malicious actors publish packages with names similar to popular ones, " +
          "hoping developers will install them by mistake. The malicious package may contain data-stealing code, cryptominers, or backdoors.",
        severity: "HIGH" as const,
        category: "Supply Chain Risk",
        cwe: "1357",
        location: "package.json:lodashs@4.17.21",
        remediation:
          'Verify this is the intended package. Compare with the official package "lodash" on the npm registry. ' +
          "Check the package's npm page for download counts, maintainer info, and repository URL. " +
          'If this is a typo, replace with "lodash".',
        aiSuggestion:
          '// In package.json, replace:\n"lodashs": "^4.17.21"\n\n// With the correct package:\n"lodash": "^4.17.21"',
        riskScore: 85,
        exploitabilityScore: 90,
        impactScore: 80,
      },
      {
        title: 'Dependency Confusion Risk: Scoped package "@internal-corp/auth-utils"',
        description:
          'The scoped package "@internal-corp/auth-utils" (2.1.0) uses a scope that looks like an internal/private organization name. ' +
          "Dependency confusion attacks exploit the fact that package managers may prefer public registry packages over private ones. " +
          "An attacker can publish a package with the same name on the public registry with a higher version number, " +
          "causing your build system to install the malicious public version instead of your private one.",
        severity: "MEDIUM" as const,
        category: "Supply Chain Risk",
        cwe: "1357",
        location: "package.json:@internal-corp/auth-utils@2.1.0",
        remediation:
          "Ensure your .npmrc is configured to route this scope to your private registry. " +
          'Use "registry=https://your-private-registry.com/" under the scope in .npmrc.',
        aiSuggestion:
          "Add to .npmrc:\n@internal-corp:registry=https://your-private-registry.com/\n\n" +
          "This ensures the package is always fetched from your private registry, preventing dependency confusion.",
        riskScore: 65,
        exploitabilityScore: 70,
        impactScore: 60,
      },
    ];
  }
  if (kind === "web") {
    return [
      {
        ...base,
        title: "Demo: Web scan completed (no live crawl)",
        description:
          "DAST crawl, SSL, and header checks against a real URL are skipped in demo mode. Use a reachable https:// URL in production.",
        location: "demo/web-scan",
      },
    ];
  }
  return [
    {
      ...base,
      title: "Demo: Mobile scan completed (no package download)",
      description:
        "Binary download and analysis are skipped in demo mode. Use a real store URL or bundle ID in production.",
      location: "demo/mobile-scan",
    },
  ];
}
