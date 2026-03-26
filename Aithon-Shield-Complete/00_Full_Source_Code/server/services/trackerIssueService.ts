/**
 * Create issues in Jira Cloud (REST v3) and Linear (GraphQL).
 */

function plainTextToJiraAdf(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const content = lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line.length > 0 ? line : " " }],
  }));
  return { type: "doc", version: 1, content };
}

function normalizeJiraBaseUrl(raw: string): string {
  const u = raw.trim().replace(/\/+$/, "");
  if (!u.startsWith("https://")) {
    throw new Error("Jira site URL must start with https://");
  }
  try {
    const parsed = new URL(u);
    if (!parsed.hostname.endsWith(".atlassian.net")) {
      throw new Error("Use your Jira Cloud site (hostname must end with .atlassian.net)");
    }
    return `${parsed.origin}`;
  } catch (e) {
    if (e instanceof Error && e.message.includes("Jira")) throw e;
    throw new Error("Invalid Jira site URL");
  }
}

export async function createJiraIssue(params: {
  siteBaseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueTypeName: string;
  summary: string;
  description: string;
}): Promise<{ key: string; url: string }> {
  const base = normalizeJiraBaseUrl(params.siteBaseUrl);
  const auth = Buffer.from(`${params.email.trim()}:${params.apiToken}`, "utf8").toString("base64");
  const body = {
    fields: {
      project: { key: params.projectKey.trim().toUpperCase() },
      summary: params.summary.slice(0, 255),
      description: plainTextToJiraAdf(params.description.slice(0, 32000)),
      issuetype: { name: params.issueTypeName.trim() },
    },
  };

  const res = await fetch(`${base}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 500);
    try {
      const j = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string> };
      if (j.errorMessages?.length) msg = j.errorMessages.join("; ");
      else if (j.errors && typeof j.errors === "object") {
        msg = Object.entries(j.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ");
      }
    } catch {
      /* keep msg */
    }
    throw new Error(msg || `Jira API error (${res.status})`);
  }

  const data = JSON.parse(text) as { key?: string; self?: string };
  const key = data.key;
  if (!key) throw new Error("Jira did not return an issue key");
  const url = `${base}/browse/${key}`;
  return { key, url };
}

const LINEAR_ISSUE_CREATE = `
mutation IssueCreate($teamId: String!, $title: String!, $description: String) {
  issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
    success
    issue { id identifier url }
  }
}
`;

export async function createLinearIssue(params: {
  apiKey: string;
  teamId: string;
  title: string;
  description: string;
}): Promise<{ key: string; url: string }> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: params.apiKey.trim(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: LINEAR_ISSUE_CREATE,
      variables: {
        teamId: params.teamId.trim(),
        title: params.title.slice(0, 500),
        description: params.description.slice(0, 25000) || null,
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Linear HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = JSON.parse(text) as {
    data?: {
      issueCreate?: {
        success?: boolean;
        issue?: { identifier?: string; url?: string };
      };
    };
    errors?: { message?: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).filter(Boolean).join("; ") || "Linear GraphQL error");
  }

  const ic = json.data?.issueCreate;
  if (!ic?.success || !ic.issue?.url) {
    throw new Error("Linear did not return an issue (check team id and API key scopes)");
  }

  const identifier = ic.issue.identifier ?? ic.issue.url.split("/").pop() ?? "issue";
  return { key: identifier, url: ic.issue.url };
}
