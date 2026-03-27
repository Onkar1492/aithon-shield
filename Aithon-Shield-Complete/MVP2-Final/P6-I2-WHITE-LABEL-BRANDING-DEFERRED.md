# P6-I2: White-Label / Agency Branding — Deferred to MVP2

> **Status**: Removed from MVP1 codebase, preserved here for MVP2 implementation.
> **Date**: 2026-03-26

---

## Overview

Allows organization owners/admins to rebrand the Aithon Shield sidebar with their own logo, product name, and tagline. This enables agencies to present a custom-branded security platform to their end clients.

---

## Architecture

### Data Model

Three columns on the `organizations` table:

| Column                    | Type              | Default | Description                                       |
|---------------------------|-------------------|---------|---------------------------------------------------|
| `white_label_logo_url`    | `text` (nullable) | `null`  | HTTPS URL to a custom logo image                  |
| `white_label_product_name`| `text` (nullable) | `null`  | Custom product name (replaces "Aithon Shield")    |
| `hide_aithon_branding`    | `boolean`         | `false` | When true, tagline shows "Security" instead of "Security Platform" |

### SQL Migration

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS white_label_logo_url text,
  ADD COLUMN IF NOT EXISTS white_label_product_name text,
  ADD COLUMN IF NOT EXISTS hide_aithon_branding boolean NOT NULL DEFAULT false;
```

### API Endpoints

#### GET /api/branding

Returns the current user's default organization branding. Session auth required.

**Response:**
```json
{
  "organizationId": "uuid-or-null",
  "canEditBranding": true,
  "whiteLabelLogoUrl": "https://example.com/logo.png",
  "whiteLabelProductName": "Milan Security Suite",
  "hideAithonBranding": true
}
```

**Logic:**
1. Look up user's `defaultOrganizationId`
2. Look up organization by ID
3. Check user's role via `getOrganizationMemberRole` — only `owner` or `admin` gets `canEditBranding: true`
4. Return branding fields from the org row

#### PATCH /api/organizations/:id/branding

Updates branding for an organization. Session auth + owner/admin role required.

**Request body** (all fields optional):
```json
{
  "whiteLabelLogoUrl": "https://example.com/logo.png",
  "whiteLabelProductName": "My Security Platform",
  "hideAithonBranding": true
}
```

**Validation** (Zod):
- `whiteLabelLogoUrl`: `z.string().url().nullable().optional()`
- `whiteLabelProductName`: `z.string().min(1).max(120).nullable().optional()`
- `hideAithonBranding`: `z.boolean().optional()`

Logs an audit event with action `org.branding_update`.

---

## Preserved Source Code

### Schema (shared/schema.ts)

Add these columns to the `organizations` table definition:

```typescript
/** P6-I2 — optional agency / white-label branding */
whiteLabelLogoUrl: text("white_label_logo_url"),
whiteLabelProductName: text("white_label_product_name"),
hideAithonBranding: boolean("hide_aithon_branding").notNull().default(false),
```

### Storage Interface (server/storage.ts)

Add to `IStorage` interface:

```typescript
getOrganizationById(id: string): Promise<Organization | undefined>;
updateOrganizationBranding(
  id: string,
  updates: Partial<{
    whiteLabelLogoUrl: string | null;
    whiteLabelProductName: string | null;
    hideAithonBranding: boolean;
  }>,
): Promise<Organization | undefined>;
```

Implementation in `DbStorage`:

```typescript
async getOrganizationById(id: string): Promise<Organization | undefined> {
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0];
}

