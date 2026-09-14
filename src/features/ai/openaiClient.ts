import { blocksClient } from "../../lib/blocks/client";
import { assertMutationAccepted, fieldValue, normalizeList, type GatewayRecord } from "../../lib/data/gateway";
import { CASE_CATEGORIES, CASE_PRIORITIES, type CaseCategory, type CasePriority } from "../../lib/roles";
import { policySnippetText } from "./policySnippets";

export const OPENAI_API_KEY_MISSING = "OPENAI_API_KEY_MISSING";
export const OPENAI_RATE_LIMIT = "OPENAI_RATE_LIMIT";
export const AI_HOUR_MS = 60 * 60 * 1000;
export const AI_HOURLY_LIMIT = 30;
export const AI_MODEL = "gpt-4o-mini";

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

function openaiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  if (!key) {
    const error = new Error(OPENAI_API_KEY_MISSING);
    error.name = OPENAI_API_KEY_MISSING;
    throw error;
  }
  return key;
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
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body
      ? String((body as { error?: { message?: string } }).error?.message || response.statusText)
      : `${response.status} ${response.statusText}`;
    throw new Error(message || "OpenAI request failed.");
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenAI returned an empty reply.");
  return JSON.parse(content) as T;
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
  if (!reply) throw new Error("OpenAI returned an empty draft.");
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
  if (error instanceof Error && error.name === OPENAI_API_KEY_MISSING) {
    return "Set VITE_OPENAI_API_KEY in .env to use AI classify and draft.";
  }
  if (error instanceof Error && error.name === OPENAI_RATE_LIMIT) {
    return `Hourly AI call cap (${AI_HOURLY_LIMIT}) reached. Try again later.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
