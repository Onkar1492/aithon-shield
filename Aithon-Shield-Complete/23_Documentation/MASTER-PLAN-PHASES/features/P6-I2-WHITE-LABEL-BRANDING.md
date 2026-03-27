# P6-I2 — White-label / agency branding

## What it does

Organization **owners** and **admins** can set:

- **Logo URL** (HTTPS image URL for the sidebar)
- **Product name** (replaces “Aithon Shield” in the sidebar header)
- **Shorter tagline** (“Security” instead of “Security Platform”) when **Hide Aithon wording** is enabled

Branding applies to the user’s **default organization** (from `/api/branding`).

## UI

- **Workspace** page → **Agency / white-label branding** (visible only if you can edit branding).

## API

- `GET /api/branding` — returns `organizationId`, `canEditBranding`, and branding fields.
- `PATCH /api/organizations/:id/branding` — `{ whiteLabelLogoUrl, whiteLabelProductName, hideAithonBranding }`.

## Notes

- Requires DB columns on `organizations` (see schema). Run migrations.
