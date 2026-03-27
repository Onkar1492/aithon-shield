# P6-D5 — False-positive suppression (feedback + fingerprints)

## What it does

Users can mark findings as **likely false positive** or **confirm true positive**. The server stores a **fingerprint** per user verdict and **enriches** listing payloads with `fpSuppression` so the UI can show a badge or hint.

This is **heuristic / feedback-based**, not a trained ML model.

## UI

- **Findings** table: row actions → **Mark likely false positive** / **Confirm true positive**.

## API

- `POST /api/findings/:id/fp-feedback` with body `{ "verdict": "likely_fp" | "true_positive" }`.
- Findings list/detail include `fpSuppression` when applicable.

## Notes

- Requires DB table `fp_feedback` (see schema migration). Run `drizzle-kit push` or your deployment migration.
