import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Shield } from "lucide-react";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
};

type OrgsResponse = { organizations: OrgRow[] };

export default function Workspace() {
  const { data, isLoading, isError, error } = useQuery<OrgsResponse>({
    queryKey: ["/api/organizations"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace</h1>
        <p className="text-muted-foreground mt-1">
          Organizations you belong to and your role. New accounts get a personal workspace automatically; MVP, mobile,
          and web scans are scoped to your default organization for sharing with teammates.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading workspaces…
        </div>
      )}

      {isError && (
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Could not load workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message ?? "Sign in with a browser session (this page requires session auth)."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (data?.organizations?.length ?? 0) === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No organizations yet</CardTitle>
            <CardDescription>Your personal workspace will appear after the next authenticated request.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {(data?.organizations ?? []).map((org) => (
          <Card key={org.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg font-semibold">{org.name}</CardTitle>
              </div>
              <Badge variant="secondary" className="capitalize">
                {org.role}
              </Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">Slug:</span> {org.slug}
              </p>
              <p>
                <span className="font-medium text-foreground">Id:</span>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{org.id}</code>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
