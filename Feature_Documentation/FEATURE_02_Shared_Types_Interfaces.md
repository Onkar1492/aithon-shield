# Feature 2: Shared Types & Interfaces

**Feature ID:** FEATURE-02  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 1-2 hours  
**Dependencies:** Feature 1 (Database Schema Updates)  
**Related Todos:** Task 1 (partially)

---

## Overview

Create shared TypeScript types and interfaces for vulnerability detection, scan results, and progress tracking that will be used across all scan services.

---

## Requirements

### Types to Create

1. **Vulnerability Interface**
   - Standard structure for detected vulnerabilities
   - Used by all scan services

2. **ScanResult Interface**
   - Standard structure for scan results
   - Includes vulnerabilities array and metadata

3. **ProgressCallback Type**
   - Function type for progress updates
   - Used by all scan services

4. **ScanConfig Interfaces**
   - MVP, Web, and Mobile scan configuration types

---

## Implementation Details

### Files to Create

1. **`server/services/types.ts`**
   - Central location for all shared types
   - Exported for use by all services

### Type Definitions

```typescript
// Vulnerability structure
export interface Vulnerability {
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  cwe: string;
  location: string; // File path and line number
  remediation: string;
  aiSuggestion: string;
  riskScore: number; // 0-100
  exploitabilityScore?: number; // 0-100
  impactScore?: number; // 0-100
}

// Scan result structure
export interface ScanResult {
  vulnerabilities: Vulnerability[];
  scanId: string;
  scanType: 'mvp' | 'web' | 'mobile';
  completedAt: Date;
  duration?: number; // milliseconds
}

// Progress callback type
export type ProgressCallback = (progress: number, stage: string) => Promise<void> | void;

// Scan configuration types
export interface MvpScanConfig {
  language: string;
  framework?: string;
  environment?: string;
  userId: string;
  scanId: string;
}

export interface WebScanConfig {
  authenticationType?: string;
  username?: string;
  password?: string;
  userId: string;
  scanId: string;
}

export interface MobileScanConfig {
  packageName?: string;
  version?: string;
  userId: string;
  scanId: string;
}
```

---

## Testing

### Test Cases

1. **Type Validation**
   - Verify all types compile correctly
   - Verify interfaces match expected structure
   - Verify type exports work

2. **Usage Testing**
   - Verify types can be imported by services
   - Verify type inference works correctly
   - Verify no type errors

---

## Acceptance Criteria

- [ ] All shared types defined in `server/services/types.ts`
- [ ] Types are properly exported
- [ ] Types compile without errors
- [ ] Types match expected structures
- [ ] Types can be imported by other services

---

## Notes

- Types will be used by Features 3-8 (scan services)
- Types should match database schema where applicable
- Progress callback allows async operations

---

## Next Steps

After this feature is complete:
- Feature 3: Security Analyzer Service (will use Vulnerability type)
- Feature 6-8: Scan Services (will use all types)
