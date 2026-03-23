# Feature 12: Error Handling & Cancellation

**Feature ID:** FEATURE-12  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 4-5 hours  
**Dependencies:** Features 1, 6-8, 9-11 (All scan services and endpoints)  
**Related Todos:** Task 10, Task 9 (partially)

---

## Overview

Implement comprehensive error handling and graceful cancellation support for all scan types with user-friendly error messages and retry capabilities.

---

## Requirements

### Error Handling

1. **Error Types**
   - Repository access errors (MVP)
   - Web app unreachable errors (Web)
   - Invalid file format errors (Mobile)
   - Network timeout errors
   - Authentication errors

2. **Error Messages**
   - User-friendly messages
   - Actionable suggestions
   - Error codes for support

3. **Error Storage**
   - Store in `scanError` field
   - Log detailed errors server-side
   - Send error notifications

### Cancellation Support

1. **Cancellation Endpoint**
   - `PATCH /api/{scanType}-scans/:id/cancel`
   - Sets `cancellationRequested: true`
   - Returns immediately

2. **Service Cancellation**
   - Services check `cancellationRequested` flag
   - Stop processing gracefully
   - Clean up resources
   - Update status to 'cancelled'

---

## Implementation Details

### Files to Create

1. **`server/services/errors.ts`**
   - Error types and handlers
   - User-friendly error messages

### Files to Modify

1. **`server/routes.ts`**
   - Add cancel endpoints for all scan types
   - Enhance error handling in scan endpoints

2. **Scan Services**
   - Add cancellation checks
   - Add error handling
   - Clean up on cancellation

### Error Handler

```typescript
export class ScanError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

export function handleScanError(error: any): ScanError {
  // Map technical errors to user-friendly messages
  if (error.message.includes('401') || error.message.includes('403')) {
    return new ScanError(
      error.message,
      'ACCESS_DENIED',
      'Repository access denied. Please check your authentication token.',
      true
    );
  }
  // ... more error mappings
}
```

### Cancellation Endpoints

```typescript
app.patch("/api/mvp-scans/:id/cancel", requireAuth, async (req: any, res) => {
  await storage.updateMvpCodeScan(req.params.id, req.user.id, {
    cancellationRequested: true,
    scanStatus: 'cancelling',
  });
  res.json({ message: "Cancellation requested" });
});
```

---

## Testing

### Test Cases

1. **Error Handling**
   - Test all error types
   - Test error messages
   - Test error storage
   - Test notifications

2. **Cancellation**
   - Test cancellation endpoint
   - Test service cancellation
   - Test resource cleanup
   - Test status updates

---

## Acceptance Criteria

- [ ] All error types handled
- [ ] User-friendly error messages
- [ ] Cancellation endpoints work
- [ ] Services check cancellation flag
- [ ] Resources cleaned up
- [ ] Error notifications sent
- [ ] Unit tests pass
- [ ] Integration tests pass

---

## Notes

- Enhances Features 6-8 (scan services)
- Enhances Features 9-11 (endpoints)
- Uses Feature 1 (Database Schema) for error fields
- Provides foundation for retry functionality

---

## Next Steps

After this feature is complete:
- Feature 13: Frontend Updates (will display errors and cancellation)
