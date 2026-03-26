# MVP2 — OpenAPI / API Security Scan (P5-C10)

Parked feature. Removed from the live app to keep the MVP focused on:
MVP Code, Mobile App, Web App, and Container scans.

## What this feature does

Static analysis of OpenAPI 3.x documents (JSON or YAML). No live attack traffic.
Checks: auth coverage, cleartext server URLs, operation surface area, spec hygiene.

## Contents of this archive

| File | Description |
|------|-------------|
| `server/openApiApiSecurityService.ts` | Analyzer + URL fetcher (the scan engine) |
| `server/routes-snippet.ts` | `runApiSecurityScanJob` + 4 REST endpoints extracted from `routes.ts` |
| `server/storage-snippet.ts` | Interface + implementation CRUD methods extracted from `storage.ts` |
| `shared/schema-snippet.ts` | `apiSecurityScans` table, insert/patch schemas, types from `schema.ts` |
| `client/NewScanDialog-api-snippet.tsx` | API scan card, form, mutation, submit from `NewScanDialog.tsx` |
| `client/NewAppWorkflowDialog-api-snippet.tsx` | OpenAPI tab, state, mutation branch from `NewAppWorkflowDialog.tsx` |
| `docs/P5-C10-API-SECURITY-TESTING.md` | Feature doc with manual testing steps |

## To restore

1. Re-add the `apiSecurityScans` table and types to `shared/schema.ts`
2. Re-add the `apiSecurityScanId` column to findings (already exists in DB, just unused)
3. Re-add storage interface methods + implementations
4. Re-add routes (job + 4 endpoints) to `routes.ts`
5. Re-add the service file to `server/services/`
6. Re-add UI in `NewScanDialog`, `NewAppWorkflowDialog`, `AllScans`, `Scans`, `ScanDetails`
7. Re-add notification polling in `useScanNotifications`
8. Run `npm run check` and `npm run db:push`

## Original plan reference

LIST-2-PRODUCT-ENHANCEMENT-IMPLEMENTATION-PLAN.md, item #15:
> API Security Testing Module — Accept an OpenAPI/Swagger spec or Postman collection.
> Test each endpoint for: authentication bypass, BOLA, injection, rate limiting gaps,
> excessive data exposure. Estimated scope: Large (4–6 weeks).

Current implementation covers static contract analysis only (a subset of the full vision).
