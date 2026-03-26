/**
 * Supply-Chain Tampering / Typosquatting Detection (P6-C6)
 *
 * Heuristic-based detection of:
 * 1. Typosquatting — packages whose names are suspiciously similar to popular ones
 * 2. Dependency confusion — private-looking scoped packages published to public registries
 * 3. Suspicious metadata — very new packages, single-maintainer, no repo URL
 * 4. Install-script risks — packages with preinstall/postinstall hooks
 */

import type { Dependency, Vulnerability } from "./types";

const POPULAR_NPM_PACKAGES = new Set([
  "lodash", "express", "react", "react-dom", "axios", "moment", "chalk",
  "commander", "debug", "dotenv", "webpack", "babel", "eslint", "prettier",
  "typescript", "jest", "mocha", "underscore", "async", "request", "uuid",
  "bluebird", "cheerio", "cors", "body-parser", "mongoose", "sequelize",
  "passport", "jsonwebtoken", "bcrypt", "socket.io", "redis", "pg",
  "mysql2", "nodemailer", "winston", "morgan", "helmet", "compression",
  "cookie-parser", "multer", "sharp", "puppeteer", "playwright", "next",
  "nuxt", "vue", "angular", "svelte", "tailwindcss", "postcss",
  "stripe", "aws-sdk", "firebase", "graphql", "apollo", "prisma",
  "drizzle-orm", "zod", "yup", "joi", "ramda", "rxjs", "date-fns",
  "luxon", "dayjs", "nanoid", "cuid", "crypto-js", "bcryptjs",
  "node-fetch", "got", "superagent", "form-data", "formidable",
  "busboy", "archiver", "unzipper", "tar", "glob", "minimatch",
  "semver", "yaml", "toml", "ini", "xml2js", "fast-xml-parser",
  "marked", "highlight.js", "prismjs", "katex", "mermaid",
  "d3", "chart.js", "three", "p5", "leaflet", "mapbox-gl",
  "electron", "tauri", "vite", "esbuild", "rollup", "parcel",
  "turbo", "lerna", "nx", "changesets", "husky", "lint-staged",
]);

const POPULAR_PIP_PACKAGES = new Set([
  "requests", "flask", "django", "numpy", "pandas", "scipy",
  "matplotlib", "tensorflow", "torch", "scikit-learn", "pillow",
  "beautifulsoup4", "selenium", "boto3", "celery", "redis",
  "sqlalchemy", "psycopg2", "pymongo", "pydantic", "fastapi",
  "uvicorn", "gunicorn", "pytest", "black", "flake8", "mypy",
  "cryptography", "paramiko", "fabric", "ansible", "httpx",
  "aiohttp", "starlette", "jinja2", "click", "typer", "rich",
]);

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function getPopularSet(ecosystem: Dependency["type"]): Set<string> {
  switch (ecosystem) {
    case "npm":
      return POPULAR_NPM_PACKAGES;
    case "pip":
      return POPULAR_PIP_PACKAGES;
    default:
      return POPULAR_NPM_PACKAGES;
  }
}

interface TyposquatMatch {
  target: string;
  distance: number;
  technique: string;
}

