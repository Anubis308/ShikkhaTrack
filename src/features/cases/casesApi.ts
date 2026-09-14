import { blocksClient } from "../../lib/blocks/client";
import {
  asBoolean,
  asStringArray,
  assertMutationAccepted,
  fieldValue,
  normalizeList,
  optionalRecordId,
  recordId,
  type GatewayRecord
} from "../../lib/data/gateway";
import {
  CASE_CATEGORIES,
  CASE_CHANNELS,
  CASE_PRIORITIES,
  CASE_STATUSES,
  REPEAT_ESCALATION_THRESHOLD,
  REPEAT_WINDOW_DAYS,
  isAcademicOnly,
  type AppRole,
  type CaseCategory,
  type CaseChannel,
  type CasePriority,
  type CaseStatus
} from "../../lib/roles";

export type SupportCase = GatewayRecord;
export type CaseMessage = GatewayRecord;

export const CASE_FIELDS = [
  "StudentId", "BatchId", "RawMessage", "Channel", "Category", "Priority", "HardshipFlag",
  "Status", "AssigneeUserId", "RepeatCaseCountInWindow", "IsRepeatEscalation",
  "FirstResponseAt", "ResolvedAt", "AiClassified", "AttachmentFileIds", "CreatedDate", "CreatedBy"
];

export const MESSAGE_FIELDS = ["CaseId", "Message", "IsAiGenerated", "IsHumanEdited", "SenderRole", "SentAt", "CreatedDate", "CreatedBy"];

const cases = blocksClient.data.collection<SupportCase>("SupportCase", { fields: CASE_FIELDS });
const messages = blocksClient.data.collection<CaseMessage>("CaseMessage", { fields: MESSAGE_FIELDS });

export function caseStatus(item: SupportCase): CaseStatus {
  const value = fieldValue(item, "Status", "status", "Open");
  return (CASE_STATUSES as readonly string[]).includes(value) ? value as CaseStatus : "Open";
}

export function caseChannel(item: SupportCase): CaseChannel {
  const value = fieldValue(item, "Channel", "channel", "Other");
  return (CASE_CHANNELS as readonly string[]).includes(value) ? value as CaseChannel : "Other";
}

export function casePriority(item: SupportCase): CasePriority {
  const value = fieldValue(item, "Priority", "priority", "Normal");
  return (CASE_PRIORITIES as readonly string[]).includes(value) ? value as CasePriority : "Normal";
}

