/**
 * Feature 3 Test Script: Security Analyzer Service
 * Tests all vulnerability detection functions
 */

import {
  detectSQLInjection,
  detectHardcodedCredentials,
  detectXSS,
  detectCommandInjection,
  detectInsecureDeserialization,
  detectSensitiveDataExposure,
  detectAuthenticationFlaws,
  detectOWASPTop10Issues,
} from './server/services/securityAnalyzer';

console.log('🧪 Testing Feature 3: Security Analyzer Service\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) {
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
}

// Test 1: SQL Injection Detection (JavaScript)
console.log('Test 1: SQL Injection Detection (JavaScript)...');
test('Detects template literal SQL injection', () => {
  const code = `const query = \`SELECT * FROM users WHERE id = \${userId}\`;`;
  const vulns = detectSQLInjection(code, 'javascript', 'test.js');
  return vulns.length > 0 && vulns[0].severity === 'CRITICAL';
});

test('Detects string concatenation SQL injection', () => {
  const code = `const sql = "SELECT * FROM users WHERE name = " + userName;`;
  const vulns = detectSQLInjection(code, 'javascript', 'test.js');
  return vulns.length > 0;
});

test('Detects SQL injection in Python', () => {
  const code = `cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")`;
  const vulns = detectSQLInjection(code, 'python', 'test.py');
  return vulns.length > 0 && vulns[0].severity === 'CRITICAL';
});

test('Does not flag safe parameterized queries', () => {
  const code = `db.query('SELECT * FROM users WHERE id = ?', [userId]);`;
  const vulns = detectSQLInjection(code, 'javascript', 'test.js');
  return vulns.length === 0;
});

// Test 2: Hardcoded Credentials Detection
console.log('\nTest 2: Hardcoded Credentials Detection...');
test('Detects hardcoded password', () => {
  const code = `const password = "mySecretPassword123";`;
  const vulns = detectHardcodedCredentials(code, 'javascript', 'test.js');
  return vulns.length > 0 && vulns[0].severity === 'CRITICAL';
});

test('Detects hardcoded API key', () => {
  const code = `api_key = "sk_live_1234567890abcdef"`;
  const vulns = detectHardcodedCredentials(code, 'python', 'test.py');
  return vulns.length > 0;
});

test('Detects hardcoded token', () => {
  const code = `const auth_token = "Bearer abc123xyz";`;
  const vulns = detectHardcodedCredentials(code, 'typescript', 'test.ts');
  return vulns.length > 0;
});

// Test 3: XSS Detection
console.log('\nTest 3: XSS Detection...');
test('Detects innerHTML usage', () => {
  const code = `element.innerHTML = userInput;`;
  const vulns = detectXSS(code, 'javascript', 'test.js');
  return vulns.length > 0 && vulns[0].severity === 'HIGH';
});

test('Detects document.write', () => {
  const code = `document.write(userContent);`;
  const vulns = detectXSS(code, 'javascript', 'test.js');
  return vulns.length > 0;
});

test('Detects dangerouslySetInnerHTML', () => {
  const code = `<div dangerouslySetInnerHTML={{ __html: userHtml }} />`;
  const vulns = detectXSS(code, 'typescript', 'test.tsx');
  return vulns.length > 0;
});

test('Does not flag XSS in Python code', () => {
  const code = `print("Hello world")`;
  const vulns = detectXSS(code, 'python', 'test.py');
  return vulns.length === 0;
});

// Test 4: Command Injection Detection
console.log('\nTest 4: Command Injection Detection...');
test('Detects subprocess with shell=True', () => {
  const code = `subprocess.run(command, shell=True)`;
  const vulns = detectCommandInjection(code, 'python', 'test.py');
  return vulns.length > 0 && vulns[0].severity === 'CRITICAL';
});

test('Detects os.system', () => {
  const code = `os.system(f"ping {hostname}")`;
  const vulns = detectCommandInjection(code, 'python', 'test.py');
  return vulns.length > 0;
});

test('Does not flag command injection in JavaScript', () => {
  const code = `exec('ls -la')`;
  const vulns = detectCommandInjection(code, 'javascript', 'test.js');
  return vulns.length === 0; // Our patterns are Python-specific
});

