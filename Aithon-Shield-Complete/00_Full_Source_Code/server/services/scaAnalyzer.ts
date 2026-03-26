/**
 * SCA Analyzer Service
 * Feature 5: Software Composition Analysis (Dependency Vulnerability Scanning)
 * 
 * Scans project dependencies for known vulnerabilities by parsing dependency files
 * and querying vulnerability databases (NIST NVD, CISA KEV).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Dependency, DependencyManifest, Vulnerability, ProgressCallback } from './types';
import { annotateScaReachability } from './scaReachability';
import { analyzeSupplyChainRisks } from './supplyChainRiskService';

function scaFields(dep: Dependency) {
  return { scaPackage: dep.name, scaEcosystem: dep.type };
}

/**
 * Rate limiter for NIST NVD API (5 requests per 30 seconds)
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 5;
  private readonly windowMs = 30000; // 30 seconds

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.requests.shift();
    }

    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter();

/**
 * Parse package.json (Node.js/npm)
 */
async function parsePackageJson(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const packageJsonPath = path.join(repoPath, 'package.json');

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    // Parse dependencies
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === 'string') {
        // Remove version prefixes (^, ~, >=, etc.)
        const cleanVersion = version.replace(/^[\^~>=<]+/, '').replace(/[\s\*]+.*$/, '');
        dependencies.push({
          name,
          version: cleanVersion,
          type: 'npm',
          file: 'package.json',
        });
      }
    }
  } catch (error) {
    // File doesn't exist or is malformed - skip silently
  }

  return dependencies;
}

/**
 * Parse requirements.txt (Python/pip)
 */
async function parseRequirementsTxt(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const requirementsPath = path.join(repoPath, 'requirements.txt');

  try {
    const content = await fs.readFile(requirementsPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse format: package==version or package>=version, etc.
      const match = trimmed.match(/^([a-zA-Z0-9\-_\.]+)(?:[=<>!]+(.+))?/);
      if (match) {
        const name = match[1];
        const version = match[2] || '*';
        dependencies.push({
          name,
          version: version.replace(/[=<>!]+/, ''),
          type: 'pip',
          file: 'requirements.txt',
        });
      }
    }
  } catch (error) {
    // File doesn't exist - skip silently
  }

  return dependencies;
}

/**
 * Parse go.mod (Go modules)
 */
async function parseGoMod(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const goModPath = path.join(repoPath, 'go.mod');

  try {
    const content = await fs.readFile(goModPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Parse: require module/path v1.2.3
      const match = trimmed.match(/^require\s+([^\s]+)\s+(.+)$/);
      if (match) {
        const name = match[1];
        const version = match[2].trim();
        dependencies.push({
          name,
          version,
          type: 'go',
          file: 'go.mod',
        });
      }
    }
  } catch (error) {
    // File doesn't exist - skip silently
  }

  return dependencies;
}

/**
 * Parse pom.xml (Java/Maven) - basic implementation
 */
async function parsePomXml(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const pomPath = path.join(repoPath, 'pom.xml');

  try {
    const content = await fs.readFile(pomPath, 'utf-8');
    // Basic XML parsing - look for <dependency> tags
    const dependencyRegex = /<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/dependency>/g;
    let match;

    while ((match = dependencyRegex.exec(content)) !== null) {
      const groupId = match[1].trim();
      const artifactId = match[2].trim();
      const version = match[3].trim();
      dependencies.push({
        name: `${groupId}:${artifactId}`,
        version,
        type: 'maven',
        file: 'pom.xml',
      });
    }
  } catch (error) {
    // File doesn't exist - skip silently
  }

  return dependencies;
}

/**
 * Parse Gemfile (Ruby)
 */
async function parseGemfile(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const gemfilePath = path.join(repoPath, 'Gemfile');

  try {
    const content = await fs.readFile(gemfilePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Parse: gem 'name', '~> 1.2.3' or gem "name", ">= 1.0"
      const match = trimmed.match(/^gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
      if (match) {
        const name = match[1];
        const version = match[2] || '*';
        dependencies.push({
          name,
          version: version.replace(/[~>=<]+/, ''),
          type: 'gem',
          file: 'Gemfile',
        });
      }
    }
  } catch (error) {
    // File doesn't exist - skip silently
  }

  return dependencies;
}

/**
 * Parse composer.json (PHP/Composer)
 */
async function parseComposerJson(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const composerPath = path.join(repoPath, 'composer.json');

  try {
    const content = await fs.readFile(composerPath, 'utf-8');
    const composerJson = JSON.parse(content);

    const deps = { ...composerJson.require, ...composerJson['require-dev'] };
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === 'string') {
        const cleanVersion = version.replace(/^[\^~>=<]+/, '').replace(/[\s\*]+.*$/, '');
        dependencies.push({
          name,
          version: cleanVersion,
          type: 'composer',
          file: 'composer.json',
        });
      }
    }
  } catch (error) {
    // File doesn't exist or is malformed - skip silently
  }

  return dependencies;
}

