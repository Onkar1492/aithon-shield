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
      title: "Insecure Data Storage — Plaintext Credentials in SharedPreferences",
      description:
        "The application stores user credentials (username and password) in Android SharedPreferences without encryption. SharedPreferences data is stored as plaintext XML files accessible to rooted devices or backup extraction.",
      severity: "CRITICAL" as const,
      category: "Mobile Security",
      cwe: "312",
      location: "com.app.auth.LoginManager.saveCredentials()",
      remediation:
        "Use Android Keystore or EncryptedSharedPreferences (Jetpack Security) to store sensitive data. Never store passwords — use tokens with short TTLs instead.",
      riskScore: 92,
      exploitabilityScore: 88,
      impactScore: 95,
    },
    {
      ...base,
      title: "Missing Certificate Pinning — TLS Interception Possible",
      description:
        "The application does not implement certificate pinning. An attacker on the same network can intercept HTTPS traffic using a proxy with a custom CA certificate installed on the device.",
      severity: "HIGH" as const,
      category: "Mobile Security",
      cwe: "295",
      location: "com.app.network.ApiClient",
      remediation:
        "Implement certificate pinning using OkHttp CertificatePinner or TrustManager. Pin against the leaf certificate or a specific intermediate CA.",
      riskScore: 78,
      exploitabilityScore: 72,
      impactScore: 85,
    },
    {
      ...base,
      title: "Exported Activity Without Permission — Deep Link Hijacking",
      description:
        "AndroidManifest.xml declares an exported Activity (com.app.DeepLinkActivity) with an intent-filter but no custom permission. Any third-party app can invoke this Activity and potentially redirect the user or extract data.",
      severity: "HIGH" as const,
      category: "Mobile Security",
      cwe: "926",
      location: "AndroidManifest.xml — DeepLinkActivity",
      remediation:
        'Add android:permission with a signature-level custom permission, or set android:exported="false" if the Activity should not be externally accessible.',
      riskScore: 72,
      exploitabilityScore: 68,
      impactScore: 76,
    },
    {
      ...base,
      title: "Hardcoded API Key in Binary",
      description:
        "A Google Maps API key was found embedded in the compiled binary. Hardcoded keys can be extracted through reverse engineering and abused for quota exhaustion or data access.",
      severity: "MEDIUM" as const,
      category: "Secrets",
      cwe: "798",
      location: "classes.dex — com.app.config.Keys",
      remediation:
        "Move API keys to a secure backend proxy or use Android's BuildConfig with CI injection. Restrict the key's scope in the Google Cloud Console.",
      riskScore: 58,
      exploitabilityScore: 65,
      impactScore: 50,
    },
    {
      ...base,
      title: "Debug Mode Enabled in Release Build",
      description:
        'The AndroidManifest.xml has android:debuggable="true" which allows attaching a debugger to the running application, inspecting variables, and bypassing security controls.',
      severity: "MEDIUM" as const,
      category: "Mobile Security",
      cwe: "215",
      location: "AndroidManifest.xml — application tag",
      remediation:
        'Ensure android:debuggable is set to "false" or omitted in release builds. Use build variants to automatically strip debug flags.',
      riskScore: 52,
      exploitabilityScore: 60,
      impactScore: 45,
    },
    {
      ...base,
      title: "Weak Cryptography — MD5 Hash Used for Token Verification",
      description:
        "The application uses MD5 to hash authentication tokens before comparison. MD5 is cryptographically broken and susceptible to collision attacks.",
      severity: "MEDIUM" as const,
      category: "Code Security",
      cwe: "328",
      location: "com.app.auth.TokenValidator.verify()",
      remediation:
        "Replace MD5 with SHA-256 or SHA-3. For password hashing, use bcrypt, scrypt, or Argon2.",
      riskScore: 48,
      exploitabilityScore: 42,
      impactScore: 55,
    },
    {
      ...base,
      title: "WebView JavaScript Interface Injection Risk",
      description:
        "A WebView component uses addJavascriptInterface() which on Android API < 17 allows arbitrary code execution. Even on newer APIs, the exposed methods should be carefully reviewed.",
      severity: "LOW" as const,
      category: "Mobile Security",
      cwe: "749",
      location: "com.app.ui.WebViewFragment",
      remediation:
        "Set minSdkVersion >= 17 and annotate exposed methods with @JavascriptInterface. Validate all input from JavaScript to native bridges.",
      riskScore: 32,
      exploitabilityScore: 28,
      impactScore: 38,
    },
  ];
}
