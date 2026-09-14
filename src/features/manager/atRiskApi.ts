import { blocksClient } from "../../lib/blocks/client";
import { assertMutationAccepted, fieldValue, normalizeList, optionalRecordId, type GatewayRecord } from "../../lib/data/gateway";

export type AtRiskAssessment = GatewayRecord;

const FIELDS = ["StudentId", "Score", "Level", "Reasoning", "ComputedAt", "CreatedDate"];
const assessments = blocksClient.data.collection<AtRiskAssessment>("AtRiskAssessment", { fields: FIELDS });

export async function listAtRiskAssessments(): Promise<AtRiskAssessment[]> {
  const response = await assessments.list({ pageNo: 1, pageSize: 200, sort: { Score: -1 } });
  return normalizeList<AtRiskAssessment>(response).items;
}

export async function upsertAtRisk(input: {
  StudentId: string;
  Score: number;
  Level: string;
  Reasoning: string;
  existingId?: string;
}): Promise<void> {
  const payload = {
    StudentId: input.StudentId,
    Score: input.Score,
    Level: input.Level,
    Reasoning: input.Reasoning,
    ComputedAt: new Date().toISOString()
  };
  const response = input.existingId
    ? await assessments.update(input.existingId, payload)
    : await assessments.create(payload);
  assertMutationAccepted(response);
}

export function assessmentStudentId(item: AtRiskAssessment): string {
  return fieldValue(item, "StudentId", "studentId", "");
}

export { optionalRecordId as assessmentId, fieldValue as assessmentField };
