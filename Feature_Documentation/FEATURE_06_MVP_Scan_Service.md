# Feature 6: MVP Code Scan Service

**Feature ID:** FEATURE-06  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 8-10 hours  
**Dependencies:** Features 2-5 (Types, Security Analyzer, Secrets Detector, SCA Analyzer)  
**Related Todos:** Task 2

---

## Overview

Create comprehensive MVP code repository scanning service that clones repositories, performs SAST analysis, dependency scanning (SCA), and secrets detection with real-time progress tracking.

---

## Requirements

### Functions to Implement

1. **`cloneRepository(repositoryUrl: string, accessToken?: string, progressCallback?: ProgressCallback): Promise<string>`**
   - Clones Git repository to temporary directory
   - Supports GitHub, GitLab, Bitbucket
   - Progress tracking for clone operation

2. **`performSASTScan(repoPath: string, language: string, progressCallback?: ProgressCallback): Promise<Vulnerability[]>`**
   - Scans all source files for vulnerabilities
   - Uses Security Analyzer service
   - Progress tracking per file

3. **`scanMvpCode(repositoryUrl: string, config: MvpScanConfig, progressCallback?: ProgressCallback): Promise<ScanResult>`**
   - Main scan function
   - Orchestrates cloning, SAST, SCA, secrets detection
   - Returns complete scan results

---

## Implementation Details

### Files to Create

1. **`server/services/mvpScanService.ts`**
   - Main MVP scan service
   - Exports scan function

### Dependencies Required

- `simple-git` - Git repository operations
- `fs-extra` - File system operations
- `glob` - File pattern matching

### Scan Flow

1. **Clone Repository** (0-20%)
   - Clone to temp directory
   - Validate repository access
   - Report progress

2. **SAST Analysis** (20-60%)
   - Find all source files
   - Scan each file with Security Analyzer
   - Report progress per file

3. **SCA Analysis** (60-80%)
   - Parse dependency files
   - Check vulnerabilities
   - Report progress

4. **Secrets Detection** (80-95%)
   - Scan all files for secrets
   - Report progress

5. **Finalize** (95-100%)
   - Clean up temp directory
   - Aggregate results
   - Return ScanResult

---

## Function Signatures

```typescript
export async function cloneRepository(
  repositoryUrl: string,
  accessToken?: string,
  progressCallback?: ProgressCallback
): Promise<string>;

export async function performSASTScan(
  repoPath: string,
  language: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;

export async function scanMvpCode(
  repositoryUrl: string,
  config: MvpScanConfig,
  progressCallback?: ProgressCallback
): Promise<ScanResult>;
```

---

## Error Handling

### Repository Access Errors

- 401/403: "Repository access denied. Please check your authentication token."
- 404: "Repository not found. Please verify the repository URL."
- Timeout: "Repository cloning timed out. Please try again."

### File System Errors

- Disk space: Check before cloning
- Permissions: Handle gracefully
- Invalid paths: Validate before processing

---

## Testing

### Test Cases

1. **Repository Cloning**
   - Test public repositories
   - Test private repositories (with token)
   - Test invalid URLs
   - Test access denied

2. **SAST Scanning**
   - Test with vulnerable code
   - Test with safe code
   - Test multiple languages
   - Test progress callbacks

3. **Full Scan**
   - Test end-to-end scan
   - Test progress tracking
   - Test error handling
   - Test cancellation

---

## Acceptance Criteria

- [ ] Repository cloning works
- [ ] SAST analysis detects vulnerabilities
- [ ] SCA analysis works
- [ ] Secrets detection works
- [ ] Progress tracking accurate
- [ ] Error handling comprehensive
- [ ] Unit tests pass
- [ ] Integration tests pass

---

## Notes

- Uses Features 3-5 (Security Analyzer, Secrets Detector, SCA Analyzer)
- Progress callbacks update database via Feature 1 fields
- Will be integrated in Feature 9 (Endpoint Updates)

---

## Next Steps

After this feature is complete:
- Feature 9: MVP Endpoint Updates (will use this service)
- Feature 12: Error Handling (will enhance this)
