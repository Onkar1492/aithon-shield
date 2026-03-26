# Feature: `P5-D4` — VS Code extension (findings in editor)

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-D4` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **1** (editor / IDE integration; no web UI change required) |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

Developers can install the **Aithon Shield** VS Code extension from the repo (`editors/vscode-aithon-shield`), set **`aithonShield.baseUrl`** to the app URL (default `http://127.0.0.1:5001`), and run **Aithon Shield: Set API Key** with an API key from the web app (**Settings → API Keys**).

The **Findings** view lists open findings (sorted by severity). Actions: **Refresh**, **Open Scan in Browser** (scan details page), **Mark Finding Resolved** (PATCH finding status).

---

## Technical summary

| Piece | Location |
|-------|----------|
| Extension | `00_Full_Source_Code/editors/vscode-aithon-shield/` |
| API | `GET /api/findings`, `PATCH /api/findings/:id` with `{ "status": "resolved" }` |
| Auth | `Authorization: Bearer <api_key>` (same as server `authMiddleware`) |
| Secrets | VS Code Secret Storage key `aithonShield.apiKey` |

**Build:** `npm install` and `npm run compile` in `editors/vscode-aithon-shield`. **Debug:** open that folder in VS Code and press F5 (Extension Development Host). **Package:** `npm run package` produces a `.vsix` when `@vscode/vsce` is available (see `package.json`).

---

## Manual testing

1. Start the Aithon Shield app (default port **5001**).
2. Create an API key in the web UI; ensure at least one non-resolved finding exists.
3. In VS Code: set base URL if needed, **Set API Key**, then **Refresh Findings**.
4. Confirm list, **Open Scan in Browser**, and **Mark Resolved** (finding disappears after refresh).

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| Extension compile | `npm run compile` in `editors/vscode-aithon-shield` | **pass** |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above
- [ ] Behavior matches the user-facing summary
- [ ] **Approved to proceed** — next feature in plan

**Verified by:** _name / date_
**Comments:**

---

## Rollback / limits

- Extension does not use session cookies; API key is required.
- Findings are filtered client-side to exclude statuses treated as resolved (`resolved` / `fixed`).