// Test 5: Insecure Deserialization Detection
console.log('\nTest 5: Insecure Deserialization Detection...');
test('Detects pickle.loads', () => {
  const code = `data = pickle.loads(user_data)`;
  const vulns = detectInsecureDeserialization(code, 'python', 'test.py');
  return vulns.length > 0 && vulns[0].severity === 'CRITICAL';
});

test('Detects yaml.load without SafeLoader', () => {
  const code = `config = yaml.load(file)`;
  const vulns = detectInsecureDeserialization(code, 'python', 'test.py');
  return vulns.length > 0;
});

test('Does not flag safe yaml.safe_load', () => {
  const code = `config = yaml.safe_load(file)`;
  const vulns = detectInsecureDeserialization(code, 'python', 'test.py');
  return vulns.length === 0;
});

// Test 6: Sensitive Data Exposure Detection
console.log('\nTest 6: Sensitive Data Exposure Detection...');
test('Detects password in console.log', () => {
  const code = `console.log("Password:", userPassword);`;
  const vulns = detectSensitiveDataExposure(code, 'javascript', 'test.js');
  return vulns.length > 0 && vulns[0].severity === 'HIGH';
});

test('Detects token in print statement', () => {
  const code = `print(f"Token: {auth_token}")`;
  const vulns = detectSensitiveDataExposure(code, 'python', 'test.py');
  return vulns.length > 0;
});

// Test 7: Authentication Flaws Detection
console.log('\nTest 7: Authentication Flaws Detection...');
test('Detects missing auth middleware on sensitive route', () => {
  const code = `app.get('/api/user/profile', async (req, res) => {
    const user = await getUser(req.user.id);
    res.json(user);
  });`;
  const vulns = detectAuthenticationFlaws(code, 'javascript', 'test.js');
  return vulns.length > 0;
});

test('Does not flag route with auth middleware', () => {
  const code = `app.get('/api/user/profile', requireAuth, async (req, res) => {
    const user = await getUser(req.user.id);
    res.json(user);
  });`;
  const vulns = detectAuthenticationFlaws(code, 'javascript', 'test.js');
  return vulns.length === 0;
});

// Test 8: OWASP Top 10 Detection
console.log('\nTest 8: OWASP Top 10 Detection...');
test('Detects multiple OWASP issues', () => {
  const code = `
    const query = \`SELECT * FROM users WHERE id = \${userId}\`;
    const password = "hardcoded123";
    element.innerHTML = userInput;
  `;
  const vulns = detectOWASPTop10Issues(code, 'javascript', 'test.js');
  return vulns.length >= 3; // Should detect SQL injection, credentials, and XSS
});

// Test 9: File path in location
console.log('\nTest 9: File Path in Location...');
test('Includes file path in vulnerability location', () => {
  const code = `const password = "secret123";`;
  const vulns = detectHardcodedCredentials(code, 'javascript', 'src/auth.js');
  return vulns.length > 0 && vulns[0].location.includes('src/auth.js');
});

// Test 10: Vulnerability structure
console.log('\nTest 10: Vulnerability Structure...');
test('Vulnerabilities have all required fields', () => {
  const code = `const password = "secret123";`;
  const vulns = detectHardcodedCredentials(code, 'javascript', 'test.js');
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
  console.log('\n✅ All Feature 3 tests passed!');
  console.log('\nSummary:');
  console.log('  - ✅ SQL Injection detection working');
  console.log('  - ✅ Hardcoded credentials detection working');
  console.log('  - ✅ XSS detection working');
  console.log('  - ✅ Command injection detection working');
  console.log('  - ✅ Insecure deserialization detection working');
  console.log('  - ✅ Sensitive data exposure detection working');
  console.log('  - ✅ Authentication flaws detection working');
  console.log('  - ✅ OWASP Top 10 detection working');
  console.log('  - ✅ File paths included in locations');
  console.log('  - ✅ Vulnerability structure correct');
  process.exit(0);
} else {
  console.log(`\n❌ ${testsFailed} test(s) failed`);
  process.exit(1);
}
