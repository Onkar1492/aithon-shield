# P6-I1 — Mobile runtime monitoring (simulated timeline)

## What it does

After a **completed** mobile scan, the server records **simulated runtime events** (network/storage/permission-style messages) for that scan. The **Scan details** page shows a **Mobile runtime monitoring** card with a timeline.

## UI

- Navigate to **Scan details** for a mobile scan: `/scan-details/mobile/:id` (or from All Scans → open details).
- When status is **completed**, the **Mobile runtime monitoring (P6-I1)** card lists events.

## API

- `GET /api/mobile-scans/:id/runtime-events`

## Notes

- Events are **simulated** for traceability in this build; integrate with a real on-device agent in a future iteration.
