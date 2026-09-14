import { blocksClient } from "../../lib/blocks/client";
import { blocksConfig } from "../../lib/blocks/config";
import { assertMutationAccepted, fieldValue, normalizeList, type GatewayRecord } from "../../lib/data/gateway";
import { CASE_CATEGORIES, CASE_PRIORITIES, type CaseCategory, type CasePriority } from "../../lib/roles";
import { policySnippetText } from "./policySnippets";

export const AI_WEBHOOK_URL_MISSING = "AI_WEBHOOK_URL_MISSING";
export const OPENAI_RATE_LIMIT = "OPENAI_RATE_LIMIT";
export const AI_HOUR_MS = 60 * 60 * 1000;
export const AI_HOURLY_LIMIT = 30;
export const AI_MODEL = "blocks-agent";

export type AiCallType = "Classify" | "DraftReply" | "AtRisk";
export type AiCallLog = GatewayRecord;

const LOG_FIELDS = ["CallType", "RelatedCaseId", "CalledByUserId", "CalledAt", "Model", "CreatedDate"];
const logs = blocksClient.data.collection<AiCallLog>("AiCallLog", { fields: LOG_FIELDS });

export type ClassifyResult = {
  categories: CaseCategory[];
  priority: CasePriority;
  hardshipFlag: boolean;
  rationale: string;
};

export type AtRiskResult = {
  score: number;
  level: "Low" | "Medium" | "High";
  reasoning: string;
};

type WorkflowWebhookResponse = {
  executionId?: string;
  status?: string;
  data?: unknown;
};

function webhookUrl(): string {
  const url = import.meta.env.VITE_AI_WORKFLOW_WEBHOOK_URL as string | undefined;
  if (!url?.trim()) {
    const error = new Error(AI_WEBHOOK_URL_MISSING);
    error.name = AI_WEBHOOK_URL_MISSING;
    throw error;
  }
  return url.trim();
}

function composePrompt(system: string, user: string): string {
  return `${system}

User input:
${user}

Respond with ONLY a single valid JSON object matching the schema requested above. No prose, no markdown code fences, no extra keys.`;
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseAgentJson<T>(data: unknown): T {
  if (data && typeof data === "object") return data as T;
  if (typeof data !== "string" || !data.trim()) throw new Error("AI agent returned an empty reply.");
  try {
    return JSON.parse(stripMarkdownFences(data)) as T;
  } catch {
    throw new Error("AI agent did not return valid JSON.");
  }
}

export async function countRecentAiCalls(withinMs = AI_HOUR_MS): Promise<number> {
  try {
    const response = await logs.list({ pageNo: 1, pageSize: 50, sort: { CalledAt: -1 } });
    const cutoff = Date.now() - withinMs;
    return normalizeList<AiCallLog>(response).items.filter((item) => {
      const calledAt = Date.parse(fieldValue(item, "CalledAt", "calledAt", ""));
      return Number.isFinite(calledAt) && calledAt >= cutoff;
    }).length;
  } catch (error) {
    console.warn("AI call ledger read failed.", error);
    return 0;
  }
}

async function writeCallLog(input: { CallType: AiCallType; RelatedCaseId?: string; CalledByUserId: string }): Promise<void> {
  try {
    const response = await logs.create({
      CallType: input.CallType,
      RelatedCaseId: input.RelatedCaseId ?? "",
      CalledByUserId: input.CalledByUserId,
      CalledAt: new Date().toISOString(),
      Model: AI_MODEL
    });
    assertMutationAccepted(response);
  } catch (error) {
    console.warn("AI call log write skipped.", error);
  }
}

async function ensureBudget(): Promise<void> {
  const recent = await countRecentAiCalls();
  if (recent >= AI_HOURLY_LIMIT) {
    const error = new Error(OPENAI_RATE_LIMIT);
    error.name = OPENAI_RATE_LIMIT;
    throw error;
  }
}

async function chatJson<T>(system: string, user: string): Promise<T> {
  await ensureBudget();
  const response = await fetch(webhookUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-blocks-key": blocksConfig.xBlocksKey
    },
    body: JSON.stringify({ prompt: composePrompt(system, user) })
  });
  const body = (await response.json().catch(() => ({}))) as WorkflowWebhookResponse & { message?: string };
  if (!response.ok) {
    throw new Error(body.message || `${response.status} ${response.statusText}` || "AI workflow request failed.");
  }
  if (body.status !== "Completed") {
    throw new Error(body.status?.trim() || "AI workflow did not complete.");
  }
  return parseAgentJson<T>(body.data);
}

