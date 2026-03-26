/**
 * CI merge gate CLI — reports a GitHub Check Run (and optional PR comment) via Aithon Shield API.
 * Auth: AITHON_API_KEY (Bearer). Base URL: AITHON_API_BASE_URL or AITHON_BASE_URL (default http://127.0.0.1:5001).
 *
 * The agent or CI runs this; the product owner validates results in GitHub.
 */
function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx >= process.argv.length - 1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const base = (
    process.env.AITHON_API_BASE_URL ||
    process.env.AITHON_BASE_URL ||
    "http://127.0.0.1:5001"
  ).replace(/\/$/, "");
  const key = process.env.AITHON_API_KEY;
  if (!key?.trim()) {
    console.error("merge-gate: set AITHON_API_KEY to a write-scoped API key");
    process.exit(1);
  }

  const repoFullName = getArg("--repo");
  const headSha = getArg("--sha");
  if (!repoFullName || !headSha) {
    console.error(
      "Usage: merge-gate --repo owner/name --sha <commit_sha> [--conclusion success|failure|neutral|...] [--pr N] [--summary text] [--name 'Check name']",
    );
    process.exit(1);
  }

  const conclusion = (getArg("--conclusion") || "success") as
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required";

  const prStr = getArg("--pr");
  const pullRequestNumber = prStr ? parseInt(prStr, 10) : undefined;
  if (prStr && (Number.isNaN(pullRequestNumber!) || pullRequestNumber! < 1)) {
    console.error("merge-gate: --pr must be a positive integer");
    process.exit(1);
  }

  const summary = getArg("--summary") || "";
  const checkName = getArg("--name") || "Aithon Shield";
  const title = getArg("--title");
  const text = getArg("--text");
  const commentBody = getArg("--comment");

  const body: Record<string, unknown> = {
    repoFullName,
    headSha,
    conclusion,
    checkName,
    summary,
  };
  if (title) body.title = title;
  if (text) body.text = text;
  if (pullRequestNumber != null) body.pullRequestNumber = pullRequestNumber;
  if (commentBody) body.commentBody = commentBody;

  if (hasFlag("--verbose")) {
    console.error("merge-gate: POST", `${base}/api/merge-gate/github/report`);
  }

  const res = await fetch(`${base}/api/merge-gate/github/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error(`merge-gate: HTTP ${res.status}`, raw.slice(0, 800));
    process.exit(1);
  }

  try {
    const json = JSON.parse(raw) as { checkRunId?: number; htmlUrl?: string | null; commentId?: number | null };
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(raw);
  }
}

main().catch((e) => {
  console.error("merge-gate:", e);
  process.exit(1);
});
