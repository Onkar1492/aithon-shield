# P6-C9 — Mobile real-device style DAST

## What it does

After a mobile app scan completes its static analysis, the server can run an **optional second pass** that probes a **backend API base URL** you provide (or generic checks when omitted). It is **simulated/safe** in the server environment (no physical device farm in this build), but findings are surfaced like other mobile issues and may include **`dastProof`** metadata on the finding record.

## How to enable

1. Open **Mobile App Scan** → select a scan → **Edit** (or edit from the scan list).
2. Under **Real-device DAST (P6-C9)**, turn on **Enable real-device style DAST pass**.
3. Optionally set **Backend API base URL** (e.g. `https://api.example.com`).
4. Save, then run **Scan** again.

## API / data

- Stored on the mobile scan as `workflowMetadata.realDeviceDast` (boolean) and optional `workflowMetadata.backendApiUrl` (string).
- `PATCH /api/mobile-scans/:id` **merges** `workflowMetadata` keys (same behavior as MVP scans).

## Verification

- Complete a mobile scan with the toggle on; check **Findings** for categories/titles from the DAST pass and optional proof fields on the finding detail if exposed in UI.
