import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "./storage";
import { decrypt } from "./encryption";
import { logAuditEvent } from "./auditEmitter";
import { isDemoMode } from "./demoMode";
import { createJiraIssue, createLinearIssue } from "./services/trackerIssueService";
import type { Finding } from "@shared/schema";

const jiraPutSchema = z.object({
  siteBaseUrl: z.string().min(8).max(512),
  email: z.string().email(),
  apiToken: z.string().min(8).max(512),
  defaultProjectKey: z.string().min(1).max(32).optional(),
  defaultIssueTypeName: z.string().min(1).max(64).optional().default("Task"),
});

const linearPutSchema = z.object({
  apiKey: z.string().min(8).max(512),
  defaultTeamId: z.string().min(1).max(64).optional(),
});

const createIssueBodySchema = z.object({
  provider: z.enum(["jira", "linear"]),
  projectKey: z.string().min(1).max(32).optional(),
  teamId: z.string().min(1).max(64).optional(),
});

function buildIssueBody(f: Finding): { title: string; description: string } {
  const title = `[Aithon] ${f.severity.toUpperCase()}: ${f.title}`.slice(0, 500);
  const parts = [
    `**Severity:** ${f.severity}`,
    `**Category:** ${f.category}`,
    `**Asset:** ${f.asset}`,
    `**CWE:** ${f.cwe}`,
    `**Status:** ${f.status}`,
    "",
    "## Description",
    f.description || "(none)",
    "",
    "## Remediation",
    f.remediation || "(none)",
  ];
  if (f.aiSuggestion) {
    parts.push("", "## AI suggestion", f.aiSuggestion);
  }
  return { title, description: parts.join("\n").slice(0, 30000) };
}

