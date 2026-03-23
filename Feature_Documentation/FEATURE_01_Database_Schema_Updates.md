# Feature 1: Database Schema Updates - Progress Tracking Fields

**Feature ID:** FEATURE-01  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 1-2 hours  
**Dependencies:** None  
**Related Todos:** Task 12

---

## Overview

Add progress tracking fields to scan tables (`mvpCodeScans`, `webAppScans`, `mobileAppScans`) to support real-time progress updates during long-running scans.

---

## Requirements

### New Fields to Add

For each scan table (`mvpCodeScans`, `webAppScans`, `mobileAppScans`):

1. **`scanProgress`** (integer, nullable)
   - Range: 0-100
   - Represents scan completion percentage
   - Default: `null` (not started)
   - Example: `45` means 45% complete

2. **`scanStage`** (text, nullable)
   - Current stage of the scan
   - Examples: "Cloning repository", "Running SAST analysis", "Scanning dependencies", "Crawling web application"
   - Default: `null`

3. **`scanError`** (text, nullable)
   - Error message if scan fails
   - Default: `null`
   - Example: "Repository access denied. Please check your authentication token."

4. **`cancellationRequested`** (boolean)
   - Flag to request scan cancellation
   - Default: `false`
   - Used by scan services to check if cancellation was requested

---

## Implementation Details

### Files to Modify

1. **`shared/schema.ts`**
   - Add fields to `mvpCodeScans` table definition (around line 200)
   - Add fields to `webAppScans` table definition (around line 267)
   - Add fields to `mobileAppScans` table definition (around line 140)

### Schema Changes

```typescript
// Add to each scan table:
scanProgress: integer("scan_progress"), // 0-100, nullable
scanStage: text("scan_stage"), // nullable, e.g., "Cloning repository"
scanError: text("scan_error"), // nullable, error message
cancellationRequested: boolean("cancellation_requested").notNull().default(false),
```

### Update Schemas

- Update `updateMvpCodeScanSchema` to allow updating progress fields
- Update `updateWebAppScanSchema` to allow updating progress fields
- Update `updateMobileAppScanSchema` to allow updating progress fields

---

## Database Migration

### Migration Steps

1. Create migration file using Drizzle Kit
2. Add columns with appropriate defaults
3. Run migration: `npm run db:push`

### Migration SQL (Reference)

```sql
ALTER TABLE mvp_code_scans 
  ADD COLUMN scan_progress INTEGER,
  ADD COLUMN scan_stage TEXT,
  ADD COLUMN scan_error TEXT,
  ADD COLUMN cancellation_requested BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE web_app_scans 
  ADD COLUMN scan_progress INTEGER,
  ADD COLUMN scan_stage TEXT,
  ADD COLUMN scan_error TEXT,
  ADD COLUMN cancellation_requested BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE mobile_app_scans 
  ADD COLUMN scan_progress INTEGER,
  ADD COLUMN scan_stage TEXT,
  ADD COLUMN scan_error TEXT,
  ADD COLUMN cancellation_requested BOOLEAN NOT NULL DEFAULT false;
```

---

## Testing

### Test Cases

1. **Schema Validation**
   - Verify fields are added correctly
   - Verify default values work
   - Verify nullable fields accept null

2. **Migration Testing**
   - Run migration on test database
   - Verify existing records have correct defaults
   - Verify new records can be created with progress fields

3. **Type Safety**
   - Verify TypeScript types are updated
   - Verify Zod schemas include new fields
   - Verify no type errors in codebase

---

## Acceptance Criteria

- [ ] All three scan tables have new progress tracking fields
- [ ] Migration runs successfully without errors
- [ ] Existing scans continue to work (backward compatible)
- [ ] TypeScript types are updated correctly
- [ ] Zod schemas include new fields
- [ ] No breaking changes to existing code

---

## Notes

- Fields are nullable to maintain backward compatibility
- `cancellationRequested` defaults to `false` for all existing records
- Progress fields will be updated by scan services in later features

---

## Next Steps

After this feature is complete:
- Feature 2: Shared Types & Interfaces (will use these new fields)
- Feature 9-11: Endpoint updates (will update these fields)
- Feature 13: Frontend updates (will display these fields)
