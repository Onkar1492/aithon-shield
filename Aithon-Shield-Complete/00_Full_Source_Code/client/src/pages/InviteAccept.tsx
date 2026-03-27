import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type InvitePreview = {
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  expired: boolean;
  accepted: boolean;
};

export default function InviteAccept() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery<InvitePreview>({
    queryKey: ["/api/invites", token],
    enabled: Boolean(token),
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invites/${encodeURIComponent(token)}/accept`, {});
      return res.json() as Promise<{ ok: boolean; organizationId?: string }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "You're in",
        description: "You've joined the workspace.",
      });
      setLocation("/workspace");
    },
    onError: (e: Error) => {
      toast({
        title: "Could not accept invite",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const loginHref = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Invalid link</CardTitle>
            <CardDescription>This invite link is missing a token.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading invite\u2026
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40">
          <CardHeader className="flex flex-row items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Invite not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{(error as Error)?.message ?? "Check the link or ask for a new invite."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-base">Already accepted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">This invite was already used.</p>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/workspace")}>
              Open Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Invite expired</CardTitle>
            <CardDescription>Ask an admin to send a new invite.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const emailMismatch =
    isAuthenticated && user && user.email.trim().toLowerCase() !== data.email.trim().toLowerCase();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Workspace invite</CardTitle>
          <CardDescription>
            You&apos;ve been invited to <span className="font-medium text-foreground">{data.organizationName}</span> as{" "}
            <span className="capitalize">{data.role}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            This invite is for <span className="font-medium text-foreground">{data.email}</span>.
          </p>

          {!isAuthenticated && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Sign in with the invited email to join.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" asChild>
                  <a href={loginHref}>Sign in</a>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href={signupHref}>Create account</a>
                </Button>
              </div>
            </div>
          )}

          {emailMismatch && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              You&apos;re signed in as {user.email}. Sign out and sign in as {data.email}, or use a private window.
            </div>
          )}

          {isAuthenticated && !emailMismatch && (
            <Button className="w-full" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining\u2026
                </>
              ) : (
                "Accept & join workspace"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
