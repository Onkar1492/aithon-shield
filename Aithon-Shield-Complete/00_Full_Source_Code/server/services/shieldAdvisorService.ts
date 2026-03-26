import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { IStorage } from "../storage";
import { isDemoMode } from "../demoMode";

export const SHIELD_ADVISOR_GLOBAL_FINDING_ID = "global";
export const SHIELD_ADVISOR_GLOBAL_SCAN_TYPE = "none";
export const SHIELD_ADVISOR_GLOBAL_SCAN_ID = "none";

export const SHIELD_ADVISOR_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "llama",
  "bedrock",
] as const;
export type ShieldAdvisorProviderId = (typeof SHIELD_ADVISOR_PROVIDERS)[number];

type ChatTurn = { role: "user" | "assistant"; content: string };

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

async function loadScanSummaryLine(
  storage: IStorage,
  userId: string,
  scanType: string,
  scanId: string,
): Promise<string | null> {
  if (scanType === "mvp") {
    const s = await storage.getMvpCodeScan(scanId, userId);
    if (!s) return null;
    return `MVP scan "${s.projectName}" (${s.scanStatus}): ${s.repositoryUrl} @ ${s.branch}. Findings: ${s.findingsCount ?? 0}.`;
  }
  if (scanType === "web") {
    const s = await storage.getWebAppScan(scanId, userId);
    if (!s) return null;
    return `Web scan "${s.appName}" (${s.scanStatus}): ${s.appUrl}. Findings: ${s.findingsCount ?? 0}.`;
  }
  if (scanType === "mobile") {
    const s = await storage.getMobileAppScan(scanId, userId);
    if (!s) return null;
    return `Mobile scan "${s.appName}" (${s.scanStatus}): ${s.appId}. Findings: ${s.findingsCount ?? 0}.`;
  }
  return null;
}

/**
 * Resolves conversation keys and builds a system prompt with scan/finding context.
 */
export async function buildShieldAdvisorSystemPrompt(
  storage: IStorage,
  userId: string,
  input: {
    findingId?: string;
    scanType?: string;
    scanId?: string;
    extraContext?: string;
  },
): Promise<{
  convFindingId: string;
  convScanType: string;
  convScanId: string;
  systemPrompt: string;
}> {
  let convFindingId = input.findingId?.trim() || SHIELD_ADVISOR_GLOBAL_FINDING_ID;
  let convScanType = (input.scanType?.trim() || SHIELD_ADVISOR_GLOBAL_SCAN_TYPE).toLowerCase();
  let convScanId = input.scanId?.trim() || SHIELD_ADVISOR_GLOBAL_SCAN_ID;

  const parts: string[] = [
    "You are Shield Advisor, the in-app assistant for Aithon Shield (application security).",
    "Give concise, accurate security guidance. Prefer actionable remediation. If unsure, say so.",
    "Do not claim to have run tools or seen live code unless context below includes it.",
  ];

  let findingLoaded = false;
  if (convFindingId && convFindingId !== SHIELD_ADVISOR_GLOBAL_FINDING_ID) {
    const f = await storage.getFinding(convFindingId, userId);
    if (f) {
      findingLoaded = true;
      convScanType = (input.scanType || f.scanType || convScanType).toLowerCase();
      convScanId = input.scanId || f.scanId || convScanId;
      parts.push(
        "\n## Current finding\n",
        [
          `Title: ${f.title}`,
          `Severity: ${f.severity} · CWE-${f.cwe}`,
          `Location: ${f.location ?? "n/a"}`,
          `Status: ${f.status}`,
          `Description: ${truncate(f.description ?? "", 3000)}`,
          `Remediation hint: ${truncate(f.remediation ?? "", 2000)}`,
        ].join("\n"),
      );
    }
  }

  if (
    convScanType &&
    convScanType !== SHIELD_ADVISOR_GLOBAL_SCAN_TYPE &&
    convScanId &&
    convScanId !== SHIELD_ADVISOR_GLOBAL_SCAN_ID
  ) {
    const line = await loadScanSummaryLine(storage, userId, convScanType, convScanId);
    if (line) {
      parts.push("\n## Scan context\n", line);
    }
  }

  if (input.extraContext?.trim()) {
    parts.push("\n## Additional context (user-supplied)\n", truncate(input.extraContext.trim(), 6000));
  }

  if (!findingLoaded && convFindingId !== SHIELD_ADVISOR_GLOBAL_FINDING_ID) {
    convFindingId = SHIELD_ADVISOR_GLOBAL_FINDING_ID;
    convScanType = SHIELD_ADVISOR_GLOBAL_SCAN_TYPE;
    convScanId = SHIELD_ADVISOR_GLOBAL_SCAN_ID;
  }

  return {
    convFindingId,
    convScanType,
    convScanId,
    systemPrompt: parts.join("\n"),
  };
}

