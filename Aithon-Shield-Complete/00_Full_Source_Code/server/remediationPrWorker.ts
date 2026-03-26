import { Octokit } from "@octokit/rest";
import type { IStorage } from "./storage";
import { decrypt } from "./encryption";

function gitlabApiBase(): string {
  const b = (process.env.GITLAB_BASE_URL || "https://gitlab.com").replace(/\/$/, "");
  return `${b}/api/v4`;
}

async function buildFindingSummary(storage: IStorage, userId: string, scanId: string, scanType: string): Promise<string> {
  const findings = await storage.getFindingsByScan(scanId, userId, scanType);
  const ids = findings.slice(0, 20).map((f) => `- ${f.severity}: ${f.title} (${f.id})`);
  return findings.length === 0
    ? "_No open findings linked; job created for pipeline test._"
    : ids.join("\n") + (findings.length > 20 ? `\n\n_…and ${findings.length - 20} more_` : "");
}

async function openGithubRemediationPr(
  accessToken: string,
  repoFullName: string,
  jobId: string,
  scanType: string,
  scanId: string,
  summary: string,
): Promise<{ prUrl: string; branchName: string }> {
  const parts = repoFullName.split("/").map((s) => s.trim());
  if (parts.length < 2) {
    throw new Error("repoFullName must be owner/repo (GitHub)");
  }
  const owner = parts[0]!;
  const repo = parts.slice(1).join("/");
  const octokit = new Octokit({ auth: accessToken });
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const base = repoData.default_branch;
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = refData.object.sha;
  const branchName = `aithon/remediation-${jobId.slice(0, 8)}-${Date.now()}`;
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha });
  const body = `# Aithon Shield remediation\n\n**Job:** \`${jobId}\`\n**Scan:** ${scanType} / \`${scanId}\`\n\n## Findings\n\n${summary}\n`;
  const filePath = `security/aithon-remediation-${jobId.slice(0, 8)}.md`;
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `security: Aithon Shield remediation (${jobId.slice(0, 8)})`,
    content: Buffer.from(body, "utf8").toString("base64"),
    branch: branchName,
  });
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `[Aithon Shield] Security remediation (${jobId.slice(0, 8)})`,
    head: branchName,
    base,
    body,
  });
  return { prUrl: pr.html_url, branchName };
}

async function openGitlabRemediationMr(
  accessToken: string,
  repoFullName: string,
  jobId: string,
  scanType: string,
  scanId: string,
  summary: string,
): Promise<{ prUrl: string; branchName: string }> {
  const api = gitlabApiBase();
  const projectEnc = encodeURIComponent(repoFullName);
  const projRes = await fetch(`${api}/projects/${projectEnc}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!projRes.ok) {
    const t = await projRes.text();
    throw new Error(`GitLab project lookup failed: ${projRes.status} ${t.slice(0, 200)}`);
  }
  const project = (await projRes.json()) as { id: number; default_branch: string };
  const base = project.default_branch;
  const branchName = `aithon-remediation-${jobId.slice(0, 8)}-${Date.now()}`;
  const body = `# Aithon Shield remediation\n\n**Job:** \`${jobId}\`\n**Scan:** ${scanType} / \`${scanId}\`\n\n## Findings\n\n${summary}\n`;
  const filePath = `security/aithon-remediation-${jobId.slice(0, 8)}.md`;
  const fileRes = await fetch(
    `${api}/projects/${project.id}/repository/files/${encodeURIComponent(filePath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch: branchName,
        start_branch: base,
        content: Buffer.from(body, "utf8").toString("base64"),
        encoding: "base64",
        commit_message: `security: Aithon Shield remediation (${jobId.slice(0, 8)})`,
      }),
    },
  );
  if (!fileRes.ok) {
    const t = await fileRes.text();
    throw new Error(`GitLab file create failed: ${fileRes.status} ${t.slice(0, 200)}`);
  }
  const mrRes = await fetch(`${api}/projects/${project.id}/merge_requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_branch: branchName,
      target_branch: base,
      title: `[Aithon Shield] Security remediation (${jobId.slice(0, 8)})`,
      description: body,
    }),
  });
  if (!mrRes.ok) {
    const t = await mrRes.text();
    throw new Error(`GitLab MR create failed: ${mrRes.status} ${t.slice(0, 200)}`);
  }
  const mr = (await mrRes.json()) as { web_url: string };
  return { prUrl: mr.web_url, branchName };
}

export function scheduleRemediationJobRun(storage: IStorage, jobId: string, userId: string): void {
  setImmediate(() => {
    void runRemediationJob(storage, jobId, userId).catch((err) => {
      console.error("[RemediationJob]", jobId, err);
    });
  });
}

async function runRemediationJob(storage: IStorage, jobId: string, userId: string): Promise<void> {
  const job = await storage.getRemediationJob(jobId, userId);
  if (!job) return;

  await storage.updateRemediationJob(jobId, userId, { status: "patching", errorMessage: null });

  try {
    const provider = (job.provider || "github").toLowerCase();
    if (provider !== "github" && provider !== "gitlab") {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const conn = await storage.getGitConnection(userId, provider);
    if (!conn) {
      throw new Error(`No ${provider} account connected. Link it under Settings → Git integrations.`);
    }

    const token = decrypt(conn.accessTokenEnc);
    if (!token) {
      throw new Error("Could not decrypt stored token; reconnect your account.");
    }

    const repoFull = job.repoFullName?.trim();
    if (!repoFull) {
      throw new Error("Missing repoFullName on job");
    }

    const summary = await buildFindingSummary(storage, userId, job.scanId, job.scanType);

    let prUrl: string;
    let branchName: string;
    if (provider === "github") {
      const r = await openGithubRemediationPr(token, repoFull, job.id, job.scanType, job.scanId, summary);
      prUrl = r.prUrl;
      branchName = r.branchName;
    } else {
      const r = await openGitlabRemediationMr(token, repoFull, job.id, job.scanType, job.scanId, summary);
      prUrl = r.prUrl;
      branchName = r.branchName;
    }

    await storage.updateRemediationJob(jobId, userId, {
      status: "succeeded",
      prUrl,
      branchName,
      errorMessage: null,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    await storage.updateRemediationJob(jobId, userId, {
      status: "failed",
      errorMessage: msg.slice(0, 2000),
    });
  }
}
