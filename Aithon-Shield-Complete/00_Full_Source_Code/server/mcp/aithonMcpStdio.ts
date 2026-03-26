import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const baseUrl = (process.env.AITHON_API_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
const apiKey = process.env.AITHON_API_KEY;

if (!apiKey || !apiKey.startsWith("aithon_")) {
  console.error(
    "AITHON_API_KEY must be set to a full key (aithon_…) created in Settings → API keys. Example: export AITHON_API_KEY=aithon_…",
  );
  process.exit(1);
}

async function apiJson(path: string, init?: RequestInit): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

const server = new McpServer(
  { name: "aithon-shield", version: "1.0.0" },
  {
    instructions: `Aithon Shield MCP: call tools with your API key (Bearer). Base URL: ${baseUrl}. Create keys in the web app under Settings → API keys. Typical flow: list scans → get findings for a scan.`,
  },
);

server.tool(
  "aithon_whoami",
  "Return the current user (from GET /api/auth/me). Use to verify the API key.",
  {},
  async () => {
    const data = await apiJson("/api/auth/me");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "aithon_list_mvp_scans",
  "List MVP code scans for the authenticated user.",
  {},
  async () => {
    const data = await apiJson("/api/mvp-scans");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "aithon_get_mvp_scan",
  "Get one MVP scan by id.",
  { id: z.string().min(1) },
  async ({ id }) => {
    const data = await apiJson(`/api/mvp-scans/${encodeURIComponent(id)}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "aithon_list_web_scans",
  "List web app scans.",
  {},
  async () => {
    const data = await apiJson("/api/web-scans");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "aithon_list_mobile_scans",
  "List mobile app scans.",
  {},
  async () => {
    const data = await apiJson("/api/mobile-scans");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "aithon_list_findings",
  "List security findings. Optional scanId and scanType (mvp | mobile | web) filter.",
  {
    scanId: z.string().optional(),
    scanType: z.enum(["mvp", "mobile", "web"]).optional(),
  },
  async (args) => {
    const q = new URLSearchParams();
    if (args.scanId) q.set("scanId", args.scanId);
    if (args.scanType) q.set("scanType", args.scanType);
    const path = q.toString() ? `/api/findings?${q}` : "/api/findings";
    const data = await apiJson(path);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