export function caseCategories(item: SupportCase): CaseCategory[] {
  return asStringArray(fieldValue(item, "Category", "category", [])).filter((value): value is CaseCategory =>
    (CASE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function caseHardship(item: SupportCase): boolean {
  return asBoolean(fieldValue(item, "HardshipFlag", "hardshipFlag", false));
}

export function canViewCase(item: SupportCase, role?: AppRole, studentId?: string, teacherBatchId?: string): boolean {
  if (!role) return false;
  if (role === "SupportStaff" || role === "BranchManager") return true;
  if (role === "Student") return fieldValue(item, "StudentId", "studentId", "") === studentId;
  if (role === "Teacher") {
    if (teacherBatchId && fieldValue(item, "BatchId", "batchId", "") !== teacherBatchId) return false;
    return isAcademicOnly(caseCategories(item), caseHardship(item));
  }
  return false;
}

export async function listCases(filter: Record<string, unknown> = {}): Promise<SupportCase[]> {
  let response: unknown;
  try {
    response = await cases.list({ pageNo: 1, pageSize: 200, filter, sort: { CreatedDate: -1 } });
  } catch {
    response = await cases.list({ pageNo: 1, pageSize: 200, sort: { CreatedDate: -1 } });
  }
  return normalizeList<SupportCase>(response).items;
}

export async function listVisibleCases(role?: AppRole, studentId?: string, teacherBatchId?: string): Promise<SupportCase[]> {
  const filter: Record<string, unknown> = {};
  if (role === "Student" && studentId) filter.StudentId = studentId;
  if (role === "Teacher" && teacherBatchId) filter.BatchId = teacherBatchId;
  const items = await listCases(filter);
  return items.filter((item) => canViewCase(item, role, studentId, teacherBatchId));
}

export async function getCase(id: string): Promise<SupportCase> {
  const response = await cases.get(id);
  const item = normalizeList<SupportCase>(response).items[0] ?? (response as SupportCase);
  if (!optionalRecordId(item)) throw new Error("Case not found.");
  return item;
}

export async function countStudentCasesInWindow(studentId: string, now = Date.now()): Promise<number> {
  const cutoff = now - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const items = await listCases({ StudentId: studentId });
  return items.filter((item) => {
    const created = Date.parse(fieldValue(item, "CreatedDate", "createdDate", ""));
    return Number.isFinite(created) && created >= cutoff;
  }).length;
}

export async function createCase(input: {
  StudentId: string;
  BatchId: string;
  RawMessage: string;
  Channel: CaseChannel;
  Category: CaseCategory[];
  Priority: CasePriority;
  HardshipFlag: boolean;
  Status: CaseStatus;
  AssigneeUserId: string;
  RepeatCaseCountInWindow: number;
  IsRepeatEscalation: boolean;
  AiClassified: boolean;
  AttachmentFileIds?: string[];
}): Promise<string> {
  const itemId = assertMutationAccepted(await cases.create(input));
  if (!itemId) throw new Error("Case was created but no id was returned.");
  return itemId;
}

export async function updateCase(id: string, input: Record<string, unknown>): Promise<void> {
  assertMutationAccepted(await cases.update(id, input));
}

export async function listMessages(caseId: string): Promise<CaseMessage[]> {
  const response = await messages.list({ pageNo: 1, pageSize: 200, filter: { CaseId: caseId }, sort: { SentAt: 1 } });
  const items = normalizeList<CaseMessage>(response).items;
  return [...items].sort((a, b) => Date.parse(fieldValue(a, "SentAt", "sentAt", "")) - Date.parse(fieldValue(b, "SentAt", "sentAt", "")));
}

export async function createMessage(input: {
  CaseId: string;
  Message: string;
  IsAiGenerated: boolean;
  IsHumanEdited: boolean;
  SenderRole: AppRole;
  SentAt: string;
}): Promise<string | undefined> {
  return assertMutationAccepted(await messages.create(input));
}

export async function sendCaseReply(options: {
  caseItem: SupportCase;
  message: string;
  role: AppRole;
  isAiGenerated: boolean;
  isHumanEdited: boolean;
}): Promise<void> {
  const caseId = recordId(options.caseItem);
  const sentAt = new Date().toISOString();
  await createMessage({
    CaseId: caseId,
    Message: options.message,
    IsAiGenerated: options.isAiGenerated,
    IsHumanEdited: options.isHumanEdited,
    SenderRole: options.role,
    SentAt: sentAt
  });
  if (!fieldValue(options.caseItem, "FirstResponseAt", "firstResponseAt", "") && options.role !== "Student") {
    await updateCase(caseId, { FirstResponseAt: sentAt, Status: caseStatus(options.caseItem) === "Open" ? "InProgress" : caseStatus(options.caseItem) });
  }
}

export async function resolveCase(id: string): Promise<void> {
  await updateCase(id, { Status: "Resolved", ResolvedAt: new Date().toISOString() });
}

export function repeatCountForNewCase(existingInWindow: number): { count: number; escalate: boolean } {
  const count = existingInWindow + 1;
  return { count, escalate: count >= REPEAT_ESCALATION_THRESHOLD };
}

export function firstResponseMinutes(item: SupportCase): number | undefined {
  const created = Date.parse(fieldValue(item, "CreatedDate", "createdDate", ""));
  const first = Date.parse(fieldValue(item, "FirstResponseAt", "firstResponseAt", ""));
  if (!Number.isFinite(created) || !Number.isFinite(first) || first < created) return undefined;
  return Math.round((first - created) / 60000);
}

export { recordId as caseRecordId, fieldValue, asBoolean, REPEAT_WINDOW_DAYS, REPEAT_ESCALATION_THRESHOLD };
