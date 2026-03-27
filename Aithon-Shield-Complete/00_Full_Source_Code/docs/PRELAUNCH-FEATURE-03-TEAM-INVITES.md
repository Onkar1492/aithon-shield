# Pre-launch Feature 3 — Team invites & workspace membership

## Plain-language summary

Workspace **owners and admins** can **invite teammates by email**. The system creates a **secure invite link** (`/invite/:token`) that expires in **seven days**. Invited users sign in (or sign up) with the **same email** as the invite, then **accept** to join the organization. Members appear under **Workspace** with their roles; managers can **remove** members (with safeguards for the last **owner**).

## Cat 1 — UI (what you see)

- **Workspace (`/workspace`)**: Pick an organization, view **team members**, and (if you are **owner** or **admin**) create **invites**, **copy invite links**, and **revoke** pending invites.
- **Invite page (`/invite/:token`)**: Shows workspace name and role; signed-out users get **Sign in** / **Create account** (with return path); signed-in users with a matching email can **Accept & join workspace**.

## Cat 2 — Backend (what runs on the server)

- **`shared/schema.ts`**: New `organization_invites` table (email, role, token, expiry, acceptance).
- **`server/rbac.ts`**: `organizationRoleCanManageTeam` (owner + admin).
- **`server/storage.ts`**: List members/invites, create/revoke invites, preview by token, accept invite (adds `organization_members` row), remove member (blocks removing the last **owner**).
- **`server/routes.ts`**:  
  `GET /api/organizations/:orgId/members` ·  
  `GET /api/organizations/:orgId/invites` ·  
  `POST /api/organizations/:orgId/invites` ·  
  `DELETE /api/organizations/:orgId/invites/:inviteId` ·  
  `GET /api/invites/:token` (public preview) ·  
  `POST /api/invites/:token/accept` (session) ·  
  `DELETE /api/organizations/:orgId/members/:userId` (manager).

## Testing performed

- `npm run check` (TypeScript) — **passed** after schema, storage, routes, and UI.

## How to validate (no terminal)

1. Sign in as a workspace **owner** (default personal workspace after onboarding).
2. Open **Workspace** (`/workspace`), select your org, enter a teammate email and role, click **Create invite**, then **Copy link**.
3. In another browser session (or private window), open the invite URL; sign in or sign up as that email **or** see the mismatch warning if you use a different account.
4. Accept the invite and confirm the user appears under **Team members** for that workspace.
5. As owner/admin, revoke a pending invite and confirm it disappears; remove a non-owner member and confirm they no longer appear in the list.

## Database note

Apply the new table with your usual Drizzle workflow (e.g. **`npm run db:push`** against `DATABASE_URL`) so `organization_invites` exists in the database.

