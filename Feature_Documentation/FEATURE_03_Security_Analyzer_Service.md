# Feature 3: Security Analyzer Service (Shared Vulnerability Detection)

**Feature ID:** FEATURE-03  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 4-6 hours  
**Dependencies:** Feature 2 (Shared Types)  
**Related Todos:** Task 1

---

## Overview

Extract shared vulnerability detection patterns from the linter scan endpoint into a reusable service module that can be used by MVP, Web, and Mobile scan services.

---

## Requirements

### Functions to Implement

1. **`detectSQLInjection(code: string, language: string): Vulnerability[]`**
   - Detects SQL injection vulnerabilities
   - Supports multiple languages

2. **`detectHardcodedCredentials(code: string, language: string): Vulnerability[]`**
   - Detects hardcoded secrets, passwords, API keys
   - Supports multiple languages

3. **`detectXSS(code: string, language: string): Vulnerability[]`**
   - Detects Cross-Site Scripting vulnerabilities
   - Focuses on DOM manipulation

4. **`detectCommandInjection(code: string, language: string): Vulnerability[]`**
   - Detects command injection vulnerabilities
   - Platform-specific patterns

5. **`detectInsecureDeserialization(code: string, language: string): Vulnerability[]`**
   - Detects unsafe deserialization
   - Language-specific (pickle, yaml, etc.)

6. **`detectSensitiveDataExposure(code: string, language: string): Vulnerability[]`**
   - Detects sensitive data in logs, responses
   - Pattern-based detection

7. **`detectAuthenticationFlaws(code: string, language: string): Vulnerability[]`**
   - Detects authentication weaknesses
   - Missing validation, weak passwords

8. **`detectOWASPTop10Issues(code: string, language: string): Vulnerability[]`**
   - Comprehensive OWASP Top 10 detection
   - Combines multiple detection functions

---

## Implementation Details

### Files to Create

1. **`server/services/securityAnalyzer.ts`**
   - Main service file with all detection functions
   - Exports all functions

### Source Code Reference

Extract patterns from:
- `server/routes.ts` lines 4711-4900+ (linter scan endpoint)

### Key Patterns to Extract

1. **SQL Injection Patterns** (lines 4712-4737)
   - Template literals in SQL
   - String concatenation in queries
   - Parameterized query detection

2. **Hardcoded Credentials** (lines 4739-4756)
   - Password/secret patterns
   - API key patterns
   - Token patterns

3. **XSS Patterns** (lines 4776-4790)
   - innerHTML usage
   - document.write
   - dangerouslySetInnerHTML

4. **Command Injection** (lines 4812-4826)
   - subprocess with shell=True
   - os.system, os.popen

5. **Insecure Deserialization** (lines 4828-4839)
   - pickle.loads
   - yaml.load without SafeLoader

---

## Function Signatures

```typescript
export function detectSQLInjection(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectHardcodedCredentials(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectXSS(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectCommandInjection(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectInsecureDeserialization(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectSensitiveDataExposure(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectAuthenticationFlaws(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];

export function detectOWASPTop10Issues(
  code: string, 
  language: string, 
  filePath?: string
): Vulnerability[];
```

---

## Testing

### Test Cases

1. **SQL Injection Detection**
   - Test with vulnerable code samples
   - Test with safe code samples
   - Test multiple languages

2. **Hardcoded Credentials**
   - Test various credential patterns
   - Test false positives
   - Test multiple languages

3. **XSS Detection**
   - Test DOM manipulation patterns
   - Test safe alternatives
   - Test React-specific patterns

4. **Integration Testing**
   - Test with real code samples
   - Verify no false positives
   - Verify all patterns detected

---

## Acceptance Criteria

- [ ] All 8 detection functions implemented
- [ ] Functions extract patterns from linter scan code
- [ ] Functions return Vulnerability[] arrays
- [ ] Functions support multiple languages
- [ ] Functions include file path in location field
- [ ] Unit tests pass
- [ ] No false positives in test cases

---

## Notes

- This service will be used by Features 6-8 (scan services)
- Patterns should match linter scan behavior exactly
- Language auto-detection should be included

---

## Next Steps

After this feature is complete:
- Feature 4: Secrets Detector Service (specialized version)
- Feature 6-8: Scan Services (will use this service)