/**
 * Parse Cargo.toml (Rust)
 */
async function parseCargoToml(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];
  const cargoPath = path.join(repoPath, 'Cargo.toml');

  try {
    const content = await fs.readFile(cargoPath, 'utf-8');
    const lines = content.split('\n');

    let inDependencies = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '[dependencies]' || trimmed === '[dev-dependencies]') {
        inDependencies = true;
        continue;
      }
      if (trimmed.startsWith('[')) {
        inDependencies = false;
        continue;
      }
      if (inDependencies && trimmed) {
        // Parse: name = "version" or name = { version = "1.0" }
        const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(?:["']([^"']+)["']|{.*version\s*=\s*["']([^"']+)["'])/);
        if (match) {
          const name = match[1];
          const version = match[2] || match[3] || '*';
          dependencies.push({
            name,
            version,
            type: 'cargo',
            file: 'Cargo.toml',
          });
        }
      }
    }
  } catch (error) {
    // File doesn't exist - skip silently
  }

  return dependencies;
}

/**
 * Parse all dependency files in repository
 */
export async function parseDependencies(repoPath: string): Promise<DependencyManifest> {
  const allDependencies: Dependency[] = [];

  // Try parsing all supported file types
  allDependencies.push(...await parsePackageJson(repoPath));
  allDependencies.push(...await parseRequirementsTxt(repoPath));
  allDependencies.push(...await parseGoMod(repoPath));
  allDependencies.push(...await parsePomXml(repoPath));
  allDependencies.push(...await parseGemfile(repoPath));
  allDependencies.push(...await parseComposerJson(repoPath));
  allDependencies.push(...await parseCargoToml(repoPath));

  // Determine primary type based on what was found
  const types = allDependencies.map(d => d.type);
  const primaryType = types.length > 0 ? types[0] : 'unknown';

  return {
    dependencies: allDependencies,
    type: primaryType,
  };
}

/**
 * Check dependency against NIST NVD API
 */
async function checkNISTNVD(dependency: Dependency): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];

  try {
    await rateLimiter.waitIfNeeded();

    // Query NIST NVD API
    // Note: This is a simplified implementation. Real implementation would need
    // proper CPE (Common Platform Enumeration) matching
    const query = encodeURIComponent(`${dependency.name} ${dependency.version}`);
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${query}`;

    const response = await fetch(url);
    if (!response.ok) {
      // API error - skip this dependency
      return vulnerabilities;
    }

    const data = await response.json();
    if (data.vulnerabilities && data.vulnerabilities.length > 0) {
      for (const vuln of data.vulnerabilities.slice(0, 5)) { // Limit to 5 CVEs per dependency
        const cve = vuln.cve;
        const cvssScore = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 
                         cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore || 0;
        
        let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (cvssScore >= 9.0) severity = 'CRITICAL';
        else if (cvssScore >= 7.0) severity = 'HIGH';
        else if (cvssScore >= 4.0) severity = 'MEDIUM';

        vulnerabilities.push({
          title: `Vulnerable Dependency: ${dependency.name}@${dependency.version}`,
          description: `CVE-${cve.id}: ${cve.descriptions?.[0]?.value || 'No description available'}\n\nAffected package: ${dependency.name} version ${dependency.version}\nCVSS Score: ${cvssScore.toFixed(1)}`,
          severity,
          category: 'Dependency Vulnerability',
          cwe: cve.weaknesses?.[0]?.description?.[0]?.value || 'N/A',
          location: `${dependency.file}:${dependency.name}@${dependency.version}`,
          remediation: `Update ${dependency.name} to a patched version. Check the CVE details for specific version requirements.`,
          aiSuggestion: `VULNERABLE DEPENDENCY:\n  ${dependency.name}@${dependency.version}\n\nCVE: ${cve.id}\nCVSS Score: ${cvssScore.toFixed(1)}\n\nFIXED — update dependency:\n  # Check for available updates:\n  npm outdated ${dependency.name}\n  # Or:\n  pip list --outdated\n\n  # Update to latest version:\n  npm update ${dependency.name}\n  # Or update ${dependency.file} directly`,
          riskScore: Math.min(100, Math.round(cvssScore * 10)),
          exploitabilityScore: Math.min(100, Math.round(cvssScore * 8)),
          impactScore: Math.min(100, Math.round(cvssScore * 10)),
        });
      }
    }
  } catch (error) {
    // API error - skip this dependency
  }

  return vulnerabilities;
}

