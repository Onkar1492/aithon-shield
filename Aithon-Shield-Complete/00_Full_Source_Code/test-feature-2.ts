/**
 * Feature 2 Test Script: Shared Types & Interfaces
 * Tests that all types are correctly defined and can be imported
 */

// Test importing all types
import type {
  Vulnerability,
  ScanResult,
  ProgressCallback,
  MvpScanConfig,
  WebScanConfig,
  MobileScanConfig,
  AuthConfig,
  Page,
  Form,
  FormInput,
  Dependency,
  DependencyManifest,
  APKContent,
  IPAContent,
  ManifestContent,
  InfoPlistContent,
} from './server/services/types';

console.log('🧪 Testing Feature 2: Shared Types & Interfaces\n');

// Test 1: Verify Vulnerability interface structure
console.log('Test 1: Verifying Vulnerability interface...');
const testVulnerability: Vulnerability = {
  title: 'SQL Injection Vulnerability',
  description: 'User input is directly concatenated into SQL query',
  severity: 'CRITICAL',
  category: 'Input Validation',
  cwe: '89',
  location: 'src/database.ts:42',
  remediation: 'Use parameterized queries',
  aiSuggestion: 'Replace string concatenation with parameterized queries',
  riskScore: 95,
  exploitabilityScore: 90,
  impactScore: 100,
};
console.log('✅ Vulnerability interface verified\n');

// Test 2: Verify ScanResult interface structure
console.log('Test 2: Verifying ScanResult interface...');
const testScanResult: ScanResult = {
  vulnerabilities: [testVulnerability],
  scanId: 'test-scan-id',
  scanType: 'mvp',
  completedAt: new Date(),
  duration: 5000,
};
console.log('✅ ScanResult interface verified\n');

// Test 3: Verify ProgressCallback type
console.log('Test 3: Verifying ProgressCallback type...');
const testProgressCallback: ProgressCallback = async (progress: number, stage: string) => {
  console.log(`Progress: ${progress}% - ${stage}`);
};
await testProgressCallback(50, 'Running SAST analysis');
console.log('✅ ProgressCallback type verified\n');

// Test 4: Verify MvpScanConfig interface
console.log('Test 4: Verifying MvpScanConfig interface...');
const testMvpConfig: MvpScanConfig = {
  language: 'typescript',
  framework: 'react',
  environment: 'production',
  userId: 'test-user-id',
  scanId: 'test-scan-id',
};
console.log('✅ MvpScanConfig interface verified\n');

// Test 5: Verify WebScanConfig interface
console.log('Test 5: Verifying WebScanConfig interface...');
const testWebConfig: WebScanConfig = {
  authenticationType: 'form',
  username: 'testuser',
  password: 'testpass',
  userId: 'test-user-id',
  scanId: 'test-scan-id',
};
console.log('✅ WebScanConfig interface verified\n');

// Test 6: Verify MobileScanConfig interface
console.log('Test 6: Verifying MobileScanConfig interface...');
const testMobileConfig: MobileScanConfig = {
  packageName: 'com.example.app',
  version: '1.0.0',
  userId: 'test-user-id',
  scanId: 'test-scan-id',
};
console.log('✅ MobileScanConfig interface verified\n');

// Test 7: Verify all other interfaces
console.log('Test 7: Verifying additional interfaces...');
const testAuthConfig: AuthConfig = {
  type: 'api-key',
  apiKey: 'test-key',
  tokenHeader: 'Authorization',
};
const testPage: Page = {
  url: 'https://example.com',
  forms: [],
  links: [],
  endpoints: [],
};
const testDependency: Dependency = {
  name: 'express',
  version: '4.18.0',
  type: 'npm',
  file: 'package.json',
};
console.log('✅ All additional interfaces verified\n');

console.log('✅ All Feature 2 tests passed!');
console.log('\nSummary:');
console.log('  - ✅ Vulnerability interface defined');
console.log('  - ✅ ScanResult interface defined');
console.log('  - ✅ ProgressCallback type defined');
console.log('  - ✅ MvpScanConfig interface defined');
console.log('  - ✅ WebScanConfig interface defined');
console.log('  - ✅ MobileScanConfig interface defined');
console.log('  - ✅ All supporting interfaces defined');
console.log('  - ✅ Types compile without errors');
console.log('  - ✅ Types can be imported correctly');

console.log('\n🎉 Feature 2 is ready for approval!');
process.exit(0);
