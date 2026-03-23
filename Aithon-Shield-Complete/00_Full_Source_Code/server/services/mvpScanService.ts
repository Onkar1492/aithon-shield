/**
 * MVP Scan Service
 * Feature 6: Comprehensive MVP Code Repository Scanning
 * 
 * Orchestrates repository cloning, SAST analysis, SCA analysis, and secrets detection
 * to provide comprehensive security scanning for MVP code repositories.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  detectSQLInjection,
  detectHardcodedCredentials,
  detectXSS,
  detectCommandInjection,
  detectInsecureDeserialization,
  detectSensitiveDataExposure,
  detectAuthenticationFlaws,
  detectOWASPTop10Issues,
} from './securityAnalyzer';
import { detectSecretsInFiles } from './secretsDetector';
import { performSCAScan } from './scaAnalyzer';
import type { Vulnerability, ScanResult, MvpScanConfig, ProgressCallback } from './types';
import { validateMvpRepositoryUrl } from './scanValidation';

const execAsync = promisify(exec);

/**
 * Clone Git repository to temporary directory
 * 
 * Supports GitHub, GitLab, and Bitbucket repositories
 */
export async function cloneRepository(
  repositoryUrl: string,
  accessToken?: string,
  progressCallback?: ProgressCallback
): Promise<string> {
  // Validate repository URL format
  const validation = validateMvpRepositoryUrl(repositoryUrl);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid repository URL');
  }

  if (progressCallback) {
    await progressCallback(0, 'Preparing to clone repository...');
  }

  // Create temporary directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvp-scan-'));
  
  try {
    // Prepare URL with authentication if token provided
    let cloneUrl = repositoryUrl;
    if (accessToken) {
      // Add token to URL for authentication
      if (repositoryUrl.includes('github.com')) {
        cloneUrl = repositoryUrl.replace('https://', `https://${accessToken}@`);
      } else if (repositoryUrl.includes('gitlab.com')) {
        cloneUrl = repositoryUrl.replace('https://', `https://oauth2:${accessToken}@`);
      } else if (repositoryUrl.includes('bitbucket.org')) {
        cloneUrl = repositoryUrl.replace('https://', `https://x-token-auth:${accessToken}@`);
      }
    }

    if (progressCallback) {
      await progressCallback(10, 'Cloning repository...');
    }

    // Clone repository using git command
    // Note: Requires git to be installed on the system
    try {
      await execAsync(`git clone --depth 1 ${cloneUrl} ${tempDir}`, {
        timeout: 60000, // 60 second timeout
      });
    } catch (error: any) {
      // Handle specific git errors
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Repository access denied. Please check your authentication token.');
      }
      if (error.message.includes('404')) {
        throw new Error('Repository not found. Please verify the repository URL.');
      }
      if (error.message.includes('timeout')) {
        throw new Error('Repository cloning timed out. Please try again.');
      }
      throw new Error(`Failed to clone repository: ${error.message}`);
    }

    if (progressCallback) {
      await progressCallback(20, 'Repository cloned successfully');
    }

    return tempDir;
  } catch (error) {
    // Clean up temp directory on error
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Find all source files in repository
 */
async function findSourceFiles(repoPath: string, language: string): Promise<string[]> {
  const sourceFiles: string[] = [];
  
  // Language-specific file extensions
  const extensions: Record<string, string[]> = {
    javascript: ['.js', '.jsx'],
    typescript: ['.ts', '.tsx'],
    python: ['.py'],
    java: ['.java'],
    go: ['.go'],
    ruby: ['.rb'],
    php: ['.php'],
    cpp: ['.cpp', '.c', '.h', '.hpp'],
    csharp: ['.cs'],
    swift: ['.swift'],
    kotlin: ['.kt'],
    rust: ['.rs'],
  };

  const exts = extensions[language.toLowerCase()] || ['.js', '.ts', '.py', '.java', '.go'];
  
  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules, .git, and other common directories
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '__pycache__') {
          continue;
        }
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (exts.includes(ext)) {
            const relativePath = path.relative(repoPath, fullPath);
            sourceFiles.push(relativePath);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  await scanDirectory(repoPath);
  return sourceFiles;
}

/**
 * Perform SAST (Static Application Security Testing) scan
 * 
 * Scans all source files for security vulnerabilities using Security Analyzer
 */
export async function performSASTScan(
  repoPath: string,
  language: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]> {
  const allVulnerabilities: Vulnerability[] = [];
  
  if (progressCallback) {
    await progressCallback(0, 'Finding source files...');
  }
  
  // Find all source files
  const sourceFiles = await findSourceFiles(repoPath, language);
  
  if (sourceFiles.length === 0) {
    if (progressCallback) {
      await progressCallback(100, 'No source files found');
    }
    return [];
  }
  
  if (progressCallback) {
    await progressCallback(10, `Found ${sourceFiles.length} source files`);
  }
  
  // Scan each file
  for (let i = 0; i < sourceFiles.length; i++) {
    const filePath = sourceFiles[i];
    const fullPath = path.join(repoPath, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Run all security detection functions
      allVulnerabilities.push(...detectSQLInjection(content, language, filePath));
      allVulnerabilities.push(...detectHardcodedCredentials(content, language, filePath));
      allVulnerabilities.push(...detectXSS(content, language, filePath));
      allVulnerabilities.push(...detectCommandInjection(content, language, filePath));
      allVulnerabilities.push(...detectInsecureDeserialization(content, language, filePath));
      allVulnerabilities.push(...detectSensitiveDataExposure(content, language, filePath));
      allVulnerabilities.push(...detectAuthenticationFlaws(content, language, filePath));
      
      // Report progress
      if (progressCallback) {
        const progress = 10 + Math.floor(((i + 1) / sourceFiles.length) * 50);
        await progressCallback(progress, `Scanning ${filePath} (${i + 1}/${sourceFiles.length})`);
      }
    } catch (error) {
      // Skip files that can't be read
      if (progressCallback) {
        await progressCallback(
          10 + Math.floor(((i + 1) / sourceFiles.length) * 50),
          `Skipping ${filePath}`
        );
      }
    }
  }
  
  if (progressCallback) {
    await progressCallback(60, `SAST scan complete. Found ${allVulnerabilities.length} vulnerabilities`);
  }
  
  return allVulnerabilities;
}

/**
 * Main MVP code scan function
 * 
 * Orchestrates the complete scanning process:
 * 1. Clone repository (0-20%)
 * 2. SAST analysis (20-60%)
 * 3. SCA analysis (60-80%)
 * 4. Secrets detection (80-95%)
 * 5. Finalize (95-100%)
 */
export async function scanMvpCode(
  repositoryUrl: string,
  config: MvpScanConfig,
  progressCallback?: ProgressCallback
): Promise<ScanResult> {
  const startTime = Date.now();
  let tempDir: string | null = null;
  
  try {
    // Step 1: Clone Repository (0-20%)
    if (progressCallback) {
      await progressCallback(0, 'Starting MVP code scan...');
    }
    
    // Extract access token from config if available
    // Note: In real implementation, this would come from user's stored credentials
    const accessToken = undefined; // TODO: Get from config or user storage
    
    tempDir = await cloneRepository(repositoryUrl, accessToken, async (progress, stage) => {
      if (progressCallback) {
        // Map clone progress (0-100) to overall progress (0-20)
        await progressCallback(Math.floor(progress * 0.2), stage);
      }
    });
    
    // Step 2: SAST Analysis (20-60%)
    const sastVulnerabilities = await performSASTScan(
      tempDir,
      config.language,
      async (progress, stage) => {
        if (progressCallback) {
          // Map SAST progress (0-100) to overall progress (20-60)
          await progressCallback(20 + Math.floor(progress * 0.4), stage);
        }
      }
    );
    
    // Step 3: SCA Analysis (60-80%)
    if (progressCallback) {
      await progressCallback(60, 'Starting dependency vulnerability scan...');
    }
    
    const scaVulnerabilities = await performSCAScan(
      tempDir,
      async (progress, stage) => {
        if (progressCallback) {
          // Map SCA progress (0-100) to overall progress (60-80)
          await progressCallback(60 + Math.floor(progress * 0.2), stage);
        }
      }
    );
    
    // Step 4: Secrets Detection (80-95%)
    if (progressCallback) {
      await progressCallback(80, 'Scanning for hardcoded secrets...');
    }
    
    // Find all files for secrets scanning
    const allFiles: string[] = [];
    async function collectFiles(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name === 'build') {
            continue;
          }
          if (entry.isDirectory()) {
            await collectFiles(fullPath);
          } else if (entry.isFile()) {
            const relativePath = path.relative(tempDir!, fullPath);
            allFiles.push(relativePath);
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    }
    await collectFiles(tempDir);
    
    const secretsVulnerabilities = await detectSecretsInFiles(
      allFiles,
      tempDir,
      async (progress, stage) => {
        if (progressCallback) {
          // Map secrets progress (0-100) to overall progress (80-95)
          await progressCallback(80 + Math.floor(progress * 0.15), stage);
        }
      }
    );
    
    // Step 5: Finalize (95-100%)
    if (progressCallback) {
      await progressCallback(95, 'Aggregating results...');
    }
    
    // Combine all vulnerabilities
    const allVulnerabilities = [
      ...sastVulnerabilities,
      ...scaVulnerabilities,
      ...secretsVulnerabilities,
    ];
    
    const duration = Date.now() - startTime;
    
    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    
    if (progressCallback) {
      await progressCallback(100, `Scan complete. Found ${allVulnerabilities.length} vulnerabilities`);
    }
    
    // Return scan result
    return {
      vulnerabilities: allVulnerabilities,
      scanId: config.scanId,
      scanType: 'mvp',
      completedAt: new Date(),
      duration,
    };
  } catch (error: any) {
    // Clean up temp directory on error
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    
    if (progressCallback) {
      await progressCallback(100, `Scan failed: ${error.message}`);
    }
    
    throw error;
  }
}