/**
 * Check CISA KEV (Known Exploited Vulnerabilities) database
 */
async function checkCISAKEV(dependency: Dependency): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];

  try {
    const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
    const response = await fetch(url);
    
    if (!response.ok) {
      return vulnerabilities;
    }

    const data = await response.json();
    const kevList = data.vulnerabilities || [];

    // Check if any CVE in KEV matches this dependency
    // Note: This is simplified - real implementation would need better matching
    for (const kev of kevList) {
      if (kev.cveID && dependency.name.toLowerCase().includes(kev.product?.toLowerCase() || '')) {
        vulnerabilities.push({
          title: `Known Exploited Vulnerability: ${dependency.name}@${dependency.version}`,
          description: `CVE-${kev.cveID}: ${kev.vulnerabilityName}\n\nThis vulnerability is listed in CISA's Known Exploited Vulnerabilities (KEV) catalog, meaning it is actively being exploited in the wild.\n\nAffected package: ${dependency.name} version ${dependency.version}`,
          severity: 'CRITICAL',
          category: 'Dependency Vulnerability',
          cwe: 'N/A',
          location: `${dependency.file}:${dependency.name}@${dependency.version}`,
          remediation: `URGENT: Update ${dependency.name} immediately. This vulnerability is actively exploited.`,
          aiSuggestion: `CRITICAL - ACTIVELY EXPLOITED:\n  ${dependency.name}@${dependency.version}\n\nCVE: ${kev.cveID}\nStatus: Known Exploited Vulnerability (CISA KEV)\n\nFIXED — update immediately:\n  # Update to patched version:\n  npm update ${dependency.name}\n  # Or manually update ${dependency.file}`,
          riskScore: 100,
          exploitabilityScore: 100,
          impactScore: 100,
          ...scaFields(dependency),
        });
        break; // Only report once per dependency
      }
    }
  } catch (error) {
    // API error - skip
  }

  return vulnerabilities;
}

/**
 * Check dependencies for vulnerabilities
 */
export async function checkDependencyVulnerabilities(
  dependencies: Dependency[],
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]> {
  const allVulnerabilities: Vulnerability[] = [];
  const totalDeps = dependencies.length;

  for (let i = 0; i < dependencies.length; i++) {
    const dependency = dependencies[i];

    if (progressCallback) {
      const progress = Math.floor(((i + 1) / totalDeps) * 50); // First 50% for checking
      await progressCallback(progress, `Checking ${dependency.name}@${dependency.version} (${i + 1}/${totalDeps})`);
    }

    // Check NIST NVD
    const nvdVulns = await checkNISTNVD(dependency);
    allVulnerabilities.push(...nvdVulns);

    // Check CISA KEV
    const kevVulns = await checkCISAKEV(dependency);
    allVulnerabilities.push(...kevVulns);
  }

  return allVulnerabilities;
}

/**
 * Perform complete SCA scan
 */
export async function performSCAScan(
  repoPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]> {
  if (progressCallback) {
    await progressCallback(0, 'Starting SCA scan...');
  }

  // Parse dependencies (0-50%)
  if (progressCallback) {
    await progressCallback(10, 'Parsing dependency files...');
  }
  const manifest = await parseDependencies(repoPath);

  if (progressCallback) {
    await progressCallback(50, `Found ${manifest.dependencies.length} dependencies`);
  }

  if (manifest.dependencies.length === 0) {
    if (progressCallback) {
      await progressCallback(100, 'No dependencies found');
    }
    return [];
  }

  // Check vulnerabilities (50-95%)
  const vulnerabilities = await checkDependencyVulnerabilities(
    manifest.dependencies,
    progressCallback
  );

  if (progressCallback) {
    await progressCallback(90, 'Analyzing supply-chain risks (typosquatting, dependency confusion)...');
  }
  const supplyChainFindings = analyzeSupplyChainRisks(manifest.dependencies);
  vulnerabilities.push(...supplyChainFindings);

  if (progressCallback) {
    await progressCallback(95, 'Analyzing SCA import reachability...');
  }
  await annotateScaReachability(repoPath, vulnerabilities);

  if (progressCallback) {
    await progressCallback(100, `SCA scan complete. Found ${vulnerabilities.length} vulnerabilities (${supplyChainFindings.length} supply-chain risks)`);
  }

  return vulnerabilities;
}
