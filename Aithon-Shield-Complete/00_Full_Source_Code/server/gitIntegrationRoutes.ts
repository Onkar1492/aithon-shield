import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import { encrypt } from "./encryption";
import { createOAuthState, consumeOAuthState } from "./oauthStateStore";
import { logAuditEvent } from "./auditEmitter";
import { scheduleRemediationJobRun } from "./remediationPrWorker";
import { isDemoMode } from "./demoMode";

function serverPublicBaseUrl(req: { protocol: string; get(name: string): string | undefined; headers: Record<string, string | string[] | undefined> }): string {
  const env = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (env) return env;
  const xfProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(xfProto) ? xfProto[0] : xfProto) || req.protocol || "http";
  const host = req.get("host") || "localhost:5001";
  return `${proto}://${host}`;
}

function settingsRedirectUrl(req: Parameters<typeof serverPublicBaseUrl>[0], query: Record<string, string>): string {
  const base = serverPublicBaseUrl(req);
  const q = new URLSearchParams(query).toString();
  return `${base}/settings?${q}`;
}

async function exchangeGithubCode(code: string, redirectUri: string): Promise<{
  access_token: string;
  scope?: string;
}> {
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("GitHub OAuth is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)");
  }
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; scope?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `GitHub token exchange failed (${res.status})`);
  }
  return { access_token: data.access_token, scope: data.scope };
}

async function fetchGithubUser(accessToken: string): Promise<{ login: string; id: number }> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub user API failed: ${res.status} ${t.slice(0, 120)}`);
  }
  return res.json() as Promise<{ login: string; id: number }>;
}

function gitlabHostBase(): string {
  return (process.env.GITLAB_BASE_URL || "https://gitlab.com").replace(/\/$/, "");
}

async function exchangeGitlabCode(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const id = process.env.GITLAB_CLIENT_ID;
  const secret = process.env.GITLAB_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("GitLab OAuth is not configured (GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET)");
  }
  const res = await fetch(`${gitlabHostBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    scope?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `GitLab token exchange failed (${res.status})`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope,
  };
}

async function fetchGitlabUser(accessToken: string): Promise<{ username: string; id: number }> {
  const res = await fetch(`${gitlabHostBase()}/api/v4/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitLab user API failed: ${res.status} ${t.slice(0, 120)}`);
  }
  const j = (await res.json()) as { username: string; id: number };
  return j;
}

const remediationJobBodySchema = z.object({
  scanType: z.enum(["mvp", "mobile", "web", "pipeline", "container", "network", "linter"]),
  scanId: z.string().min(1),
  provider: z.enum(["github", "gitlab"]),
  repoFullName: z.string().min(1).max(512),
  findingIds: z.array(z.string()).optional(),
});