function demoReply(userMessage: string): string {
  return [
    "Shield Advisor (demo mode): live LLM calls are skipped in development demo.",
    "Configure API keys for your chosen model in the server environment to enable real answers in non-demo runs.",
    `Your message (${userMessage.length} chars): ${truncate(userMessage, 280)}`,
  ].join(" ");
}

async function callOpenAI(systemPrompt: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const client = new OpenAI({ apiKey: key });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content } as const)),
    { role: "user", content: userMessage },
  ];
  const out = await client.chat.completions.create({
    model: process.env.AITHON_OPENAI_MODEL ?? "gpt-4o-mini",
    messages,
    temperature: 0.35,
  });
  const text = out.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}

async function callAnthropic(systemPrompt: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey: key });
  const msgs: Anthropic.MessageParam[] = [];
  for (const h of history) {
    msgs.push({ role: h.role, content: h.content });
  }
  msgs.push({ role: "user", content: userMessage });
  const out = await client.messages.create({
    model: process.env.AITHON_ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    system: systemPrompt,
    messages: msgs,
  });
  const block = out.content[0];
  if (block?.type !== "text") throw new Error("Unexpected Anthropic response");
  return block.text.trim();
}

async function callGemini(systemPrompt: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key?.trim()) throw new Error("GOOGLE_AI_API_KEY (or GEMINI_API_KEY) is not set");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: process.env.AITHON_GEMINI_MODEL ?? "gemini-1.5-flash",
    systemInstruction: systemPrompt,
  });
  const chat = model.startChat({
    history: history.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    })),
  });
  const result = await chat.sendMessage(userMessage);
  const text = result.response.text()?.trim();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

async function callMistral(systemPrompt: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key?.trim()) throw new Error("MISTRAL_API_KEY is not set");
  const client = new Mistral({ apiKey: key });
  const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];
  const out = await client.chat.complete({
    model: process.env.AITHON_MISTRAL_MODEL ?? "mistral-small-latest",
    messages,
    temperature: 0.35,
  });
  const raw = out.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw.map((c: { type?: string; text?: string }) => c.text ?? "").join("").trim() : "";
  if (!text) throw new Error("Empty response from Mistral");
  return text;
}

async function callLlama(systemPrompt: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const base = process.env.AITHON_LLAMA_BASE_URL;
  const key = process.env.AITHON_LLAMA_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!base?.trim()) throw new Error("AITHON_LLAMA_BASE_URL is not set");
  if (!key?.trim()) throw new Error("AITHON_LLAMA_API_KEY or OPENAI_API_KEY is not set for Llama-compatible endpoint");
  const client = new OpenAI({
    apiKey: key,
    baseURL: base.replace(/\/$/, ""),
  });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content } as const)),
    { role: "user", content: userMessage },
  ];
  const out = await client.chat.completions.create({
    model: process.env.AITHON_LLAMA_MODEL ?? "llama-3.1-8b-instant",
    messages,
    temperature: 0.35,
  });
  const text = out.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from Llama-compatible endpoint");
  return text;
}

async function callBedrock(systemPrompt: string, history: ChatTurn[], userMessage: string): Promise<string> {
  const modelId =
    process.env.AITHON_BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0";
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  const client = new BedrockRuntimeClient({ region });
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-06-01",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });
  const out = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    }),
  );
  const raw = new TextDecoder().decode(out.body);
  const parsed = JSON.parse(raw) as { content?: { type: string; text?: string }[] };
  const text = parsed.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) throw new Error("Empty response from Bedrock");
  return text;
}

export async function runShieldAdvisorModel(
  provider: string,
  systemPrompt: string,
  history: ChatTurn[],
  userMessage: string,
): Promise<string> {
  if (isDemoMode()) {
    return demoReply(userMessage);
  }
  const p = (provider || "openai").toLowerCase();
  switch (p) {
    case "openai":
      return callOpenAI(systemPrompt, history, userMessage);
    case "anthropic":
      return callAnthropic(systemPrompt, history, userMessage);
    case "gemini":
      return callGemini(systemPrompt, history, userMessage);
    case "mistral":
      return callMistral(systemPrompt, history, userMessage);
    case "llama":
      return callLlama(systemPrompt, history, userMessage);
    case "bedrock":
      return callBedrock(systemPrompt, history, userMessage);
    default:
      return callOpenAI(systemPrompt, history, userMessage);
  }
}
