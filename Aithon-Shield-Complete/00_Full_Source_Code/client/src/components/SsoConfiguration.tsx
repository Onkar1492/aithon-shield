import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Key, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SsoProvider } from "@shared/schema";

export default function SsoConfiguration() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [providerType, setProviderType] = useState<"saml" | "oidc">("oidc");

  const { data: providers = [] } = useQuery<SsoProvider[]>({
    queryKey: ["/api/sso/providers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/sso/providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso/providers"] });
      toast({
        title: "Provider deleted",
        description: "SSO provider has been removed successfully.",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/sso/providers/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso/providers"] });
    },
  });

  return (
    <Card className="p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Enterprise SSO</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure SAML 2.0 and OAuth/OIDC providers for enterprise authentication
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-sso-provider">
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add SSO Provider</DialogTitle>
              <DialogDescription>
                Configure a new SAML 2.0 or OAuth/OIDC identity provider
              </DialogDescription>
            </DialogHeader>
            <SsoProviderForm
              type={providerType}
              onTypeChange={setProviderType}
              onSuccess={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Separator className="my-4" />

      {providers.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No SSO providers configured</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add Okta, Azure AD, or other enterprise identity providers
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-provider">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Provider
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 shadow-sm rounded-lg"
              data-testid={`sso-provider-${provider.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{provider.name}</p>
                    <Badge variant={provider.type === "saml" ? "default" : "secondary"}>
                      {provider.type.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {provider.type === "saml"
                      ? `Entry Point: ${provider.samlEntryPoint || "Not configured"}`
                      : `Issuer: ${provider.oidcIssuer || "Not configured"}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(enabled) =>
                    toggleMutation.mutate({ id: provider.id, enabled })
                  }
                  data-testid={`switch-provider-${provider.id}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(provider.id)}
                  data-testid={`button-delete-provider-${provider.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SsoProviderForm({
  type,
  onTypeChange,
  onSuccess,
}: {
  type: "saml" | "oidc";
  onTypeChange: (type: "saml" | "oidc") => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    type: type,
    enabled: true,
    // SAML fields
    samlEntryPoint: "",
    samlIssuer: "",
    samlCert: "",
    samlCallbackUrl: "",
    samlEntityId: "",
    // OIDC fields
    oidcIssuer: "",
    oidcClientId: "",
    oidcClientSecret: "",
    oidcCallbackUrl: "",
    // Role mapping
    roleAttributeName: "",
    adminRoleValues: "",
    devRoleValues: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/sso/providers", {
        ...data,
        adminRoleValues: data.adminRoleValues ? data.adminRoleValues.split(",").map((v: string) => v.trim()) : null,
        devRoleValues: data.devRoleValues ? data.devRoleValues.split(",").map((v: string) => v.trim()) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso/providers"] });
      toast({
        title: "Provider added",
        description: "SSO provider has been configured successfully.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add SSO provider",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, type });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Provider Type</Label>
        <Select
          value={type}
          onValueChange={(value: "saml" | "oidc") => {
            onTypeChange(value);
            setFormData({ ...formData, type: value });
          }}
        >
          <SelectTrigger data-testid="select-provider-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oidc">OAuth/OIDC (Modern)</SelectItem>
            <SelectItem value="saml">SAML 2.0 (Traditional)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Provider Name</Label>
        <Input
          placeholder="e.g., Okta, Azure AD, Google Workspace"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          data-testid="input-provider-name"
        />
      </div>

      {type === "oidc" ? (
        <>
          <div className="space-y-2">
            <Label>OIDC Issuer URL</Label>
            <Input
              placeholder="https://accounts.google.com"
              value={formData.oidcIssuer}
              onChange={(e) => setFormData({ ...formData, oidcIssuer: e.target.value })}
              required
              data-testid="input-oidc-issuer"
            />
          </div>
          <div className="space-y-2">
            <Label>Client ID</Label>
            <Input
              placeholder="your-client-id"
              value={formData.oidcClientId}
              onChange={(e) => setFormData({ ...formData, oidcClientId: e.target.value })}
              required
              data-testid="input-oidc-client-id"
            />
          </div>
          <div className="space-y-2">
            <Label>Client Secret</Label>
            <Input
              type="password"
              placeholder="your-client-secret"
              value={formData.oidcClientSecret}
              onChange={(e) => setFormData({ ...formData, oidcClientSecret: e.target.value })}
              required
              data-testid="input-oidc-client-secret"
            />
          </div>
          <div className="space-y-2">
            <Label>Callback URL (optional)</Label>
            <Input
              placeholder="https://yourapp.com/api/sso/oidc/callback/{id}"
              value={formData.oidcCallbackUrl}
              onChange={(e) => setFormData({ ...formData, oidcCallbackUrl: e.target.value })}
              data-testid="input-oidc-callback"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use auto-generated callback URL
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label>SAML Entry Point (IdP SSO URL)</Label>
            <Input
              placeholder="https://idp.example.com/sso/saml"
              value={formData.samlEntryPoint}
              onChange={(e) => setFormData({ ...formData, samlEntryPoint: e.target.value })}
              required
              data-testid="input-saml-entry-point"
            />
          </div>
          <div className="space-y-2">
            <Label>SAML Issuer (IdP Entity ID)</Label>
            <Input
              placeholder="http://idp.example.com/entity-id"
              value={formData.samlIssuer}
              onChange={(e) => setFormData({ ...formData, samlIssuer: e.target.value })}
              required
              data-testid="input-saml-issuer"
            />
          </div>
          <div className="space-y-2">
            <Label>SAML Certificate (X.509, PEM format)</Label>
            <Textarea
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              value={formData.samlCert}
              onChange={(e) => setFormData({ ...formData, samlCert: e.target.value })}
              className="font-mono text-xs"
              rows={6}
              required
              data-testid="input-saml-cert"
            />
          </div>
          <div className="space-y-2">
            <Label>Callback URL (ACS URL) - optional</Label>
            <Input
              placeholder="https://yourapp.com/api/sso/saml/callback/{id}"
              value={formData.samlCallbackUrl}
              onChange={(e) => setFormData({ ...formData, samlCallbackUrl: e.target.value })}
              data-testid="input-saml-callback"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use auto-generated callback URL
            </p>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-4">
        <h3 className="font-medium">Role Mapping (Optional)</h3>
        <div className="space-y-2">
          <Label>Role Attribute Name</Label>
          <Input
            placeholder="e.g., groups, roles"
            value={formData.roleAttributeName}
            onChange={(e) => setFormData({ ...formData, roleAttributeName: e.target.value })}
            data-testid="input-role-attribute"
          />
        </div>
        <div className="space-y-2">
          <Label>Admin Role Values (comma-separated)</Label>
          <Input
            placeholder="e.g., admin, admins, administrators"
            value={formData.adminRoleValues}
            onChange={(e) => setFormData({ ...formData, adminRoleValues: e.target.value })}
            data-testid="input-admin-roles"
          />
        </div>
        <div className="space-y-2">
          <Label>Developer Role Values (comma-separated)</Label>
          <Input
            placeholder="e.g., dev, developer, developers"
            value={formData.devRoleValues}
            onChange={(e) => setFormData({ ...formData, devRoleValues: e.target.value })}
            data-testid="input-dev-roles"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-provider">
          {createMutation.isPending ? "Adding..." : "Add Provider"}
        </Button>
      </DialogFooter>
    </form>
  );
}
