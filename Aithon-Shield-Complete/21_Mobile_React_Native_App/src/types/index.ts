export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  role?: string;
}

export interface MvpScan {
  id: number;
  userId: string;
  projectName: string;
  platform: string;
  repositoryUrl: string;
  branch: string;
  accessToken?: string;
  scanStatus: 'pending' | 'scanning' | 'completed' | 'failed';
  uploadStatus: 'none' | 'pending' | 'uploaded' | 'failed';
  fixesApplied: boolean;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebScan {
  id: number;
  userId: string;
  appName: string;
  appUrl: string;
  hostingPlatform: string;
  scanStatus: 'pending' | 'scanning' | 'completed' | 'failed';
  uploadStatus: 'none' | 'pending' | 'uploaded' | 'failed';
  fixesApplied: boolean;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MobileScan {
  id: number;
  userId: string;
  appName: string;
  appId: string;
  platform: 'ios' | 'android';
  version: string;
  scanStatus: 'pending' | 'scanning' | 'completed' | 'failed';
  uploadStatus: 'none' | 'pending' | 'uploaded' | 'failed';
  fixesApplied: boolean;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Finding {
  id: number;
  scanId: number;
  scanType: 'mvp' | 'web' | 'mobile';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'fixed' | 'ignored';
  cweId?: string;
  owaspCategory?: string;
  filePath?: string;
  lineNumber?: number;
  codeSnippet?: string;
  remediation?: string;
  aiFixAvailable: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalScans: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  securityScore: number;
  fixedFindings: number;
}

export type ScanType = 'mvp' | 'web' | 'mobile';
export type ScanStatus = 'pending' | 'scanning' | 'completed' | 'failed';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
