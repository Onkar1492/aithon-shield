# General Settings — Organization name & contact email (deferred)

## Why this was removed from MVP1

The **Organization Name** and **Contact Email** fields on Settings were **non-functional placeholders** (`defaultValue` only, no save API). They confused testing and implied CRM/billing behavior that does not exist yet.

## Archived UI (React) — for future wiring

Use when implementing **Stripe Customer** display name, **team/org** branding, **billing contact**, or **Resend** operational email:

```tsx
<Card className="p-6 shadow-sm">
  <h2 className="text-xl font-semibold mb-4">General Settings</h2>
  <div className="space-y-6">
    <div className="space-y-2">
      <Label htmlFor="org-name">Organization Name</Label>
      <Input id="org-name" data-testid="input-org-name" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="contact-email">Contact Email</Label>
      <Input id="contact-email" type="email" data-testid="input-contact-email" />
    </div>
  </div>
</Card>
```

## Suggested backend mapping (MVP2+)

| Field | Store | Use |
|-------|--------|-----|
| Organization name | `organizations.name` (or Stripe `name` on Customer) | Invoices, invites, CRM |
| Contact email | New column or Stripe `email` / metadata | Receipts, security notices separate from login email |

## Status

Removed from consumer MVP1 Settings (see main app `Settings.tsx`). Restore when org profile API + Stripe alignment are implemented.
