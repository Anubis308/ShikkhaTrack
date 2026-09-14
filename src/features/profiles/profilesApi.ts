import { blocksClient } from "../../lib/blocks/client";
import {
  asBoolean,
  assertMutationAccepted,
  fieldValue,
  normalizeList,
  normalizeUserId,
  optionalRecordId,
  recordId,
  type GatewayRecord
} from "../../lib/data/gateway";
import type { AppRole } from "../../lib/roles";

export type Batch = GatewayRecord;
export type StudentProfile = GatewayRecord;
export type StaffProfile = GatewayRecord;

const BATCH_FIELDS = ["Name", "Category", "IsActive", "CreatedDate"];
const STUDENT_FIELDS = ["Roll", "FullName", "BatchId", "GuardianPhone", "UserId", "CreatedDate"];
const STAFF_FIELDS = ["UserId", "Role", "BatchId", "DisplayName", "CreatedDate"];

const batches = blocksClient.data.collection<Batch>("Batch", { fields: BATCH_FIELDS });
const students = blocksClient.data.collection<StudentProfile>("StudentProfile", { fields: STUDENT_FIELDS });
const staff = blocksClient.data.collection<StaffProfile>("StaffProfile", { fields: STAFF_FIELDS });

export function batchName(batch: Batch): string {
  return fieldValue(batch, "Name", "name", "");
}

export function studentRoll(student: StudentProfile): string {
  return fieldValue(student, "Roll", "roll", "");
}

export function studentName(student: StudentProfile): string {
  return fieldValue(student, "FullName", "fullName", "");
}

export function staffRole(profile: StaffProfile): AppRole {
  const value = fieldValue(profile, "Role", "role", "SupportStaff");
  if (value === "Teacher" || value === "BranchManager" || value === "SupportStaff") return value;
  return "SupportStaff";
}

export async function listBatches(): Promise<Batch[]> {
  const response = await batches.list({ pageNo: 1, pageSize: 100, sort: { Name: 1 } });
  return normalizeList<Batch>(response).items;
}

export async function createBatch(input: { Name: string; Category: string; IsActive: boolean }): Promise<string | undefined> {
  return assertMutationAccepted(await batches.create(input));
}

export async function listStudents(): Promise<StudentProfile[]> {
  const response = await students.list({ pageNo: 1, pageSize: 200, sort: { Roll: 1 } });
  return normalizeList<StudentProfile>(response).items;
}

export async function searchStudents(query: string): Promise<StudentProfile[]> {
  const needle = query.trim().toLowerCase();
  const all = await listStudents();
  if (!needle) return all;
  return all.filter((student) => {
    const haystack = `${studentRoll(student)} ${studentName(student)}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export async function getStudent(id: string): Promise<StudentProfile | undefined> {
  try {
    const response = await students.get(id);
    return normalizeList<StudentProfile>(response).items[0] ?? (response as StudentProfile);
  } catch {
    const all = await listStudents();
    return all.find((item) => optionalRecordId(item) === id);
  }
}

export async function findStudentByRoll(roll: string): Promise<StudentProfile | undefined> {
  const response = await students.list({ pageNo: 1, pageSize: 10, filter: { Roll: roll } });
  const items = normalizeList<StudentProfile>(response).items;
  return items.find((item) => studentRoll(item).toLowerCase() === roll.trim().toLowerCase()) ?? items[0];
}

export async function findStudentByUserId(userIds: string[]): Promise<StudentProfile | undefined> {
  const candidates = userIds.map(normalizeUserId).filter(Boolean);
  if (!candidates.length) return undefined;
  try {
    const response = await students.list({ pageNo: 1, pageSize: 20, filter: { UserId: candidates[0] } });
    const match = normalizeList<StudentProfile>(response).items.find((item) => candidates.includes(normalizeUserId(fieldValue(item, "UserId", "userId", ""))));
    if (match) return match;
  } catch {
    // Fall through to a full list scan when the gateway rejects the filter.
  }
  const all = await listStudents();
  return all.find((item) => candidates.includes(normalizeUserId(fieldValue(item, "UserId", "userId", ""))));
}

export async function createStudent(input: {
  Roll: string;
  FullName: string;
  BatchId: string;
  GuardianPhone?: string;
  UserId?: string;
}): Promise<string | undefined> {
  return assertMutationAccepted(await students.create(input));
}

export async function updateStudent(id: string, input: Partial<{
  Roll: string;
  FullName: string;
  BatchId: string;
  GuardianPhone: string;
  UserId: string;
}>): Promise<void> {
  assertMutationAccepted(await students.update(id, input));
}

export async function listStaff(): Promise<StaffProfile[]> {
  const response = await staff.list({ pageNo: 1, pageSize: 100, sort: { DisplayName: 1 } });
  return normalizeList<StaffProfile>(response).items;
}

export async function findStaffByUserId(userIds: string[]): Promise<StaffProfile | undefined> {
  const candidates = userIds.map(normalizeUserId).filter(Boolean);
  if (!candidates.length) return undefined;
  try {
    const response = await staff.list({ pageNo: 1, pageSize: 20, filter: { UserId: candidates[0] } });
    const match = normalizeList<StaffProfile>(response).items.find((item) => candidates.includes(normalizeUserId(fieldValue(item, "UserId", "userId", ""))));
    if (match) return match;
  } catch {
    // Fall through.
  }
  const all = await listStaff();
  return all.find((item) => candidates.includes(normalizeUserId(fieldValue(item, "UserId", "userId", ""))));
}

export async function createStaff(input: {
  UserId: string;
  Role: Exclude<AppRole, "Student">;
  BatchId?: string;
  DisplayName: string;
}): Promise<string | undefined> {
  return assertMutationAccepted(await staff.create(input));
}

export async function updateStaff(id: string, input: Partial<{
  UserId: string;
  Role: Exclude<AppRole, "Student">;
  BatchId: string;
  DisplayName: string;
}>): Promise<void> {
  assertMutationAccepted(await staff.update(id, input));
}

export function staffDisplayName(profile: StaffProfile): string {
  return fieldValue(profile, "DisplayName", "displayName", "");
}

export function staffBatchId(profile: StaffProfile): string {
  return fieldValue(profile, "BatchId", "batchId", "");
}

export function studentBatchId(student: StudentProfile): string {
  return fieldValue(student, "BatchId", "batchId", "");
}

export { recordId as profileRecordId, optionalRecordId, fieldValue, asBoolean };
