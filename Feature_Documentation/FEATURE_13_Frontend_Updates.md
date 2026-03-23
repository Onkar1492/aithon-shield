# Feature 13: Frontend Button Logic & Progress Display

**Feature ID:** FEATURE-13  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 8-10 hours  
**Dependencies:** Features 1, 9-12 (All backend features)  
**Related Todos:** Task 11

---

## Overview

Update frontend components to display real-time scan progress, handle errors, support cancellation, and add retry functionality for failed scans.

---

## Requirements

### Button Updates

1. **Start Scan Button**
   - Show progress bar during scan
   - Display current stage message
   - Show "Cancel Scan" button

2. **Cancel Scan Button**
   - Show confirmation dialog
   - Call cancel endpoint
   - Update UI on cancellation

3. **Retry Scan Button** (NEW)
   - Show when scan fails
   - Restart scan
   - Clear previous error

### Progress Display

1. **Progress Bar**
   - Show actual percentage (0-100%)
   - Update every 2 seconds
   - Color-coded (blue=in progress, green=complete, red=failed)

2. **Stage Messages**
   - Display current stage from `scanStage` field
   - Update in real-time
   - Examples: "Cloning repository...", "Running SAST analysis..."

3. **Error Display**
   - Show error message in alert
   - Display "Retry Scan" button
   - Show error details

---

## Implementation Details

### Files to Modify

1. **`client/src/pages/MvpCodeScan.tsx`**
   - Update Start Scan button (line 609)
   - Update Cancel Scan button (line 620)
   - Add Retry Scan button
   - Update progress display

2. **`client/src/pages/WebAppScan.tsx`**
   - Same updates as MVP scan

3. **`client/src/pages/MobileAppScan.tsx`**
   - Same updates as MVP scan

4. **`client/src/components/NewAppWorkflowDialog.tsx`**
   - Update polling to include progress (line 146)
   - Display progress bar
   - Display stage messages

5. **`client/src/pages/ScanDetails.tsx`**
   - Update progress display
   - Add error display
   - Add retry button

### Progress Polling Update

```typescript
// Update polling to include progress
const pollInterval = setInterval(async () => {
  const response = await apiRequest("GET", `/api/${scanType}-scans/${scanId}`);
  const scanData = await response.json();
  
  // Update progress bar
  if (scanData.scanProgress !== undefined) {
    setScanProgress(scanData.scanProgress);
    setScanStage(scanData.scanStage || '');
  }
  
  if (scanData.scanStatus === "completed" || scanData.scanStatus === "failed") {
    clearInterval(pollInterval);
    // Handle completion/error
  }
}, 2000);
```

### Progress Display Component

```typescript
{scan.scanStatus === "scanning" && (
  <div className="space-y-2">
    <Progress value={scan.scanProgress || 0} className="w-full" />
    <p className="text-sm text-muted-foreground">
      {scan.scanStage || 'Preparing scan...'} ({scan.scanProgress || 0}%)
    </p>
  </div>
)}
```

### Error Display Component

```typescript
{scan.scanStatus === "failed" && scan.scanError && (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Scan Failed</AlertTitle>
    <AlertDescription>{scan.scanError}</AlertDescription>
    <Button onClick={() => startScanMutation.mutate(scan.id)}>
      Retry Scan
    </Button>
  </Alert>
)}
```

---

## Testing

### Test Cases

1. **Progress Display**
   - Test progress bar updates
   - Test stage messages display
   - Test percentage accuracy

2. **Button Functionality**
   - Test Start Scan button
   - Test Cancel Scan button
   - Test Retry Scan button

3. **Error Handling**
   - Test error display
   - Test retry functionality
   - Test error messages

---

## Acceptance Criteria

- [ ] Progress bar displays correctly
- [ ] Stage messages update in real-time
- [ ] Cancel button works
- [ ] Retry button works
- [ ] Error display functional
- [ ] All scan types updated
- [ ] UI/UX polished
- [ ] Unit tests pass
- [ ] Integration tests pass

---

## Notes

- Uses Features 1, 9-12 (all backend features)
- Enhances user experience significantly
- Provides real-time feedback
- Makes scans feel more responsive

---

## Next Steps

After this feature is complete:
- All features complete!
- Final testing and deployment
- User acceptance testing
