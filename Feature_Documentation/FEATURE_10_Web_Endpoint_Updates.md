# Feature 10: Web Scan Endpoint Updates

**Feature ID:** FEATURE-10  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Dependencies:** Features 1, 7 (Database Schema, Web Scan Service)  
**Related Todos:** Task 6

---

## Overview

Update the Web scan endpoint (`POST /api/web-scans/:id/scan`) to use the real Web Scan Service instead of mock findings, with progress tracking and error handling.

---

## Requirements

### Endpoint Updates

1. **Replace Mock Logic**
   - Remove `setTimeout` mock generation
   - Call `webScanService.scanWebApp()`
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
   - Update `POST /api/web-scans/:id/scan` endpoint (lines 2103-2249)
   - Import Web scan service
   - Replace mock logic

### Implementation Pattern

Similar to Feature 9 (MVP Endpoint), but using:
- `webScanService.scanWebApp()`
- Web-specific progress stages: "Crawling web application...", "Testing OWASP Top 10...", "Analyzing SSL/TLS...", "Checking security headers..."
- Web-specific error handling

---

## Testing

### Test Cases

1. **Scan Initiation**
   - Test scan starts correctly
   - Test progress updates
   - Test web crawling progress

2. **OWASP Testing**
   - Test OWASP tests run
   - Test vulnerabilities detected
   - Test progress tracking

3. **Error Handling**
   - Test unreachable apps
   - Test authentication errors
   - Test SSL errors

---

## Acceptance Criteria

- [ ] Mock logic removed
- [ ] Real scan service called
- [ ] Progress tracking works
- [ ] Error handling functional
- [ ] Findings created correctly
- [ ] OWASP tests run
- [ ] SSL/TLS analysis works
- [ ] Unit tests pass

---

## Notes

- Uses Feature 7 (Web Scan Service)
- Uses Feature 1 (Database Schema) for progress fields
- Web-specific progress stages
- Handles authentication for authenticated scans

---

## Next Steps

After this feature is complete:
- Feature 11: Mobile Endpoint Updates
- Feature 13: Frontend Updates (will display progress)
