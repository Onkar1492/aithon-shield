import type { Express } from "express";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import type { IStorage } from "./storage";
import { decrypt } from "./encryption";
import { logAuditEvent } from "./auditEmitter";
import { isDemoMode } from "./demoMode";

const mergeGateGithubReportSchema = z.object({
  repoFullName: z.string().min(3).max(512),
  headSha: z.string().min(7).max(64),
  checkName: z.string().min(1).max(100).optional().default("Aithon Shield"),
  conclusion: z.enum([
    "success",
    "failure",
    "neutral",
    "cancelled",
    "skipped",
    "timed_out",
    "action_required",
  ]),
  title: z.string().max(200).optional(),
  summary: z.string().max(20000).optional().default(""),
  text: z.string().max(65000).optional(),
  pullRequestNumber: z.number().int().positive().optional(),
  commentBody: z.string().max(20000).optional(),
  dryRun: z.boolean().optional().default(false),
});

export type MergeGateGithubReportInput = z.infer<typeof mergeGateGithubReportSchema>;

function parseRepoFullName(s: string): { owner: string; repo: string } | null {
  const t = s.trim();
  const parts = t.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0]!, repo: parts.slice(1).join("/") };
}

export type MergeGateResult = {
  checkRunId: number;
  htmlUrl: string | null;
  commentId: number | null;
  dryRun: boolean;
};

export async function runGithubMergeGateReport(
  storage: IStorage,
  userId: string,
  input: MergeGateGithubReportInput,
): Promise<MergeGateResult> {
  const parsed = mergeGateGithubReportSchema.parse(input);
  const repoParts = parseRepoFullName(parsed.repoFullName);
  if (!repoParts) {
    throw new Error("repoFullName must be owner/repo (e.g. acme/service)");
  }
  const { owner, repo } = repoParts;

  if (parsed.dryRun) {
    return {
      checkRunId: 0,
      htmlUrl: `https://github.com/${owner}/${repo}/runs/dry-run`,
      commentId: parsed.pullRequestNumber != null ? 0 : null,
      dryRun: true,
    };
  }

  const conn = await storage.getGitConnection(userId, "github");
  if (!conn) {
    throw new Error("Connect GitHub in Settings before reporting a merge gate.");
  }
  const token = decrypt(conn.accessTokenEnc);
  if (!token) {
    throw new Error("Could not decrypt GitHub token; reconnect your account.");
  }

  const octokit = new Octokit({ auth: token });
  const title = parsed.title?.trim() || "Aithon Shield merge gate";
  const summary = parsed.summary || "";
  const text = parsed.text ?? summary;

  const { data: check } = await octokit.rest.checks.create({
    owner,
    repo,
    name: parsed.checkName,
    head_sha: parsed.headSha,
    status: "completed",
    conclusion: parsed.conclusion,
    output: {
      title,
      summary,
      text,
    },
  });

  let commentId: number | null = null;
  if (parsed.pullRequestNumber != null) {
    const body =
      (parsed.commentBody?.trim() || `**${title}**\n\n${summary || text}`.trim()).slice(0, 65000);
    const { data: issueComment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: parsed.pullRequestNumber,
      body,
    });
    commentId = issueComment.id;
  }

  return {
    checkRunId: check.id,
    htmlUrl: check.html_url ?? null,
    commentId,
    dryRun: false,
  };
}

export function registerMergeGateRoutes(
  app: Express,
  deps: { storage: IStorage; requireAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireAuth } = deps;

  app.get("/api/merge-gate/status", requireAuth, async (req: any, res) => {
    const githubOAuthConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    const conn = await storage.getGitConnection(req.user.id, "github");
    res.json({
      githubOAuthConfigured,
      githubConnected: Boolean(conn),
      githubUsername: conn?.externalUsername ?? null,
      demoMode: isDemoMode(),
    });
  });

  app.post("/api/merge-gate/github/report", requireAuth, async (req: any, res) => {
    try {
      if (isDemoMode()) {
        return res.status(503).json({ message: "Merge gate reporting is disabled in demo mode." });
      }
      const body = mergeGateGithubReportSchema.parse(req.body);
      const result = await runGithubMergeGateReport(storage, req.user.id, body);
      void logAuditEvent({
        userId: req.user.id,
        action: "merge_gate.github_report",
        resourceType: "merge_gate",
        resourceId: String(result.checkRunId),
        metadata: {
          repoFullName: body.repoFullName,
          headSha: body.headSha.slice(0, 12),
          conclusion: body.conclusion,
          dryRun: body.dryRun,
        },
        req,
      });
      res.json({
        ok: true,
        checkRunId: result.checkRunId,
        htmlUrl: result.htmlUrl,
        commentId: result.commentId,
        dryRun: result.dryRun,
      });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", issues: e.flatten() });
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[merge-gate/github/report]", e);
      res.status(400).json({ message: msg });
    }
  });
}
