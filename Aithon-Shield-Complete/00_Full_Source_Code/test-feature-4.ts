/**
 * Feature 4 Test Script: Secrets Detector Service
 * Tests all secrets detection functions
 */

import {
  detectSecretsInCode,
  detectSecretsInFiles,
  detectSecretsInBinary,
} from './server/services/secretsDetector';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

console.log('🧪 Testing Feature 4: Secrets Detector Service\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => Promise<boolean> | boolean) {
  return (async () => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        testsPassed++;
      } else {
        console.log(`❌ ${name}`);
        testsFailed++;
      }
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
      testsFailed++;
    }
  })();
}

async function runTests() {
  // Test 1: detectSecretsInCode - API Keys
  await test('Detects API keys in code', async () => {
    const code = `const API_KEY = "sk_live_1234567890abcdef";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    return vulns.length > 0 && vulns.some(v => v.title.includes('API Key'));
  });

  // Test 2: detectSecretsInCode - AWS Keys
  await test('Detects AWS credentials', async () => {
    const code = `aws_access_key_id = "AKIAIOSFODNN7EXAMPLE"`;
    const vulns = await detectSecretsInCode(code, 'test.py', 'python');
    return vulns.length > 0 && vulns.some(v => v.title.includes('AWS'));
  });

  // Test 3: detectSecretsInCode - Database URLs
  await test('Detects database URLs with credentials', async () => {
    const code = `const dbUrl = "postgresql://user:password@localhost/dbname";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    return vulns.length > 0 && vulns.some(v => v.title.includes('Database URL'));
  });

  // Test 4: detectSecretsInCode - JWT Tokens
  await test('Detects JWT tokens', async () => {
    const code = `const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    return vulns.length > 0 && vulns.some(v => v.title.includes('JWT'));
  });

  // Test 5: detectSecretsInCode - Private Keys
  await test('Detects private keys', async () => {
    const code = `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`;
    const vulns = await detectSecretsInCode(code, 'test.key', 'unknown');
    return vulns.length > 0 && vulns.some(v => v.title.includes('Private Key'));
  });

  // Test 6: detectSecretsInCode - Stripe Keys
  await test('Detects Stripe API keys', async () => {
    const code = `const stripeKey = "sk_live_EXAMPLE_REDACTED";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    return vulns.length > 0 && vulns.some(v => v.title.includes('Stripe'));
  });

  // Test 7: detectSecretsInCode - GitHub Tokens
  await test('Detects GitHub tokens', async () => {
    const code = `const githubToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    return vulns.length > 0 && vulns.some(v => v.title.includes('GitHub'));
  });

  // Test 8: detectSecretsInCode - Uses Security Analyzer
  await test('Uses Security Analyzer for basic credentials', async () => {
    const code = `const password = "mySecretPassword123";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    return vulns.length > 0 && vulns.some(v => v.title.includes('Hardcoded Credential'));
  });

  // Test 9: detectSecretsInCode - File path in location
  await test('Includes file path in vulnerability location', async () => {
    const code = `const API_KEY = "sk_test_1234567890";`;
    const vulns = await detectSecretsInCode(code, 'src/config.js', 'javascript');
    return vulns.length > 0 && vulns[0].location.includes('src/config.js');
  });

  // Test 10: detectSecretsInFiles - Multiple files
  await test('Scans multiple files for secrets', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'secrets-test-'));
    try {
      const file1 = path.join(tempDir, 'file1.js');
      const file2 = path.join(tempDir, 'file2.js');
      
      await fs.writeFile(file1, 'const API_KEY = "sk_test_1234567890";');
      await fs.writeFile(file2, 'const password = "secret123";');
      
      const progressUpdates: Array<{ progress: number; stage: string }> = [];
      const progressCallback = async (progress: number, stage: string) => {
        progressUpdates.push({ progress, stage });
      };
      
      const vulns = await detectSecretsInFiles(
        ['file1.js', 'file2.js'],
        tempDir,
        progressCallback
      );
      
      return vulns.length >= 2 && progressUpdates.length > 0;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 11: detectSecretsInFiles - Progress callback
  await test('Progress callback works correctly', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'secrets-test-'));
    try {
      const file1 = path.join(tempDir, 'file1.js');
      await fs.writeFile(file1, 'const API_KEY = "sk_test_1234567890";');
      
      const progressUpdates: Array<{ progress: number; stage: string }> = [];
      const progressCallback = async (progress: number, stage: string) => {
        progressUpdates.push({ progress, stage });
      };
      
      await detectSecretsInFiles(['file1.js'], tempDir, progressCallback);
      
      return progressUpdates.length > 0 && progressUpdates[0].progress >= 0;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 12: detectSecretsInBinary - Basic functionality
  await test('Binary detection function exists and runs', async () => {
    const tempFile = path.join(os.tmpdir(), 'test-binary.bin');
    try {
      // Create a simple binary file with some text
      await fs.writeFile(tempFile, Buffer.from('API_KEY=sk_test_1234567890\npassword=secret123'));
      
      const progressUpdates: Array<{ progress: number; stage: string }> = [];
      const progressCallback = async (progress: number, stage: string) => {
        progressUpdates.push({ progress, stage });
      };
      
      const vulns = await detectSecretsInBinary(tempFile, progressCallback);
      
      // Function should run without errors (may or may not find secrets)
      return progressUpdates.length > 0;
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  // Test 13: Vulnerability structure
  await test('Vulnerabilities have all required fields', async () => {
    const code = `const API_KEY = "sk_test_1234567890";`;
    const vulns = await detectSecretsInCode(code, 'test.js', 'javascript');
    if (vulns.length === 0) return false;
    
    const vuln = vulns[0];
    return (
      typeof vuln.title === 'string' &&
      typeof vuln.description === 'string' &&
      typeof vuln.severity === 'string' &&
      typeof vuln.category === 'string' &&
      typeof vuln.cwe === 'string' &&
      typeof vuln.location === 'string' &&
      typeof vuln.remediation === 'string' &&
      typeof vuln.aiSuggestion === 'string' &&
      typeof vuln.riskScore === 'number' &&
      vuln.riskScore >= 0 &&
      vuln.riskScore <= 100
    );
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed === 0) {
    console.log('\n✅ All Feature 4 tests passed!');
    console.log('\nSummary:');
    console.log('  - ✅ API key detection working');
    console.log('  - ✅ AWS credential detection working');
    console.log('  - ✅ Database URL detection working');
    console.log('  - ✅ JWT token detection working');
    console.log('  - ✅ Private key detection working');
    console.log('  - ✅ Stripe key detection working');
    console.log('  - ✅ GitHub token detection working');
    console.log('  - ✅ Security Analyzer integration working');
    console.log('  - ✅ File path support working');
    console.log('  - ✅ Multiple file scanning working');
    console.log('  - ✅ Progress callback working');
    console.log('  - ✅ Binary detection function exists');
    console.log('  - ✅ Vulnerability structure correct');
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