export function registerGitIntegrationRoutes(
  app: Express,
  deps: { storage: IStorage; requireSessionAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireSessionAuth } = deps;

  app.get("/api/oauth/github/start", requireSessionAuth, (req: any, res) => {
    const id = process.env.GITHUB_CLIENT_ID;
    if (!id) {
      return res.redirect(
        settingsRedirectUrl(req, {
          git_error: "github",
          git_error_detail: "GitHub OAuth is not configured on this server (GITHUB_CLIENT_ID missing). Ask your admin or the Cursor agent to add it to .env.",
        }),
      );
    }
    const redirectUri = `${serverPublicBaseUrl(req)}/api/oauth/github/callback`;
    const state = createOAuthState(req.user.id, "github");
    const scope = process.env.GITHUB_OAUTH_SCOPE || "repo";
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  app.get("/api/oauth/github/callback", async (req: any, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const pending = consumeOAuthState(state);
      if (!pending || pending.provider !== "github") {
        return res.redirect(settingsRedirectUrl(req, { git_error: "invalid_oauth_state" }));
      }
      const redirectUri = `${serverPublicBaseUrl(req)}/api/oauth/github/callback`;
      const { access_token, scope } = await exchangeGithubCode(code, redirectUri);
      const ghUser = await fetchGithubUser(access_token);
      const enc = encrypt(access_token);
      if (!enc) throw new Error("Failed to encrypt access token");
      await storage.upsertGitConnection({
        userId: pending.userId,
        provider: "github",
        accessTokenEnc: enc,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        externalUsername: ghUser.login,
        externalUserId: String(ghUser.id),
        scope: scope ?? null,
      });
      void logAuditEvent({
        userId: pending.userId,
        action: "git.connect",
        resourceType: "git_connection",
        resourceId: "github",
        metadata: { provider: "github", username: ghUser.login },
        req,
      });
      return res.redirect(settingsRedirectUrl(req, { git_connected: "github" }));
    } catch (e: any) {
      console.error("[oauth/github/callback]", e);
      return res.redirect(
        settingsRedirectUrl(req, { git_error: "github", git_error_detail: String(e?.message || e).slice(0, 200) }),
      );
    }
  });

  app.get("/api/oauth/gitlab/start", requireSessionAuth, (req: any, res) => {
    if (isDemoMode()) {
      return res.status(403).json({ message: "Demo mode: Git integrations are disabled.", code: "DEMO_GIT_DISABLED" });
    }
    const id = process.env.GITLAB_CLIENT_ID;
    if (!id) {
      return res.redirect(
        settingsRedirectUrl(req, {
          git_error: "gitlab",
          git_error_detail: "GitLab OAuth is not configured on this server (GITLAB_CLIENT_ID missing). Ask your admin or the Cursor agent to add it to .env.",
        }),
      );
    }
    const redirectUri = `${serverPublicBaseUrl(req)}/api/oauth/gitlab/callback`;
    const state = createOAuthState(req.user.id, "gitlab");
    const scope = process.env.GITLAB_OAUTH_SCOPE || "api write_repository";
    const url = new URL(`${gitlabHostBase()}/oauth/authorize`);
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  app.get("/api/oauth/gitlab/callback", async (req: any, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const pending = consumeOAuthState(state);
      if (!pending || pending.provider !== "gitlab") {
        return res.redirect(settingsRedirectUrl(req, { git_error: "invalid_oauth_state" }));
      }
      const redirectUri = `${serverPublicBaseUrl(req)}/api/oauth/gitlab/callback`;
      const tok = await exchangeGitlabCode(code, redirectUri);
      const glUser = await fetchGitlabUser(tok.access_token);
      const expiresAt =
        typeof tok.expires_in === "number" ? new Date(Date.now() + tok.expires_in * 1000) : null;
      const encAt = encrypt(tok.access_token);
      if (!encAt) throw new Error("Failed to encrypt access token");
      const encRt = tok.refresh_token ? encrypt(tok.refresh_token) : null;
      await storage.upsertGitConnection({
        userId: pending.userId,
        provider: "gitlab",
        accessTokenEnc: encAt,
        refreshTokenEnc: encRt,
        tokenExpiresAt: expiresAt,
        externalUsername: glUser.username,
        externalUserId: String(glUser.id),
        scope: tok.scope ?? null,
      });
      void logAuditEvent({
        userId: pending.userId,
        action: "git.connect",
        resourceType: "git_connection",
        resourceId: "gitlab",
        metadata: { provider: "gitlab", username: glUser.username },
        req,
      });
      return res.redirect(settingsRedirectUrl(req, { git_connected: "gitlab" }));
    } catch (e: any) {
      console.error("[oauth/gitlab/callback]", e);
      return res.redirect(
        settingsRedirectUrl(req, { git_error: "gitlab", git_error_detail: String(e?.message || e).slice(0, 200) }),
      );
    }
  });

  app.get("/api/git-connections", requireSessionAuth, async (req: any, res) => {
    try {
      const rows = await storage.listGitConnections(req.user.id);
      res.json(
        rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          externalUsername: r.externalUsername,
          scope: r.scope,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      );
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to list connections" });
    }
  });

  app.delete("/api/git-connections/:id", requireSessionAuth, async (req: any, res) => {
    try {
      const ok = await storage.deleteGitConnection(req.params.id, req.user.id);
      if (!ok) {
        return res.status(404).json({ message: "Connection not found" });
      }
      void logAuditEvent({
        userId: req.user.id,
        action: "git.disconnect",
        resourceType: "git_connection",
        resourceId: req.params.id,
        req,
      });
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to delete" });
    }
  });

  app.post("/api/remediation-jobs", requireSessionAuth, async (req: any, res) => {
    try {
      if (isDemoMode()) {
        return res.status(403).json({
          message: "Demo mode: remediation jobs are disabled.",
          code: "DEMO_REMEDIATION_DISABLED",
        });
      }
      const parsed = remediationJobBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid body", issues: parsed.error.flatten() });
      }
      const { scanType, scanId, provider, repoFullName, findingIds } = parsed.data;
      const canRead = await storage.userCanReadScanByType(req.user.id, scanType, scanId);
      if (!canRead) {
        return res.status(404).json({ message: "Scan not found" });
      }
      const job = await storage.createRemediationJob({
        userId: req.user.id,
        scanType,
        scanId,
        findingIds: findingIds ?? null,
        status: "pending",
        provider,
        repoFullName: repoFullName.trim(),
        metadata: null,
      });
      void logAuditEvent({
        userId: req.user.id,
        action: "remediation.job.create",
        resourceType: "remediation_job",
        resourceId: job.id,
        metadata: { scanType, scanId, provider, repoFullName: repoFullName.trim() },
        req,
      });
      scheduleRemediationJobRun(storage, job.id, req.user.id);
      res.status(201).json({
        id: job.id,
        status: job.status,
        scanType: job.scanType,
        scanId: job.scanId,
        provider: job.provider,
        repoFullName: job.repoFullName,
        createdAt: job.createdAt,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to create job" });
    }
  });

  app.get("/api/remediation-jobs", requireSessionAuth, async (req: any, res) => {
    try {
      const scanType = typeof req.query.scanType === "string" ? req.query.scanType : "";
      const scanId = typeof req.query.scanId === "string" ? req.query.scanId : "";
      if (!scanType || !scanId) {
        return res.status(400).json({ message: "scanType and scanId query params are required" });
      }
      const canRead = await storage.userCanReadScanByType(req.user.id, scanType, scanId);
      if (!canRead) {
        return res.status(404).json({ message: "Scan not found" });
      }
      const jobs = await storage.listRemediationJobsForScan(req.user.id, scanType, scanId);
      res.json(
        jobs.map((j) => ({
          id: j.id,
          status: j.status,
          scanType: j.scanType,
          scanId: j.scanId,
          provider: j.provider,
          repoFullName: j.repoFullName,
          branchName: j.branchName,
          prUrl: j.prUrl,
          errorMessage: j.errorMessage,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        })),
      );
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to list jobs" });
    }
  });

  app.get("/api/remediation-jobs/:id", requireSessionAuth, async (req: any, res) => {
    try {
      const job = await storage.getRemediationJob(req.params.id, req.user.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({
        id: job.id,
        status: job.status,
        scanType: job.scanType,
        scanId: job.scanId,
        provider: job.provider,
        repoFullName: job.repoFullName,
        branchName: job.branchName,
        prUrl: job.prUrl,
        errorMessage: job.errorMessage,
        findingIds: job.findingIds,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to get job" });
    }
  });
}
