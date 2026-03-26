# P5-H3 — Secrets Rotation Workflow

**Category:** Both (List 1 + List 2)  
**Status:** implemented — pending user verification

---

## What it does (plain English)

When Aithon Shield scans your code, it can find **hardcoded secrets** — things like API keys, database passwords, AWS credentials, or tokens that are written directly into your source code files instead of being stored safely.

The **Secrets Rotation Workflow** gives you a step-by-step checklist to **safely replace (rotate) those secrets**. Think of it like a to-do list that walks you through:

1. **Remove** the hardcoded secret from your code
2. **Generate** a brand new secret/credential
3. **Store** it in a secrets manager (like AWS Secrets Manager, HashiCorp Vault, or even a `.env` file)
4. **Update** your app's configuration to read from the manager instead of hardcoded values
5. **Revoke** the old secret so nobody can use it anymore
6. **Verify** your app still works with the new secret

---

## User-facing summary

- New **"Secrets Rotation"** page in the sidebar (key icon)
- **Summary cards** at the top: Total tickets, Need Rotation, Rotated/Verified, Dismissed
- **"Import from Scans"** button: automatically creates rotation tickets from any hardcoded-secret findings in your scans
- **"Add Ticket"** button: manually create a rotation ticket for any secret
- **Expandable rows**: click a ticket to see the 6-step checklist, change status, pick a secrets manager, and see guidance
- **Auto-status**: checking all 6 steps automatically marks the ticket as "Verified"
- Each action is logged in the **Audit Log** and triggers **webhooks** if configured

---

## Technical summary

### Database

New table `secrets_rotation_tickets` with columns:
- `id`, `user_id`, `finding_id` (optional link to the scan finding)
- `secret_name`, `secret_type`, `location`, `severity`, `status`
- Six boolean step columns (`step_removed_from_code`, `step_new_secret_generated`, `step_stored_in_manager`, `step_app_config_updated`, `step_old_secret_revoked`, `step_verified`)
- `notes`, `secrets_manager`, `rotated_at`, `verified_at`, timestamps
- Indexes on `user_id`, `finding_id`, and `(user_id, status)`

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/secrets-rotation` | List all tickets for the logged-in user |
| GET | `/api/secrets-rotation/:id` | Get a single ticket |
| POST | `/api/secrets-rotation` | Create a new rotation ticket |
| PATCH | `/api/secrets-rotation/:id` | Update steps, status, notes, manager |
| DELETE | `/api/secrets-rotation/:id` | Delete a ticket |
| POST | `/api/secrets-rotation/auto-create` | Auto-import from scan findings (CWE 798 / hardcoded secrets) |

### Files changed/created

| File | Change |
|------|--------|
| `shared/schema.ts` | Added `secretsRotationTickets` table + types |
| `server/storage.ts` | Added `IStorage` methods + `DbStorage` implementation |
| `server/secretsRotationRoutes.ts` | **New** — API route handlers with Zod validation, audit logging, webhooks |
| `server/routes.ts` | Registered `registerSecretsRotationRoutes` early |
| `client/src/pages/SecretsRotation.tsx` | **New** — Full UI page with CRUD, checklist, summary cards |
| `client/src/App.tsx` | Added route `/secrets-rotation` |
| `client/src/components/AppSidebar.tsx` | Added "Secrets Rotation" nav item with `KeyRound` icon |

### Auto-import logic

The `autoCreateSecretsRotationTickets` method:
1. Fetches all non-archived findings for the user
2. Filters for CWE 798 ("Use of Hard-coded Credentials") or category "Code Security" with "hardcoded" in the title
3. Skips findings that already have a rotation ticket
4. Creates a new ticket for each untracked secret finding

---

## Manual testing steps

### How to get to the page
1. Open the app in your browser (the dev server should already be running)
2. Look at the left sidebar — scroll down past "Risk exceptions"
3. Click **"Secrets Rotation"** (it has a key icon)

### How to create a ticket manually
1. On the Secrets Rotation page, click the blue **"+ Add Ticket"** button (top right)
2. A form appears with fields:
   - **Secret Name**: type something like "AWS Key in config.ts"
   - **Secret Type**: pick from the dropdown (API Key, AWS Credential, etc.)
   - **Location**: optionally type where it was found, like "src/config.ts:42"
   - **Severity**: pick Critical, High, Medium, or Low
   - **Notes**: optionally add any context
3. Click **"Create Ticket"**
4. The ticket appears in the table below

### How to use the rotation checklist
1. Click on a ticket row to expand it
2. You'll see 6 checkboxes (the rotation steps)
3. Check each box as you complete that step
4. The progress bar updates (e.g., 3/6)
5. When all 6 are checked, the status automatically changes to "Verified"

### How to import from scans
1. Click **"Import from Scans"** button
2. It scans your existing findings for hardcoded secrets
3. Creates tickets for any it finds (skips duplicates)
4. A toast notification tells you how many were created

### How to change status or secrets manager
1. Expand a ticket (click the row)
2. Use the **Status** dropdown to change to: Open, In Progress, Rotated, Verified, or Dismissed
3. Use the **Secrets Manager** dropdown to record which manager you're using (Vault, AWS SM, .env, etc.)

### How to delete a ticket
1. Click the red trash icon on the right side of any ticket row