async updateOrganizationBranding(
  id: string,
  updates: Partial<{
    whiteLabelLogoUrl: string | null;
    whiteLabelProductName: string | null;
    hideAithonBranding: boolean;
  }>,
): Promise<Organization | undefined> {
  const rows = await db
    .update(organizations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();
  return rows[0];
}
```

### API Routes (server/routes.ts)

```typescript
app.get("/api/branding", requireSessionAuth, async (req: any, res) => {
  const user = await storage.getUser(req.user.id);
  const orgId = user?.defaultOrganizationId;
  if (!orgId) {
    return res.json({
      organizationId: null,
      canEditBranding: false,
      whiteLabelLogoUrl: null,
      whiteLabelProductName: null,
      hideAithonBranding: false,
    });
  }
  const org = await storage.getOrganizationById(orgId);
  if (!org) {
    return res.json({
      organizationId: null,
      canEditBranding: false,
      whiteLabelLogoUrl: null,
      whiteLabelProductName: null,
      hideAithonBranding: false,
    });
  }
  const role = await storage.getOrganizationMemberRole(orgId, req.user.id);
  const canEditBranding = Boolean(role && ["owner", "admin"].includes(role));
  res.json({
    organizationId: orgId,
    canEditBranding,
    whiteLabelLogoUrl: org.whiteLabelLogoUrl ?? null,
    whiteLabelProductName: org.whiteLabelProductName ?? null,
    hideAithonBranding: Boolean(org.hideAithonBranding),
  });
});

app.patch("/api/organizations/:id/branding", requireSessionAuth, async (req: any, res) => {
  try {
    const orgId = req.params.id;
    const role = await storage.getOrganizationMemberRole(orgId, req.user.id);
    if (!role || !["owner", "admin"].includes(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const schema = z.object({
      whiteLabelLogoUrl: z.string().url().nullable().optional(),
      whiteLabelProductName: z.string().min(1).max(120).nullable().optional(),
      hideAithonBranding: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const updated = await storage.updateOrganizationBranding(orgId, body);
    void logAuditEvent({
      userId: req.user.id,
      action: "org.branding_update",
      resourceType: "organization",
      resourceId: orgId,
      metadata: body,
      req,
    });
    res.json({ organization: updated });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});
```

### Sidebar Component (client/src/components/AppSidebar.tsx)

```typescript
type BrandingResponse = {
  organizationId?: string | null;
  canEditBranding?: boolean;
  whiteLabelLogoUrl: string | null;
  whiteLabelProductName: string | null;
  hideAithonBranding: boolean;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { data: branding } = useQuery<BrandingResponse>({
    queryKey: ["/api/branding"],
  });

  const productName = branding?.whiteLabelProductName?.trim() || "Aithon Shield";
  const tagline = branding?.hideAithonBranding ? "Security" : "Security Platform";
  const logoSrc = branding?.whiteLabelLogoUrl?.trim() || logoImage;

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="" className="h-8 w-8 object-contain" />
          <div>
            <h2 className="font-bold text-base">{productName}</h2>
            <p className="text-xs text-muted-foreground">{tagline}</p>
          </div>
        </div>
      </SidebarHeader>
      {/* ... rest of sidebar ... */}
    </Sidebar>
  );
}
```

### Workspace Branding Card (client/src/pages/Workspace.tsx)

```typescript
type BrandingResponse = {
  organizationId: string | null;
  canEditBranding: boolean;
  whiteLabelLogoUrl: string | null;
  whiteLabelProductName: string | null;
  hideAithonBranding: boolean;
};

// Inside Workspace component:
const { data: branding } = useQuery<BrandingResponse>({
  queryKey: ["/api/branding"],
});
const defaultOrgId = branding?.organizationId ?? null;

const [logoUrl, setLogoUrl] = useState("");
const [productName, setProductName] = useState("");
const [hideAithon, setHideAithon] = useState(false);

useEffect(() => {
  if (!branding) return;
  setLogoUrl(branding.whiteLabelLogoUrl ?? "");
  setProductName(branding.whiteLabelProductName ?? "");
  setHideAithon(Boolean(branding.hideAithonBranding));
}, [branding]);

const brandingMutation = useMutation({
  mutationFn: async () => {
    if (!defaultOrgId) throw new Error("No default organization for branding");
    const whiteLabelLogoUrl = logoUrl.trim() === "" ? null : logoUrl.trim();
    const whiteLabelProductName = productName.trim() === "" ? null : productName.trim();
    const res = await apiRequest("PATCH", `/api/organizations/${defaultOrgId}/branding`, {
      whiteLabelLogoUrl,
      whiteLabelProductName,
      hideAithonBranding: hideAithon,
    });
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
    toast({
      title: "Branding saved",
      description: "Sidebar and header labels will update on refresh.",
    });
  },
  onError: (e: Error) => {
    toast({
      title: "Could not save branding",
      description: e.message,
      variant: "destructive",
    });
  },
});

const canEditBranding = Boolean(branding?.canEditBranding && defaultOrgId);

// In JSX:
{canEditBranding && (
  <Card className="border-primary/20">
    <CardHeader>
      <CardTitle className="text-lg">Agency / white-label branding</CardTitle>
      <CardDescription>
        Applies to your default organization when you are an owner or admin.
        Set a logo URL and product name for the sidebar.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="wl-logo">Logo URL (HTTPS)</Label>
        <Input id="wl-logo" placeholder="https://example.com/logo.png"
          value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wl-name">Product name</Label>
        <Input id="wl-name" placeholder="Your Security Platform"
          value={productName} onChange={(e) => setProductName(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="wl-hide" checked={hideAithon} onCheckedChange={setHideAithon} />
        <Label htmlFor="wl-hide" className="cursor-pointer">
          Use shorter "Security" tagline
        </Label>
      </div>
      <Button onClick={() => brandingMutation.mutate()}
        disabled={brandingMutation.isPending}>
        {brandingMutation.isPending ? "Saving…" : "Save branding"}
      </Button>
    </CardContent>
  </Card>
)}
```

---

## Re-implementation Checklist for MVP2

1. Run the SQL migration to add the three columns to `organizations`
2. Restore the `getOrganizationById` and `updateOrganizationBranding` methods in storage
3. Add `GET /api/branding` and `PATCH /api/organizations/:id/branding` routes
4. Add `BrandingResponse` type and `useQuery` call in `AppSidebar.tsx`
5. Add the branding editor card to `Workspace.tsx`
6. Consider adding image upload instead of requiring a URL
7. Consider caching branding response to reduce API calls
