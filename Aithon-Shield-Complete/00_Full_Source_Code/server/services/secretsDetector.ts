/**
 * Secrets Detector Service
 * Feature 4: Specialized Secrets Detection
 * 
 * Specialized service for detecting hardcoded secrets, API keys, passwords,
 * and tokens in code repositories and mobile app binaries.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { detectHardcodedCredentials } from './securityAnalyzer';
import type { Vulnerability, ProgressCallback } from './types';

/**
 * Extended secret patterns beyond basic credentials
 */
const SECRET_PATTERNS = [
  // API Keys
  {
    pattern: /(?:API_KEY|api_key|apikey|APIKEY)\s*[:=]\s*["'`]([A-Za-z0-9_\-]{20,})["'`]/i,
    type: 'API Key',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // AWS Keys
  {
    pattern: /(?:aws_access_key_id|aws_secret_access_key|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["'`]([A-Za-z0-9+/=]{20,})["'`]/i,
    type: 'AWS Credential',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // Google API Keys
  {
    pattern: /(?:GOOGLE_API_KEY|GCP_API_KEY|google_api_key|gcp_api_key)\s*[:=]\s*["'`]([A-Za-z0-9_\-]{20,})["'`]/i,
    type: 'Google API Key',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // Database URLs with credentials
  {
    pattern: /(?:postgresql|postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/i,
    type: 'Database URL with Credentials',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // JWT Tokens (long base64 strings)
  {
    pattern: /(?:jwt|token|bearer)\s*[:=]\s*["'`](eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)["'`]/i,
    type: 'JWT Token',
    severity: 'HIGH' as const,
    cwe: '798',
  },
  // OAuth Tokens
  {
    pattern: /(?:oauth_token|oauth_secret|oauth2_token)\s*[:=]\s*["'`]([A-Za-z0-9_\-]{32,})["'`]/i,
    type: 'OAuth Token',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // Private Keys (SSH, RSA, etc.)
  {
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
    type: 'Private Key',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // Certificate Keys
  {
    pattern: /-----BEGIN\s+(?:CERTIFICATE|EC\s+PRIVATE\s+KEY)-----/i,
    type: 'Certificate Key',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // Stripe Keys
  {
    pattern: /(?:stripe_secret_key|stripe_api_key|STRIPE_SECRET_KEY|STRIPE_API_KEY)\s*[:=]\s*["'`](sk_(live|test)_[A-Za-z0-9]{24,})["'`]/i,
    type: 'Stripe API Key',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // GitHub Tokens
  {
    pattern: /(?:github_token|GITHUB_TOKEN|ghp_[A-Za-z0-9]{36})/i,
    type: 'GitHub Token',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
  // Slack Tokens
  {
    pattern: /(?:slack_token|SLACK_TOKEN|xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,})/i,
    type: 'Slack Token',
    severity: 'CRITICAL' as const,
    cwe: '798',
  },
];

/**
 * Detect secrets in code string
 * 
 * Uses Security Analyzer's detectHardcodedCredentials plus extended patterns
 */
export async function detectSecretsInCode(
  code: string,
  filePath: string,
  language: string
): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];
  
  // Use Security Analyzer for basic credential detection
  vulnerabilities.push(...detectHardcodedCredentials(code, language, filePath));
  
  // Check extended secret patterns
  const lines = code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    for (const secretPattern of SECRET_PATTERNS) {
      const match = line.match(secretPattern.pattern);
      if (match) {
        const location = `${filePath}:${lineNumber}`;
        
        // Check if we already reported this line (from detectHardcodedCredentials)
        const alreadyReported = vulnerabilities.some(
          v => v.location === location && v.title.includes('Hardcoded Credential')
        );
        
        if (!alreadyReported) {
          vulnerabilities.push({
            title: `Hardcoded ${secretPattern.type} in Source Code`,
            description: `${location}: \`${line.trim()}\`\n\nA ${secretPattern.type.toLowerCase()} is hard-coded directly into the source file. If this file is committed to version control (Git, GitHub, etc.) the secret is exposed to everyone with read access — including public repositories. Secrets embedded in code cannot be rotated without a code change.`,
            severity: secretPattern.severity,
            category: 'Code Security',
            cwe: secretPattern.cwe,
            location,
            remediation: 'Load the value from an environment variable or secrets manager. Store secrets in a .env file (excluded from git via .gitignore) or use a secrets manager (AWS Secrets Manager, Vault, etc.).',
            aiSuggestion: `VULNERABLE LINE (${location}):\n  ${line.trim()}\n\nFIXED — load from environment:\n  // BEFORE (dangerous):\n  ${line.trim()}\n\n  // AFTER (safe):\n  const ${secretPattern.type.toLowerCase().replace(/\s+/g, '_')} = process.env.${secretPattern.type.toUpperCase().replace(/\s+/g, '_')};\n  if (!${secretPattern.type.toLowerCase().replace(/\s+/g, '_')}) throw new Error("${secretPattern.type.toUpperCase().replace(/\s+/g, '_')} environment variable is required");\n\n  // .env file (never commit this):\n  // ${secretPattern.type.toUpperCase().replace(/\s+/g, '_')}=your_actual_secret_here`,
            riskScore: secretPattern.severity === 'CRITICAL' ? 100 : 90,
            exploitabilityScore: 100,
            impactScore: 100,
          });
        }
      }
    }
  }
  
  return vulnerabilities;
}

/**
 * Detect secrets in multiple files
 * 
 * Scans files recursively and reports progress
 */
export async function detectSecretsInFiles(
  filePaths: string[],
  repoPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]> {
  const allVulnerabilities: Vulnerability[] = [];
  const totalFiles = filePaths.length;
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const fullPath = path.join(repoPath, filePath);
    
    try {
      // Read file content
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Detect language from file extension
      const ext = path.extname(filePath).toLowerCase();
      const languageMap: Record<string, string> = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.go': 'go',
        '.rb': 'ruby',
        '.php': 'php',
        '.cpp': 'cpp',
        '.c': 'c',
        '.cs': 'csharp',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.rs': 'rust',
      };
      const language = languageMap[ext] || 'unknown';
      
      // Detect secrets
      const vulnerabilities = await detectSecretsInCode(content, filePath, language);
      allVulnerabilities.push(...vulnerabilities);
      
      // Report progress
      if (progressCallback) {
        const progress = Math.floor(((i + 1) / totalFiles) * 100);
        await progressCallback(progress, `Scanning ${filePath} (${i + 1}/${totalFiles})`);
      }
    } catch (error: any) {
      // Skip files that can't be read (binary files, permissions, etc.)
      if (progressCallback) {
        await progressCallback(
          Math.floor(((i + 1) / totalFiles) * 100),
          `Skipping ${filePath} (${error.message})`
        );
      }
    }
  }
  
  return allVulnerabilities;
}

/**
 * Detect secrets in binary files (APK/IPA)
 * 
 * Extracts strings from binary files and scans for secret patterns
 * 
 * Note: This function requires additional dependencies (unzipper, plist, etc.)
 * which will be added in Feature 8 (Mobile Scan Service).
 * For now, this is a placeholder that returns empty array.
 */
export async function detectSecretsInBinary(
  binaryPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];
  
  if (progressCallback) {
    await progressCallback(0, 'Starting binary analysis...');
  }
  
  try {
    // Check if file exists
    await fs.access(binaryPath);
    
    // Read binary file as buffer
    const buffer = await fs.readFile(binaryPath);
    
    // Extract printable strings from binary (basic approach)
    // Look for strings that match secret patterns
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10 * 1024 * 1024)); // First 10MB
    
    if (progressCallback) {
      await progressCallback(50, 'Extracting strings from binary...');
    }
    
    // Check for secret patterns in extracted strings
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const secretPattern of SECRET_PATTERNS) {
        const match = line.match(secretPattern.pattern);
        if (match) {
          vulnerabilities.push({
            title: `Hardcoded ${secretPattern.type} in Binary`,
            description: `Binary file contains a hardcoded ${secretPattern.type.toLowerCase()}. This secret is embedded in the compiled binary and can be extracted by reverse engineering.`,
            severity: secretPattern.severity,
            category: 'Code Security',
            cwe: secretPattern.cwe,
            location: `${binaryPath}:embedded_string`,
            remediation: 'Remove hardcoded secrets from source code before compilation. Use runtime configuration or secure key storage mechanisms.',
            aiSuggestion: `SECRET FOUND IN BINARY:\n  ${secretPattern.type} detected in ${binaryPath}\n\nFIXED — remove from source:\n  // BEFORE (dangerous — compiled into binary):\n  const secret = "hardcoded_value";\n\n  // AFTER (safe — loaded at runtime):\n  const secret = process.env.SECRET_KEY;\n  // Or use secure key storage (Keychain on iOS, Keystore on Android)`,
            riskScore: secretPattern.severity === 'CRITICAL' ? 100 : 90,
            exploitabilityScore: 95, // Easier to extract from binary
            impactScore: 100,
          });
          break; // Only report once per line
        }
      }
    }
    
    if (progressCallback) {
      await progressCallback(100, 'Binary analysis complete');
    }
  } catch (error: any) {
    if (progressCallback) {
      await progressCallback(100, `Error analyzing binary: ${error.message}`);
    }
  }
  
  return vulnerabilities;
}