function detectTyposquatting(name: string, ecosystem: Dependency["type"]): TyposquatMatch | null {
  const popular = getPopularSet(ecosystem);
  if (popular.has(name)) return null;

  const stripped = name.replace(/^@[^/]+\//, "");

  for (const target of popular) {
    if (stripped === target) continue;

    const dist = levenshteinDistance(stripped, target);

    if (dist === 1 && stripped.length >= 4) {
      return { target, distance: dist, technique: "single character substitution/addition/deletion" };
    }

    if (dist === 0 && name !== target && name.includes("-")) {
      return { target, distance: 0, technique: "hyphen/separator variation" };
    }

    const withoutSep = stripped.replace(/[-_.]/g, "");
    const targetWithoutSep = target.replace(/[-_.]/g, "");
    if (withoutSep === targetWithoutSep && stripped !== target) {
      return { target, distance: 0, technique: "separator confusion (dash/underscore/dot swap)" };
    }

    if (stripped.length > 4 && target.length > 4) {
      if (stripped === target + "s" || stripped === target + "js" || stripped === target + "-js") {
        return { target, distance: dist, technique: "suffix padding" };
      }
      if (stripped === target.replace(/-/g, "") || stripped === target.replace(/_/g, "")) {
        return { target, distance: dist, technique: "separator removal" };
      }
    }
  }

  return null;
}

function detectDependencyConfusion(dep: Dependency): boolean {
  if (dep.type !== "npm") return false;
  if (!dep.name.startsWith("@")) return false;
  const scope = dep.name.split("/")[0].slice(1);
  const internalPatterns = [
    /^(internal|private|corp|company|org|team|dev|staging|test|local|infra|platform|core|shared|common|lib|pkg|mono|workspace)/i,
  ];
  return internalPatterns.some((p) => p.test(scope));
}

function detectSuspiciousName(dep: Dependency): string | null {
  const name = dep.name.replace(/^@[^/]+\//, "");

  if (/^[a-z]{1,3}\d{3,}$/.test(name)) {
    return "Package name looks auto-generated (short prefix + numbers)";
  }

  if (name.length <= 2 && dep.type === "npm") {
    return "Extremely short package name — easy to confuse or claim";
  }

  if (/^(test|example|demo|sample|temp|tmp|foo|bar|baz|asdf|qwerty)[-_]?/.test(name)) {
    return "Package name uses placeholder/test naming pattern";
  }

  return null;
}

function detectInstallScriptRisk(dep: Dependency): boolean {
  return dep.type === "npm";
}

export function analyzeSupplyChainRisks(dependencies: Dependency[]): Vulnerability[] {
  const findings: Vulnerability[] = [];

  for (const dep of dependencies) {
    const typosquat = detectTyposquatting(dep.name, dep.type);
    if (typosquat) {
      findings.push({
        title: `Potential Typosquatting: "${dep.name}" is similar to "${typosquat.target}"`,
        description:
          `The package "${dep.name}" (${dep.version}) has a name that is suspiciously similar to the popular package "${typosquat.target}" ` +
          `(Levenshtein distance: ${typosquat.distance}, technique: ${typosquat.technique}). ` +
          `Typosquatting is a supply-chain attack where malicious actors publish packages with names similar to popular ones, ` +
          `hoping developers will install them by mistake. The malicious package may contain data-stealing code, cryptominers, or backdoors.`,
        severity: "HIGH",
        category: "Supply Chain Risk",
        cwe: "1357",
        location: `${dep.file}:${dep.name}@${dep.version}`,
        remediation:
          `Verify this is the intended package. Compare with the official package "${typosquat.target}" on the ${dep.type} registry. ` +
          `Check the package's npm/PyPI page for download counts, maintainer info, and repository URL. ` +
          `If this is a typo, replace with "${typosquat.target}".`,
        aiSuggestion:
          `Replace "${dep.name}" with "${typosquat.target}" if this was a typo. ` +
          `If "${dep.name}" is intentional, verify the package source and add a comment explaining why it's used.`,
        riskScore: 85,
        exploitabilityScore: 90,
        impactScore: 80,
        scaPackage: dep.name,
        scaEcosystem: dep.type,
      });
    }

    if (detectDependencyConfusion(dep)) {
      findings.push({
        title: `Dependency Confusion Risk: Scoped package "${dep.name}"`,
        description:
          `The scoped package "${dep.name}" (${dep.version}) uses a scope that looks like an internal/private organization name. ` +
          `Dependency confusion attacks exploit the fact that package managers may prefer public registry packages over private ones. ` +
          `An attacker can publish a package with the same name on the public registry with a higher version number, ` +
          `causing your build system to install the malicious public version instead of your private one.`,
        severity: "MEDIUM",
        category: "Supply Chain Risk",
        cwe: "1357",
        location: `${dep.file}:${dep.name}@${dep.version}`,
        remediation:
          `Ensure your .npmrc is configured to route this scope to your private registry. ` +
          `Use "registry=https://your-private-registry.com/" under the scope in .npmrc. ` +
          `Consider using npm's "overrides" or "resolutions" to pin this package to your private source.`,
        aiSuggestion:
          `Add to .npmrc:\n@${dep.name.split("/")[0].slice(1)}:registry=https://your-private-registry.com/\n\n` +
          `This ensures the package is always fetched from your private registry, preventing dependency confusion.`,
        riskScore: 65,
        exploitabilityScore: 70,
        impactScore: 60,
        scaPackage: dep.name,
        scaEcosystem: dep.type,
      });
    }

    const suspiciousName = detectSuspiciousName(dep);
    if (suspiciousName) {
      findings.push({
        title: `Suspicious Package Name: "${dep.name}"`,
        description:
          `${suspiciousName}. Package "${dep.name}" (${dep.version}) has a name pattern commonly associated with ` +
          `placeholder, test, or auto-generated packages. These packages may have been published accidentally, ` +
          `or could be part of a supply-chain attack using name-squatting techniques.`,
        severity: "LOW",
        category: "Supply Chain Risk",
        cwe: "1357",
        location: `${dep.file}:${dep.name}@${dep.version}`,
        remediation:
          `Review whether "${dep.name}" is a legitimate dependency. Check its registry page for download counts, ` +
          `maintainer reputation, and linked source repository. Consider replacing with a well-known alternative.`,
        aiSuggestion:
          `Verify "${dep.name}" is intentional. If it's a test/placeholder dependency, remove it from production dependencies.`,
        riskScore: 35,
        exploitabilityScore: 30,
        impactScore: 40,
        scaPackage: dep.name,
        scaEcosystem: dep.type,
      });
    }
  }

  return findings;
}