export function registerTrackerIntegrationRoutes(
  app: Express,
  deps: { storage: IStorage; requireSessionAuth: (req: any, res: any, next: any) => void },
): void {
  const { storage, requireSessionAuth } = deps;

  app.get("/api/tracker-connections", requireSessionAuth, async (req: any, res) => {
    const userId = req.user.id;
    const jira = await storage.getTrackerConnection(userId, "jira");
    const linear = await storage.getTrackerConnection(userId, "linear");
    res.json({
      jira: {
        connected: Boolean(jira),
        siteBaseUrl: jira?.siteBaseUrl ?? null,
        accountEmail: jira?.accountEmail ?? null,
        defaultProjectKey: jira?.defaultProjectKey ?? null,
        defaultIssueTypeName: jira?.defaultIssueTypeName ?? "Task",
      },
      linear: {
        connected: Boolean(linear),
        defaultTeamId: linear?.defaultTeamId ?? null,
      },
    });
  });

  app.put("/api/tracker-connections/jira", requireSessionAuth, async (req: any, res) => {
    try {
      const body = jiraPutSchema.parse(req.body);
      await storage.upsertTrackerConnection({
        userId: req.user.id,
        provider: "jira",
        siteBaseUrl: body.siteBaseUrl.trim(),
        accountEmail: body.email.trim(),
        accessTokenPlain: body.apiToken,
        defaultProjectKey: body.defaultProjectKey?.trim() ?? null,
        defaultIssueTypeName: body.defaultIssueTypeName,
      });
      void logAuditEvent({
        userId: req.user.id,
        action: "tracker.jira_connect",
        resourceType: "tracker_connection",
        resourceId: "jira",
        req,
      });
      res.json({ ok: true });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message ?? "Invalid body" });
      }
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ message: msg });
    }
  });

  app.delete("/api/tracker-connections/jira", requireSessionAuth, async (req: any, res) => {
    await storage.deleteTrackerConnection(req.user.id, "jira");
    void logAuditEvent({
      userId: req.user.id,
      action: "tracker.jira_disconnect",
      resourceType: "tracker_connection",
      resourceId: "jira",
      req,
    });
    res.json({ ok: true });
  });

  app.put("/api/tracker-connections/linear", requireSessionAuth, async (req: any, res) => {
    try {
      const body = linearPutSchema.parse(req.body);
      await storage.upsertTrackerConnection({
        userId: req.user.id,
        provider: "linear",
        accessTokenPlain: body.apiKey,
        defaultTeamId: body.defaultTeamId?.trim() ?? null,
      });
      void logAuditEvent({
        userId: req.user.id,
        action: "tracker.linear_connect",
        resourceType: "tracker_connection",
        resourceId: "linear",
        req,
      });
      res.json({ ok: true });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message ?? "Invalid body" });
      }
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ message: msg });
    }
  });

  app.delete("/api/tracker-connections/linear", requireSessionAuth, async (req: any, res) => {
    await storage.deleteTrackerConnection(req.user.id, "linear");
    void logAuditEvent({
      userId: req.user.id,
      action: "tracker.linear_disconnect",
      resourceType: "tracker_connection",
      resourceId: "linear",
      req,
    });
    res.json({ ok: true });
  });

  app.post("/api/findings/:findingId/tracker-issue", requireSessionAuth, async (req: any, res) => {
    if (isDemoMode()) {
      return res.status(503).json({ message: "Creating tracker issues is disabled in demo mode." });
    }

    try {
      const body = createIssueBodySchema.parse(req.body);
      const finding = await storage.getFinding(req.params.findingId, req.user.id);
      if (!finding) {
        return res.status(404).json({ message: "Finding not found" });
      }
      if (finding.trackerIssueUrl) {
        return res.status(409).json({
          message: "This finding already has a linked tracker issue.",
          trackerIssueUrl: finding.trackerIssueUrl,
          trackerIssueKey: finding.trackerIssueKey,
        });
      }

      const { title, description } = buildIssueBody(finding);

      if (body.provider === "jira") {
        const conn = await storage.getTrackerConnection(req.user.id, "jira");
        if (!conn) {
          return res.status(400).json({ message: "Connect Jira in Settings first." });
        }
        const token = decrypt(conn.accessTokenEnc);
        if (!token) {
          return res.status(500).json({ message: "Failed to read Jira credentials" });
        }
        const projectKey = body.projectKey?.trim() || conn.defaultProjectKey;
        if (!projectKey) {
          return res.status(400).json({
            message: "Set a default Jira project key in Settings or pass projectKey in the request body.",
          });
        }
        const siteBaseUrl = conn.siteBaseUrl;
        const email = conn.accountEmail;
        if (!siteBaseUrl || !email) {
          return res.status(400).json({ message: "Jira connection is incomplete (site URL or email missing)." });
        }
        const issueType = conn.defaultIssueTypeName || "Task";
        const created = await createJiraIssue({
          siteBaseUrl,
          email,
          apiToken: token,
          projectKey,
          issueTypeName: issueType,
          summary: title,
          description,
        });
        await storage.updateFinding(finding.id, req.user.id, {
          trackerIssueProvider: "jira",
          trackerIssueKey: created.key,
          trackerIssueUrl: created.url,
        });
        void logAuditEvent({
          userId: req.user.id,
          action: "tracker.issue_created",
          resourceType: "finding",
          resourceId: finding.id,
          metadata: { provider: "jira", key: created.key, url: created.url },
          req,
        });
        return res.status(201).json({ provider: "jira", key: created.key, url: created.url });
      }

      const conn = await storage.getTrackerConnection(req.user.id, "linear");
      if (!conn) {
        return res.status(400).json({ message: "Connect Linear in Settings first." });
      }
      const token = decrypt(conn.accessTokenEnc);
      if (!token) {
        return res.status(500).json({ message: "Failed to read Linear credentials" });
      }
      const teamId = body.teamId?.trim() || conn.defaultTeamId;
      if (!teamId) {
        return res.status(400).json({
          message: "Set a default Linear team id in Settings or pass teamId in the request body.",
        });
      }
      const created = await createLinearIssue({
        apiKey: token,
        teamId,
        title,
        description,
      });
      await storage.updateFinding(finding.id, req.user.id, {
        trackerIssueProvider: "linear",
        trackerIssueKey: created.key,
        trackerIssueUrl: created.url,
      });
      void logAuditEvent({
        userId: req.user.id,
        action: "tracker.issue_created",
        resourceType: "finding",
        resourceId: finding.id,
        metadata: { provider: "linear", key: created.key, url: created.url },
        req,
      });
      return res.status(201).json({ provider: "linear", key: created.key, url: created.url });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message ?? "Invalid body" });
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[tracker-issue]", e);
      res.status(400).json({ message: msg });
    }
  });
}
