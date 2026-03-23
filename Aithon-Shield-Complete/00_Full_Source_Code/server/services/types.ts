/**
 * Shared Types & Interfaces for Security Scanning Services
 * Feature 2: Shared Types & Interfaces
 * 
 * This file contains all shared TypeScript types and interfaces used across
 * MVP, Web, and Mobile scan services.
 */

/**
 * Vulnerability structure - represents a detected security vulnerability
 */
export interface Vulnerability {
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  cwe: string;
  location: string; // File path and line number, e.g., "src/main.ts:42" or "api/users:POST"
  remediation: string;
  aiSuggestion: string;
  riskScore: number; // 0-100
  exploitabilityScore?: number; // 0-100: How easy to exploit
  impactScore?: number; // 0-100: Business impact if exploited
}

/**
 * Scan result structure - represents the complete result of a scan
 */
export interface ScanResult {
  vulnerabilities: Vulnerability[];
  scanId: string;
  scanType: 'mvp' | 'web' | 'mobile';
  completedAt: Date;
  duration?: number; // milliseconds
}

/**
 * Progress callback type - function called to report scan progress
 * 
 * @param progress - Progress percentage (0-100)
 * @param stage - Current stage description, e.g., "Cloning repository", "Running SAST analysis"
 * @returns Promise<void> or void
 */
export type ProgressCallback = (progress: number, stage: string) => Promise<void> | void;

/**
 * MVP Code Scan Configuration
 */
export interface MvpScanConfig {
  language: string; // e.g., 'typescript', 'python', 'java'
  framework?: string; // e.g., 'react', 'express', 'django'
  environment?: string; // e.g., 'development', 'production'
  userId: string;
  scanId: string;
}

/**
 * Web App Scan Configuration
 */
export interface WebScanConfig {
  authenticationType?: string; // 'basic', 'form', 'api-key', 'none'
  username?: string;
  password?: string;
  userId: string;
  scanId: string;
}

/**
 * Mobile App Scan Configuration
 */
export interface MobileScanConfig {
  packageName?: string; // Bundle ID (iOS) or Package name (Android)
  version?: string;
  userId: string;
  scanId: string;
}

/**
 * Auth Configuration for authenticated scans
 */
export interface AuthConfig {
  type: 'basic' | 'form' | 'api-key' | 'oauth' | 'none';
  username?: string;
  password?: string;
  apiKey?: string;
  loginUrl?: string;
  tokenHeader?: string; // e.g., 'Authorization', 'X-API-Key'
}

/**
 * Page structure for web crawling results
 */
export interface Page {
  url: string;
  forms: Form[];
  links: string[];
  endpoints: string[];
}

/**
 * Form structure for web form analysis
 */
export interface Form {
  action: string;
  method: string;
  inputs: FormInput[];
}

/**
 * Form input structure
 */
export interface FormInput {
  name: string;
  type: string;
  required: boolean;
}

/**
 * Dependency structure for SCA (Software Composition Analysis)
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'npm' | 'pip' | 'maven' | 'gradle' | 'go' | 'gem' | 'composer' | 'cargo';
  file: string; // Path to dependency file
}

/**
 * Dependency manifest structure
 */
export interface DependencyManifest {
  dependencies: Dependency[];
  type: string; // 'npm', 'pip', etc.
}

/**
 * APK Content structure for Android app analysis
 */
export interface APKContent {
  manifestPath: string;
  resourcesPath: string;
  classesPath: string;
}

/**
 * IPA Content structure for iOS app analysis
 */
export interface IPAContent {
  plistPath: string;
  binaryPath: string;
  resourcesPath: string;
}

/**
 * Android Manifest Content structure
 */
export interface ManifestContent {
  permissions: string[];
  exportedComponents: string[];
  debuggable: boolean;
}

/**
 * iOS Info.plist Content structure
 */
export interface InfoPlistContent {
  urlSchemes: string[];
  permissions: string[];
  atsEnabled: boolean; // App Transport Security enabled
}
