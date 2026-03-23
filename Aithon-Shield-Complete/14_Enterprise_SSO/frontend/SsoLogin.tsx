import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, ExternalLink } from "lucide-react";

interface SsoProvider {
  id: string;
  name: string;
  type: "saml" | "oidc";
}

export default function SsoLogin() {
  const { data: providers = [] } = useQuery<SsoProvider[]>({
    queryKey: ["/api/sso/providers/enabled"],
  });

  if (providers.length === 0) {
    return null;
  }

  const handleSsoLogin = (provider: SsoProvider) => {
    const loginUrl = provider.type === "saml" 
      ? `/api/sso/saml/login/${provider.id}`
      : `/api/sso/oidc/login/${provider.id}`;
    
    window.location.href = loginUrl;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with SSO
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            variant="outline"
            className="w-full"
            onClick={() => handleSsoLogin(provider)}
            data-testid={`button-sso-login-${provider.id}`}
          >
            <Shield className="h-4 w-4 mr-2" />
            {provider.name}
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Enterprise SSO authentication powered by {providers.length > 1 ? "your organization" : providers[0].name}
      </p>
    </div>
  );
}

export function SsoLoginSection() {
  const { data: providers = [] } = useQuery<SsoProvider[]>({
    queryKey: ["/api/sso/providers/enabled"],
  });

  if (providers.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Enterprise SSO</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sign in with your organization's identity provider
        </p>
      </div>

      <div className="space-y-3">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              const loginUrl = provider.type === "saml" 
                ? `/api/sso/saml/login/${provider.id}`
                : `/api/sso/oidc/login/${provider.id}`;
              window.location.href = loginUrl;
            }}
            data-testid={`button-sso-provider-${provider.id}`}
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium text-sm">{provider.name}</p>
              <p className="text-xs text-muted-foreground">
                {provider.type === "saml" ? "SAML 2.0" : "OAuth/OIDC"}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Button>
        ))}
      </div>
    </Card>
  );
}
