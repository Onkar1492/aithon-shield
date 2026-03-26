# Feature: `P4-D2` — Structured webhooks + SIEM (CEF / syslog)

| Field | Value |
|-------|--------|
| **Feature ID** | `P4-D2` |
| **Phase** | Phase 4 — Integrations |
| **Category** | **Both** |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

Users can now configure **webhook endpoints** in **Settings → Webhooks & SIEM** to receive real-time security events via HTTP POST. Three payload formats are supported:

- **JSON** — structured event envelope with full data
- **CEF** (Common Event Format) — ArcSight / Splunk / QRadar compatible
- **Syslog** (RFC 5424) — delivered over HTTPS POST

Each endpoint supports:
- Optional **HMAC-SHA256 signing** (`X-AithonShield-Signature-256` header)
- **Event filtering** (comma-separated list, e.g. `scan.completed,finding.created`)
- **Enable / disable** toggle
- **Test ping** button to verify connectivity
- **Last delivery status** display

Events dispatched:
| Event | Trigger |
|-------|---------|
| `scan.completed` | Any scan finishes (MVP, mobile, web, pipeline, container, network, linter) |
| `finding.created` | New finding inserted |
| `finding.resolved` | Finding status transitions to resolved |
| `risk.accepted` | Risk exception created |
| `risk.revoked` | Risk exception revoked |
| `sla.breached` | (wired for future SLA engine integration) |
| `test.ping` | Manual ping from Settings |

---

## Technical summary

- **Code paths / files:**
  - `shared/schema.ts` — `webhookEndpoints` + `webhookDeliveries` tables
  - `server/storage.ts` — CRUD + event-matching + delivery log methods
  - `server/webhookDispatchService.ts` — formatters (JSON, CEF, syslog), HMAC signing, retry (3 attempts with backoff), fire-and-forget dispatch
  - `server/webhookRoutes.ts` — REST API (GET/POST/PATCH/DELETE endpoints, POST test, GET event-types)
  - `server/routes.ts` — early registration of `registerWebhookRoutes`
  - `server/pushNotificationService.ts` — `scan.completed` dispatch added to `notifyScanComplete`
  - `server/storage.ts` — `finding.created` in `createFinding`, `finding.resolved` in `updateFinding`
  - `server/riskExceptionRoutes.ts` — `risk.accepted` and `risk.revoked` dispatches
  - `client/src/pages/Settings.tsx` — Webhooks & SIEM card with list, add/edit dialog, ping, delete
  - `public/openapi.json` — new paths documented
  - `cli/verifyWebhookRoute.ts` — automated smoke test
  - `package.json` — `verify:webhook-route` script

- **Schema / migrations:** `webhook_endpoints`, `webhook_deliveries` tables (db:push applied)
- **Environment variables:** None new (uses existing `ENCRYPTION_KEY` for secret encryption)
- **API routes:**
  - `GET /api/webhook-endpoints` — list (session)
  - `POST /api/webhook-endpoints` — create (session)
  - `PATCH /api/webhook-endpoints/:id` — update (session)
  - `DELETE /api/webhook-endpoints/:id` — delete (session)
  - `POST /api/webhook-endpoints/:id/test` — test ping (session)
  - `GET /api/webhook-event-types` — list known event types (session)

---

## Category breakdown

- **Category 1 (UI):** Settings → Webhooks & SIEM card: list endpoints, add/edit dialog (name, URL, format selector, secret, event filter, enabled toggle), ping button, delete button, last delivery status display.
- **Category 2 (Backend):** Schema tables, storage CRUD, webhook dispatch service with JSON/CEF/syslog formatters, HMAC-SHA256 signing, retry logic (3 attempts), fire-and-forget event emission from scan completion, finding creation, finding resolution, risk acceptance/revocation. Audit log entries for endpoint CRUD.

---

## Manual testing steps

1. Go to **Settings** → scroll to **Webhooks & SIEM** section.
2. Click **Add endpoint**.
3. Fill in: Name = "Test", URL = `https://httpbin.org/post`, Format = JSON, leave secret empty, leave event filter empty (all events), Enabled = on.
4. Click **Create** → endpoint appears in the list with "Active" badge.
5. Click **Ping** on the endpoint → toast shows "Ping succeeded" with "200 OK".
6. Click the **pencil** icon → edit dialog opens pre-filled → change format to CEF → click **Update**.
7. Click **Ping** again → still succeeds (CEF format sent to httpbin).
8. Change format to **Syslog** → Update → Ping → succeeds.
9. Click the **trash** icon → endpoint removed from list.
10. Create another endpoint with event filter `scan.completed` → run a scan → after scan completes, the endpoint's "Last delivery" should update (visible after refreshing Settings).

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npx tsc --noEmit` | **pass** |
| DB push | `npm run db:push` | **pass** — webhook_endpoints + webhook_deliveries created |
| Verify script | `npm run verify:webhook-route` | **pass** — route registered, auth enforced (401), dev server route OK |
| curl: unauth GET | `curl /api/webhook-endpoints` | **pass** — 401 Unauthorized |
| curl: create JSON endpoint | `POST /api/webhook-endpoints` | **pass** — 201, returns endpoint with hasSecret=false |
| curl: list endpoints | `GET /api/webhook-endpoints` | **pass** — returns array with 1 endpoint |
| curl: test-fire JSON | `POST /api/webhook-endpoints/:id/test` | **pass** — `{ ok: true, status: "200 OK" }` |
| curl: create CEF endpoint + ping | POST + test | **pass** — 200 OK |
| curl: create syslog endpoint + ping | POST + test | **pass** — 200 OK |
| curl: event types | `GET /api/webhook-event-types` | **pass** — 7 event types returned |
| curl: delete endpoints | `DELETE /api/webhook-endpoints/:id` | **pass** — `{ deleted: true }` |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above
- [ ] Behavior matches the user-facing summary
- [ ] **Approved to proceed** — next feature: `P4-F3`

**Verified by:** _name / date_
**Comments:**

---

## Rollback / risks

- Drop tables `webhook_deliveries` then `webhook_endpoints` to revert schema.
- Remove `dispatchWebhookEvent` calls from `pushNotificationService.ts`, `storage.ts`, `riskExceptionRoutes.ts`.
- Webhook delivery is fire-and-forget — failures never block the main request path.
- Retry logic uses exponential backoff (1s, 5s, 15s) with a 10s timeout per attempt.
