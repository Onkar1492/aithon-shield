# Feature 11: Mobile Scan Endpoint Updates

**Feature ID:** FEATURE-11  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Dependencies:** Features 1, 8 (Database Schema, Mobile Scan Service)  
**Related Todos:** Task 7

---

## Overview

Update the Mobile scan endpoint (`POST /api/mobile-scans/:id/scan`) to use the real Mobile Scan Service instead of mock findings, with progress tracking and error handling.

---

## Requirements

### Endpoint Updates

1. **Replace Mock Logic**
   - Remove `setTimeout` mock generation
   - Call `mobileScanService.scanMobileApp()`
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

---

## Implementation Details

### Files to Modify

1. **`server/routes.ts`**
   - Update `POST /api/mobile-scans/:id/scan` endpoint
   - Import Mobile scan service
   - Replace mock logic

### Implementation Pattern

Similar to Features 9-10, but using:
- `mobileScanService.scanMobileApp()`
- Mobile-specific progress stages: "Downloading app...", "Extracting archive...", "Parsing manifest...", "Analyzing binary...", "Scanning for secrets..."
- Mobile-specific error handling (invalid file format, extraction failures)

---

## Testing

### Test Cases

1. **Scan Initiation**
   - Test scan starts correctly
   - Test progress updates
   - Test download progress

2. **Binary Analysis**
   - Test APK analysis
   - Test IPA analysis
   - Test manifest parsing

3. **Error Handling**
   - Test invalid file format
   - Test download failures
   - Test extraction errors

---

## Acceptance Criteria

- [ ] Mock logic removed
- [ ] Real scan service called
- [ ] Progress tracking works
- [ ] Error handling functional
- [ ] Findings created correctly
- [ ] Both iOS and Android work
- [ ] Unit tests pass

---

## Notes

- Uses Feature 8 (Mobile Scan Service)
- Uses Feature 1 (Database Schema) for progress fields
- Mobile-specific progress stages
- Handles both APK and IPA formats

---

## Next Steps

After this feature is complete:
- Feature 12: Error Handling & Cancellation
- Feature 13: Frontend Updates (will display progress)
