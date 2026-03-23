# Feature 9: MVP Scan Endpoint Updates

**Feature ID:** FEATURE-09  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Dependencies:** Features 1, 6 (Database Schema, MVP Scan Service)  
**Related Todos:** Task 5

---

## Overview

Update the MVP scan endpoint (`POST /api/mvp-scans/:id/scan`) to use the real MVP Scan Service instead of mock findings, with progress tracking and error handling.

---

## Requirements

### Endpoint Updates

1. **Replace Mock Logic**
   - Remove `setTimeout` mock generation
   - Call `mvpScanService.scanMvpCode()`
   - Handle real scan results

2. **Add Progress Tracking**
   - Update `scanProgress` field during scan
   - Update `scanStage` field with current stage
   - Use progress callback

3. **Add Error Handling**
   - Catch scan errors
   - Update `scanError` field
   - Set status to 'failed'
   - Send error notification

4. **Add Cancellation Support**
   - Check `cancellationRequested` flag
   - Stop scan gracefully
   - Clean up resources

---

## Implementation Details

### Files to Modify

1. **`server/routes.ts`**
   - Update `POST /api/mvp-scans/:id/scan` endpoint (lines 1557-1714)
   - Import MVP scan service
   - Replace mock logic

### Current Implementation

```typescript
// Current: Lines 1557-1714
app.post("/api/mvp-scans/:id/scan", requireAuth, async (req: any, res) => {
  // Uses setTimeout with mock findings
  setTimeout(async () => {
    // Generate random mock findings
  }, 2500);
});
```

### New Implementation

```typescript
import { mvpScanService } from './services/mvpScanService';

app.post("/api/mvp-scans/:id/scan", requireAuth, async (req: any, res) => {
  try {
    const scan = await storage.getMvpCodeScan(req.params.id, req.user.id);
    if (!scan) {
      return res.status(404).json({ message: "Scan not found" });
    }

    await storage.updateMvpCodeScan(req.params.id, req.user.id, { 
      scanStatus: 'scanning',
      scanProgress: 0,
      scanStage: 'Initializing scan...',
      cancellationRequested: false,
    });

    await notifyScanStart(storage, scan.userId, scan.id, 'mvp', scan.projectName || 'MVP Code Scan');

    // Progress callback
    const progressCallback = async (progress: number, stage: string) => {
      await storage.updateMvpCodeScan(req.params.id, req.user.id, {
        scanProgress: progress,
        scanStage: stage,
      });
    };

    // Start real scan in background
    mvpScanService.scanMvpCode(scan.repositoryUrl, {
      language: scan.language || 'typescript',
      framework: scan.framework,
      environment: scan.environment,
      userId: req.user.id,
      scanId: scan.id,
    }, progressCallback).then(async (result) => {
      // Create findings from scan result
      for (const vulnerability of result.vulnerabilities) {
        await storage.createFinding({
          userId: scan.userId,
          title: vulnerability.title,
          description: vulnerability.description,
          severity: vulnerability.severity,
          category: vulnerability.category,
          asset: "Source Code",
          cwe: vulnerability.cwe,
          detected: new Date().toISOString(),
          status: "open",
          location: vulnerability.location,
          remediation: vulnerability.remediation,
          aiSuggestion: vulnerability.aiSuggestion,
          riskScore: vulnerability.riskScore,
          source: "mvp-scan",
          mvpScanId: scan.id,
          scanId: scan.id,
          scanType: "mvp",
        });
      }

      await storage.updateMvpCodeScan(req.params.id, req.user.id, {
        scanStatus: 'completed',
        scanProgress: 100,
        scanStage: 'completed',
        findingsCount: result.vulnerabilities.length,
        criticalCount: result.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        highCount: result.vulnerabilities.filter(v => v.severity === 'HIGH').length,
        mediumCount: result.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        lowCount: result.vulnerabilities.filter(v => v.severity === 'LOW').length,
        scannedAt: new Date(),
      });

      await notifyScanComplete(storage, scan.userId, scan.id, 'mvp', 'MVP Code Scan', result.vulnerabilities.length);
    }).catch(async (error) => {
      console.error('MVP scan error:', error);
      await storage.updateMvpCodeScan(req.params.id, req.user.id, {
        scanStatus: 'failed',
        scanError: error.message || 'Scan failed',
        scanProgress: null,
        scanStage: null,
      });
      await notifyScanError(storage, scan.userId, scan.id, 'mvp', error.message);
    });

    res.json({ message: "Scan started" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

---

## Testing

### Test Cases

1. **Scan Initiation**
   - Test scan starts correctly
   - Test progress updates
   - Test status changes

2. **Progress Tracking**
   - Test progress callback works
   - Test stage updates
   - Test progress percentage

3. **Error Handling**
   - Test repository access errors
   - Test network errors
   - Test error messages

4. **Findings Creation**
   - Test findings are created
   - Test severity counts
   - Test finding details

---

## Acceptance Criteria

- [ ] Mock logic removed
- [ ] Real scan service called
- [ ] Progress tracking works
- [ ] Error handling functional
- [ ] Findings created correctly
- [ ] Status updates accurate
- [ ] Notifications sent
- [ ] Unit tests pass
- [ ] Integration tests pass

---

## Notes

- Uses Feature 6 (MVP Scan Service)
- Uses Feature 1 (Database Schema) for progress fields
- Background processing (non-blocking)
- Error notifications to users

---

## Next Steps

After this feature is complete:
- Feature 10: Web Endpoint Updates
- Feature 11: Mobile Endpoint Updates
- Feature 13: Frontend Updates (will display progress)
