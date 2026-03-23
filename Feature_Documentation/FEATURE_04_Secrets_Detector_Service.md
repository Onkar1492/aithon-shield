# Feature 4: Secrets Detector Service

**Feature ID:** FEATURE-04  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 2-3 hours  
**Dependencies:** Feature 2 (Shared Types), Feature 3 (Security Analyzer)  
**Related Todos:** Task 2 (partially)

---

## Overview

Create a specialized service for detecting hardcoded secrets, API keys, passwords, and tokens in code repositories and mobile app binaries.

---

## Requirements

### Functions to Implement

1. **`detectSecretsInCode(code: string, filePath: string, language: string): Vulnerability[]`**
   - Scans code for hardcoded secrets
   - Uses patterns from Security Analyzer
   - File-specific detection

2. **`detectSecretsInFiles(filePaths: string[], repoPath: string): Promise<Vulnerability[]>`**
   - Scans multiple files for secrets
   - Recursive file scanning
   - Progress callback support

3. **`detectSecretsInBinary(binaryPath: string): Promise<Vulnerability[]>`**
   - Scans binary files (APK/IPA) for secrets
   - String extraction from binaries
   - Pattern matching on extracted strings

---

## Implementation Details

### Files to Create

1. **`server/services/secretsDetector.ts`**
   - Main secrets detection service
   - Exports all functions

### Secret Patterns

1. **API Keys**
   - `API_KEY=`, `api_key=`, `apikey=`
   - AWS: `aws_access_key_id`, `aws_secret_access_key`
   - Google: `GOOGLE_API_KEY`, `GCP_API_KEY`

2. **Passwords**
   - `password=`, `passwd=`, `pwd=`
   - Database URLs: `postgresql://`, `mongodb://`, `mysql://`

3. **Tokens**
   - `token=`, `auth_token=`, `access_token=`
   - JWT patterns
   - OAuth tokens

4. **Private Keys**
   - `PRIVATE_KEY=`, `private_key=`
   - SSH keys: `-----BEGIN RSA PRIVATE KEY-----`
   - Certificate keys

---

## Function Signatures

```typescript
export async function detectSecretsInCode(
  code: string,
  filePath: string,
  language: string
): Promise<Vulnerability[]>;

export async function detectSecretsInFiles(
  filePaths: string[],
  repoPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;

export async function detectSecretsInBinary(
  binaryPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;
```

---

## Testing

### Test Cases

1. **Code Scanning**
   - Test with various secret patterns
   - Test false positives
   - Test multiple languages

2. **File Scanning**
   - Test recursive scanning
   - Test large repositories
   - Test progress callbacks

3. **Binary Scanning**
   - Test APK string extraction
   - Test IPA string extraction
   - Test pattern matching

---

## Acceptance Criteria

- [ ] All 3 functions implemented
- [ ] Secrets detected in code files
- [ ] Secrets detected in binary files
- [ ] Progress callbacks work
- [ ] Unit tests pass
- [ ] Low false positive rate

---

## Notes

- Uses patterns from Security Analyzer
- Specialized for file and binary scanning
- Will be used by MVP and Mobile scan services

---

## Next Steps

After this feature is complete:
- Feature 5: SCA Analyzer Service
- Feature 6: MVP Scan Service (will use this)
- Feature 8: Mobile Scan Service (will use this)