function normalizeCategories(value: unknown): CaseCategory[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const allowed = new Set<string>(CASE_CATEGORIES);
  const unique = [...new Set(raw.map((item) => String(item)))].filter((item): item is CaseCategory => allowed.has(item));
  return unique.length ? unique : ["Other"];
}

function normalizePriority(value: unknown): CasePriority {
  const text = String(value ?? "Normal");
  return (CASE_PRIORITIES as readonly string[]).includes(text) ? text as CasePriority : "Normal";
}

export async function classifyMessage(rawMessage: string, calledByUserId: string, relatedCaseId?: string): Promise<ClassifyResult> {
  const parsed = await chatJson<{
    categories?: unknown;
    priority?: unknown;
    hardshipFlag?: unknown;
    rationale?: unknown;
  }>(
    `You classify coaching-centre student support messages. Return JSON with keys: categories (array from ${CASE_CATEGORIES.join(", ")}), priority (Low|Normal|High), hardshipFlag (boolean), rationale (short English sentence). Flag hardship when a parent is ill, a family emergency, or the student cannot pay on time for a serious reason. A message can have more than one category.`,
    rawMessage
  );
  await writeCallLog({ CallType: "Classify", CalledByUserId: calledByUserId, RelatedCaseId: relatedCaseId });
  return {
    categories: normalizeCategories(parsed.categories),
    priority: normalizePriority(parsed.priority),
    hardshipFlag: Boolean(parsed.hardshipFlag),
    rationale: String(parsed.rationale ?? "")
  };
}

export async function draftReply(input: {
  rawMessage: string;
  categories: CaseCategory[];
  hardshipFlag: boolean;
  isRepeatEscalation: boolean;
  studentName: string;
  roll: string;
  calledByUserId: string;
  relatedCaseId?: string;
}): Promise<string> {
  const parsed = await chatJson<{ reply?: unknown }>(
    `You draft short, warm, professional English replies for a Mirpur coaching centre support desk. Ground the reply in these policies:\n\n${policySnippetText()}\n\nIf hardshipFlag is true, do not use a canned refusal; cite the hardship-extension policy and leave a blank for the new due date if needed. If this is a third case in six weeks, ask for a personal follow-up rather than sending another template. Return JSON { "reply": "..." }. Staff will edit before sending.`,
    JSON.stringify({
      studentName: input.studentName,
      roll: input.roll,
      categories: input.categories,
      hardshipFlag: input.hardshipFlag,
      isRepeatEscalation: input.isRepeatEscalation,
      message: input.rawMessage
    })
  );
  await writeCallLog({ CallType: "DraftReply", CalledByUserId: input.calledByUserId, RelatedCaseId: input.relatedCaseId });
  const reply = String(parsed.reply ?? "").trim();
  if (!reply) throw new Error("AI agent returned an empty draft.");
  return reply;
}

export async function scoreAtRisk(input: {
  studentName: string;
  roll: string;
  caseSummaries: string;
  calledByUserId: string;
}): Promise<AtRiskResult> {
  const parsed = await chatJson<{ score?: unknown; level?: unknown; reasoning?: unknown }>(
    `You score quietly disengaging coaching-centre students before renewal. Combine repeat cases, hardship flags, fee mentions, and slipping attendance mentions into one signal. Return JSON { "score": 0-100 integer, "level": "Low"|"Medium"|"High", "reasoning": "one or two sentences" }. High means staff should intervene personally.`,
    JSON.stringify({ studentName: input.studentName, roll: input.roll, history: input.caseSummaries })
  );
  await writeCallLog({ CallType: "AtRisk", CalledByUserId: input.calledByUserId });
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
  const levelRaw = String(parsed.level ?? "Low");
  const level = levelRaw === "High" || levelRaw === "Medium" ? levelRaw : "Low";
  return { score, level, reasoning: String(parsed.reasoning ?? "") };
}

export function aiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === AI_WEBHOOK_URL_MISSING) {
    return "Set VITE_AI_WORKFLOW_WEBHOOK_URL in .env to use AI classify and draft.";
  }
  if (error instanceof Error && error.name === OPENAI_RATE_LIMIT) {
    return `Hourly AI call cap (${AI_HOURLY_LIMIT}) reached. Try again later.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
