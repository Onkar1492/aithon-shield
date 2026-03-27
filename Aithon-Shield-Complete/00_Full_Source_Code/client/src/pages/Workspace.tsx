import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, Shield, Users, UserPlus, Trash2, Link2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
};

type OrgsResponse = { organizations: OrgRow[] };

type MemberRow = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  joinedAt: string | null;
};

type MembersResponse = { members: MemberRow[] };

type InviteRow = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  token: string;
  invitedByUserId: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

type InvitesResponse = { invites: InviteRow[] };

const INVITE_ROLES_OWNER = [
  { value: "admin", label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "viewer", label: "Viewer" },
  { value: "auditor", label: "Auditor" },
];

const INVITE_ROLES_ADMIN = [
  { value: "developer", label: "Developer" },
  { value: "viewer", label: "Viewer" },
  { value: "auditor", label: "Auditor" },
];

export default function Workspace() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery<OrgsResponse>({
    queryKey: ["/api/organizations"],
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");

  const orgs = data?.organizations ?? [];
  const selected = useMemo(() => orgs.find((o) => o.id === selectedOrgId), [orgs, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const canManageTeam = selected?.role === "owner" || selected?.role === "admin";

  const membersQuery = useQuery<MembersResponse>({
    queryKey: ["/api/organizations", selectedOrgId, "members"],
    enabled: Boolean(selectedOrgId),
  });

  const invitesQuery = useQuery<InvitesResponse>({
    queryKey: ["/api/organizations", selectedOrgId, "invites"],
    enabled: Boolean(selectedOrgId) && canManageTeam,
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${encodeURIComponent(selectedOrgId)}/invites`, {
        email: inviteEmail,
        role: inviteRole,
      });
    },
    onSuccess: async () => {
      setInviteEmail("");
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrgId, "invites"] });
      toast({ title: "Invite sent", description: "Share the invite link from the list below." });
    },
    onError: (e: Error) => {
      toast({ title: "Could not create invite", description: e.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await apiRequest("DELETE", `/api/organizations/${encodeURIComponent(selectedOrgId)}/invites/${encodeURIComponent(inviteId)}`, {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrgId, "invites"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not revoke invite", description: e.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(
        "DELETE",
        `/api/organizations/${encodeURIComponent(selectedOrgId)}/members/${encodeURIComponent(userId)}`,
        {},
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrgId, "members"] });
      toast({ title: "Member removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not remove member", description: e.message, variant: "destructive" });
    },
  });

  const roleOptions = selected?.role === "owner" ? INVITE_ROLES_OWNER : INVITE_ROLES_ADMIN;

  useEffect(() => {
    const allowed = new Set(roleOptions.map((r) => r.value));
    if (!allowed.has(inviteRole)) {
      setInviteRole(roleOptions[0]?.value ?? "developer");
    }
  }, [inviteRole, roleOptions]);

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    void navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Invite link copied to clipboard." });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace</h1>
        <p className="text-muted-foreground mt-1">
          Organizations you belong to, teammates, and invites. Scans can be shared within a workspace when everyone is a member.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading workspaces\u2026
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

      {!isLoading && !isError && orgs.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No organizations yet</CardTitle>
            <CardDescription>Your personal workspace will appear after the next authenticated request.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {orgs.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="org-select" className="whitespace-nowrap">
            Active workspace
          </Label>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger id="org-select" className="sm:max-w-md">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {(orgs ?? []).map((org) => (
          <Card key={org.id} className={org.id === selectedOrgId ? "ring-1 ring-primary/40" : undefined}>
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

      {selectedOrgId && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Team members</CardTitle>
              <CardDescription>People with access to this workspace.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {membersQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members\u2026
              </div>
            )}
            {membersQuery.isError && (
              <p className="text-sm text-destructive">{(membersQuery.error as Error)?.message ?? "Could not load members."}</p>
            )}
            <div className="divide-y rounded-md border">
              {(membersQuery.data?.members ?? []).map((m) => (
                <div key={m.userId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {m.firstName} {m.lastName}{" "}
                      <span className="text-muted-foreground font-normal">({m.email})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">@{m.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {m.role}
                    </Badge>
                    {canManageTeam && m.userId !== user?.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${m.email}`}
                        onClick={() => removeMemberMutation.mutate(m.userId)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedOrgId && canManageTeam && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Invites</CardTitle>
              <CardDescription>Invite by email, then share the secure link. Invites expire after 7 days.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending || !inviteEmail.trim()}
              >
                {createInviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating\u2026
                  </>
                ) : (
                  "Create invite"
                )}
              </Button>
            </div>

            {invitesQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading invites\u2026
              </div>
            )}
            {invitesQuery.isError && (
              <p className="text-sm text-destructive">{(invitesQuery.error as Error)?.message ?? "Could not load invites."}</p>
            )}
            <div className="divide-y rounded-md border">
              {(invitesQuery.data?.invites ?? []).length === 0 && !invitesQuery.isLoading && (
                <p className="p-3 text-sm text-muted-foreground">No pending invites.</p>
              )}
              {(invitesQuery.data?.invites ?? []).map((inv) => (
                <div key={inv.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {inv.role} · expires {new Date(inv.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copyInviteLink(inv.token)}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Revoke invite for ${inv.email}`}
                      onClick={() => revokeInviteMutation.mutate(inv.id)}
                      disabled={revokeInviteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
