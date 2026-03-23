# Feature 5: SCA Analyzer Service (Dependency Vulnerability Scanning)

**Feature ID:** FEATURE-05  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 4-5 hours  
**Dependencies:** Feature 2 (Shared Types)  
**Related Todos:** Task 2 (partially)

---

## Overview

Create a Software Composition Analysis (SCA) service that scans project dependencies for known vulnerabilities by parsing dependency files and querying vulnerability databases.

---

## Requirements

### Functions to Implement

1. **`parseDependencies(repoPath: string): Promise<DependencyManifest>`**
   - Parses dependency files (package.json, requirements.txt, etc.)
   - Returns structured dependency list

2. **`checkDependencyVulnerabilities(dependencies: Dependency[]): Promise<Vulnerability[]>`**
   - Queries NIST NVD API for CVEs
   - Checks CISA KEV database
   - Returns vulnerability findings

3. **`performSCAScan(repoPath: string, progressCallback?: ProgressCallback): Promise<Vulnerability[]>`**
   - Main SCA scan function
   - Combines parsing and vulnerability checking
   - Progress tracking support

---

## Implementation Details

### Files to Create

1. **`server/services/scaAnalyzer.ts`**
   - Main SCA analysis service
   - Exports all functions

### Supported Dependency Files

1. **Node.js**
   - `package.json` - npm/yarn dependencies
   - `package-lock.json` - locked versions
   - `yarn.lock` - yarn locked versions

2. **Python**
   - `requirements.txt` - pip dependencies
   - `Pipfile` - pipenv dependencies
   - `poetry.lock` - poetry dependencies

3. **Java**
   - `pom.xml` - Maven dependencies
   - `build.gradle` - Gradle dependencies

4. **Go**
   - `go.mod` - Go modules
   - `go.sum` - Go checksums

5. **Ruby**
   - `Gemfile` - Ruby gems
   - `Gemfile.lock` - locked versions

6. **PHP**
   - `composer.json` - Composer dependencies
   - `composer.lock` - locked versions

7. **Rust**
   - `Cargo.toml` - Cargo dependencies
   - `Cargo.lock` - locked versions

---

## Function Signatures

```typescript
export interface Dependency {
  name: string;
  version: string;
  type: 'npm' | 'pip' | 'maven' | 'gradle' | 'go' | 'gem' | 'composer' | 'cargo';
  file: string;
}

export interface DependencyManifest {
  dependencies: Dependency[];
  type: string;
}

export async function parseDependencies(
  repoPath: string
): Promise<DependencyManifest>;

export async function checkDependencyVulnerabilities(
  dependencies: Dependency[],
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;

export async function performSCAScan(
  repoPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;
```

---

## API Integration

### NIST NVD API

- Endpoint: `https://services.nvd.nist.gov/rest/json/cves/2.0`
- Query by package name and version
- Rate limiting: 5 requests per 30 seconds

### CISA KEV Database

- Endpoint: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- Check for known exploited vulnerabilities
- Cache results locally

---

## Testing

### Test Cases

1. **Dependency Parsing**
   - Test all supported file types
   - Test malformed files
   - Test missing files

2. **Vulnerability Checking**
   - Test with known vulnerable packages
   - Test API rate limiting
   - Test error handling

3. **Integration Testing**
   - Test full SCA scan
   - Test progress callbacks
   - Test large dependency lists

---

## Acceptance Criteria

- [ ] All dependency file types supported
- [ ] NIST NVD API integration works
- [ ] CISA KEV checking works
- [ ] Progress callbacks functional
- [ ] Unit tests pass
- [ ] Handles API errors gracefully

---

## Notes

- API rate limiting must be respected
- Cache vulnerability data to reduce API calls
- Will be used by MVP Scan Service

---

## Next Steps

After this feature is complete:
- Feature 6: MVP Scan Service (will use this)
- Feature 8: Dependencies installation
