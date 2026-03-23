/**
 * Feature 5 Test Script: SCA Analyzer Service
 * Tests dependency parsing and vulnerability checking
 */

import {
  parseDependencies,
  checkDependencyVulnerabilities,
  performSCAScan,
} from './server/services/scaAnalyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Dependency } from './server/services/types';

console.log('🧪 Testing Feature 5: SCA Analyzer Service\n');

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
  // Test 1: Parse package.json
  await test('Parses package.json dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const packageJson = {
        name: 'test-app',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
          'lodash': '4.17.21',
        },
        devDependencies: {
          'typescript': '^5.0.0',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 3 &&
             manifest.dependencies.some(d => d.name === 'express' && d.type === 'npm');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 2: Parse requirements.txt
  await test('Parses requirements.txt dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const requirements = 'flask==2.0.0\nrequests>=2.25.0\npytest==7.0.0';
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), requirements);

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 3 &&
             manifest.dependencies.some(d => d.name === 'flask' && d.type === 'pip');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 3: Parse go.mod
  await test('Parses go.mod dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const goMod = `module test-app

require (
    github.com/gin-gonic/gin v1.9.0
    github.com/lib/pq v1.10.7
)`;
      await fs.writeFile(path.join(tempDir, 'go.mod'), goMod);

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 2 &&
             manifest.dependencies.some(d => d.name.includes('gin') && d.type === 'go');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 4: Parse Gemfile
  await test('Parses Gemfile dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const gemfile = `source 'https://rubygems.org'

gem 'rails', '~> 7.0.0'
gem 'pg', '>= 1.0'
gem 'rspec', '~> 3.0'`;
      await fs.writeFile(path.join(tempDir, 'Gemfile'), gemfile);

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 3 &&
             manifest.dependencies.some(d => d.name === 'rails' && d.type === 'gem');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 5: Parse composer.json
  await test('Parses composer.json dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const composerJson = {
        name: 'test/app',
        require: {
          'laravel/framework': '^10.0',
          'guzzlehttp/guzzle': '^7.0',
        },
        'require-dev': {
          'phpunit/phpunit': '^10.0',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'composer.json'),
        JSON.stringify(composerJson, null, 2)
      );

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 3 &&
             manifest.dependencies.some(d => d.name === 'laravel/framework' && d.type === 'composer');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 6: Parse Cargo.toml
  await test('Parses Cargo.toml dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const cargoToml = `[package]
name = "test-app"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }`;
      await fs.writeFile(path.join(tempDir, 'Cargo.toml'), cargoToml);

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 2 &&
             manifest.dependencies.some(d => d.name === 'serde' && d.type === 'cargo');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 7: Parse pom.xml (basic)
  await test('Parses pom.xml dependencies', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const pomXml = `<?xml version="1.0"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.21</version>
    </dependency>
  </dependencies>
</project>`;
      await fs.writeFile(path.join(tempDir, 'pom.xml'), pomXml);

      const manifest = await parseDependencies(tempDir);
      return manifest.dependencies.length >= 1 &&
             manifest.dependencies.some(d => d.name.includes('spring-core') && d.type === 'maven');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 8: Handles missing files gracefully
  await test('Handles missing dependency files gracefully', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const manifest = await parseDependencies(tempDir);
      // Should return empty dependencies, not throw error
      return manifest.dependencies.length === 0 && manifest.type === 'unknown';
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 9: Dependency manifest structure
  await test('Dependency manifest has correct structure', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const packageJson = {
        dependencies: { 'express': '^4.18.0' },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const manifest = await parseDependencies(tempDir);
      return (
        Array.isArray(manifest.dependencies) &&
        typeof manifest.type === 'string' &&
        manifest.dependencies.every((d: Dependency) =>
          typeof d.name === 'string' &&
          typeof d.version === 'string' &&
          typeof d.type === 'string' &&
          typeof d.file === 'string'
        )
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 10: checkDependencyVulnerabilities function exists
  await test('checkDependencyVulnerabilities function exists', async () => {
    const testDeps: Dependency[] = [
      { name: 'express', version: '4.18.0', type: 'npm', file: 'package.json' },
    ];
    
    // Function should run without errors (may or may not find vulnerabilities)
    const vulns = await checkDependencyVulnerabilities(testDeps);
    return Array.isArray(vulns);
  });

  // Test 11: performSCAScan function exists
  await test('performSCAScan function exists', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const packageJson = {
        dependencies: { 'express': '^4.18.0' },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const progressUpdates: Array<{ progress: number; stage: string }> = [];
      const progressCallback = async (progress: number, stage: string) => {
        progressUpdates.push({ progress, stage });
      };

      const vulns = await performSCAScan(tempDir, progressCallback);
      
      // Function should run without errors
      return Array.isArray(vulns) && progressUpdates.length > 0;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Test 12: Progress callback works
  await test('Progress callback works correctly', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-test-'));
    try {
      const packageJson = {
        dependencies: { 'express': '^4.18.0' },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const progressUpdates: Array<{ progress: number; stage: string }> = [];
      const progressCallback = async (progress: number, stage: string) => {
        progressUpdates.push({ progress, stage });
      };

      await performSCAScan(tempDir, progressCallback);
      
      return progressUpdates.length > 0 && progressUpdates[0].progress >= 0;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsFailed + testsPassed}`);
  console.log('='.repeat(50));

  if (testsFailed === 0) {
    console.log('\n✅ All Feature 5 tests passed!');
    console.log('\nSummary:');
    console.log('  - ✅ package.json parsing working');
    console.log('  - ✅ requirements.txt parsing working');
    console.log('  - ✅ go.mod parsing working');
    console.log('  - ✅ Gemfile parsing working');
    console.log('  - ✅ composer.json parsing working');
    console.log('  - ✅ Cargo.toml parsing working');
    console.log('  - ✅ pom.xml parsing working');
    console.log('  - ✅ Missing files handled gracefully');
    console.log('  - ✅ Dependency manifest structure correct');
    console.log('  - ✅ Vulnerability checking function exists');
    console.log('  - ✅ SCA scan function exists');
    console.log('  - ✅ Progress callback working');
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
