import { createCase, listCases } from "../cases/casesApi";
import { createBatch, createStudent, listBatches, listStudents } from "../profiles/profilesApi";

export const DEMO_ROLL = "HSC-1187";

export const DEMO_BATCHES = [
  { Name: "HSC-26 Science", Category: "HSC" },
  { Name: "Medical Admission", Category: "Admission" },
  { Name: "BCS Written", Category: "BCS" },
  { Name: "HSC-26 Business", Category: "HSC" },
  { Name: "Engineering Admission", Category: "Admission" },
  { Name: "Bank Job Prep", Category: "Other" }
] as const;

const DEMO_MESSAGE = "sir ami 3 din class miss korechi, baba hospital e, installment ta 5 tarikh e dite parbo na, ar physics er sir recording di na — roll HSC-1187";

export async function seedDemoData(assigneeUserId: string): Promise<{ batchCount: number; studentCount: number; caseCount: number }> {
  const existingBatches = await listBatches();
  const batchIds: Record<string, string> = {};
  for (const batch of existingBatches) {
    const name = String(batch.Name ?? batch.name ?? "");
    const id = String(batch.ItemId ?? batch.itemId ?? "");
    if (name && id) batchIds[name] = id;
  }

  let batchCount = 0;
  for (const batch of DEMO_BATCHES) {
    if (batchIds[batch.Name]) continue;
    const id = await createBatch({ ...batch, IsActive: true });
    if (id) {
      batchIds[batch.Name] = id;
      batchCount += 1;
    }
  }

  const scienceId = batchIds["HSC-26 Science"] ?? "";
  const medicalId = batchIds["Medical Admission"] ?? scienceId;
  const existingStudents = await listStudents();
  const byRoll = new Map(existingStudents.map((student) => [String(student.Roll ?? student.roll ?? ""), student]));

  async function ensureStudent(roll: string, name: string, batchId: string) {
    if (byRoll.has(roll)) return String(byRoll.get(roll)?.ItemId ?? byRoll.get(roll)?.itemId ?? "");
    const id = await createStudent({ Roll: roll, FullName: name, BatchId: batchId, GuardianPhone: "" });
    return id ?? "";
  }

  const rahimId = await ensureStudent(DEMO_ROLL, "Rahim Uddin", scienceId);
  await ensureStudent("HSC-2201", "Ayesha Karim", scienceId);
  await ensureStudent("MED-104", "Farhan Chowdhury", medicalId);

  let caseCount = 0;
  if (rahimId) {
    const existing = await listCases({ StudentId: rahimId });
    if (existing.length === 0) {
      await createCase({
        StudentId: rahimId,
        BatchId: scienceId,
        RawMessage: "When is the next physics model test? Roll HSC-1187",
        Channel: "Facebook",
        Category: ["ExamSchedule"],
        Priority: "Normal",
        HardshipFlag: false,
        Status: "Resolved",
        AssigneeUserId: assigneeUserId,
        RepeatCaseCountInWindow: 1,
        IsRepeatEscalation: false,
        AiClassified: false
      });
      await createCase({
        StudentId: rahimId,
        BatchId: scienceId,
        RawMessage: "Missed chemistry class, need the recording please. HSC-1187",
        Channel: "Phone",
        Category: ["ClassAccess"],
        Priority: "Normal",
        HardshipFlag: false,
        Status: "Resolved",
        AssigneeUserId: assigneeUserId,
        RepeatCaseCountInWindow: 2,
        IsRepeatEscalation: false,
        AiClassified: false
      });
      await createCase({
        StudentId: rahimId,
        BatchId: scienceId,
        RawMessage: DEMO_MESSAGE,
        Channel: "Facebook",
        Category: ["Fees", "ClassAccess"],
        Priority: "High",
        HardshipFlag: true,
        Status: "Open",
        AssigneeUserId: assigneeUserId,
        RepeatCaseCountInWindow: 3,
        IsRepeatEscalation: true,
        AiClassified: true
      });
      caseCount = 3;
    }
  }

  return { batchCount, studentCount: byRoll.has(DEMO_ROLL) ? 0 : 3, caseCount };
}
