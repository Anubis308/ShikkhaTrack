import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRole } from "../../app/providers/RoleProvider";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { PageHeader } from "../../shared/ui/PageHeader";
import { StatusPill } from "../../shared/ui/StatusPill";
import { fieldValue, optionalRecordId } from "../../lib/data/gateway";
import { aiErrorMessage, scoreAtRisk } from "../ai/openaiClient";
import { caseCategories, caseHardship, caseRecordId, caseStatus, firstResponseMinutes, listCases } from "../cases/casesApi";
import { assessmentField, assessmentStudentId, listAtRiskAssessments, upsertAtRisk } from "./atRiskApi";
import { listStaff, listStudents, staffDisplayName, studentName, studentRoll } from "../profiles/profilesApi";
import { seedDemoData } from "../seed/seedDemo";

export function ManagerDashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { userIds } = useRole();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const [seedMessage, setSeedMessage] = useState<string | undefined>();

  const casesQuery = useQuery({ queryFn: () => listCases(), queryKey: ["cases", "all"] });
  const staffQuery = useQuery({ queryFn: listStaff, queryKey: ["staff"] });
  const studentsQuery = useQuery({ queryFn: listStudents, queryKey: ["students"] });
  const atRiskQuery = useQuery({ queryFn: listAtRiskAssessments, queryKey: ["atrisk"] });

  const openCases = (casesQuery.data ?? []).filter((item) => caseStatus(item) === "Open" || caseStatus(item) === "InProgress");
  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of openCases) {
      const assignee = fieldValue(item, "AssigneeUserId", "assigneeUserId", "") || "unassigned";
      counts.set(assignee, (counts.get(assignee) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [openCases]);

  const avgFirstResponse = useMemo(() => {
    const values = (casesQuery.data ?? []).map(firstResponseMinutes).filter((value): value is number => value !== undefined);
    if (!values.length) return undefined;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [casesQuery.data]);

  const repeats = (casesQuery.data ?? []).filter((item) => Number(fieldValue(item, "RepeatCaseCountInWindow", "repeatCaseCountInWindow", 0)) >= 2);
  const uniqueRepeatStudents = [...new Set(repeats.map((item) => fieldValue(item, "StudentId", "studentId", "")))];

  const staffName = (userId: string) => {
    if (userId === "unassigned") return "Unassigned";
    const match = (staffQuery.data ?? []).find((profile) => fieldValue(profile, "UserId", "userId", "").toLowerCase() === userId.toLowerCase());
    return match ? staffDisplayName(match) : userId;
  };

  const studentLabel = (id: string) => {
    const match = (studentsQuery.data ?? []).find((student) => optionalRecordId(student) === id);
    return match ? `${studentRoll(match)} · ${studentName(match)}` : id;
  };

  const seed = useMutation({
    mutationFn: () => seedDemoData(userIds[0] || ""),
    onSuccess: async (result) => {
      setSeedMessage(`Seeded ${result.batchCount} batches, students, and ${result.caseCount} demo cases.`);
      await queryClient.invalidateQueries();
    },
    onError: (caught) => setError((caught as Error).message)
  });

  const recalculate = useMutation({
    mutationFn: async () => {
      const students = studentsQuery.data ?? [];
      const cases = casesQuery.data ?? [];
      const existing = atRiskQuery.data ?? [];
      for (const student of students) {
        const id = optionalRecordId(student);
        if (!id) continue;
        const history = cases.filter((item) => fieldValue(item, "StudentId", "studentId", "") === id);
        if (!history.length) continue;
        const summary = history.map((item) => {
          return `${caseStatus(item)} ${caseCategories(item).join("/")} hardship=${caseHardship(item)} repeats=${fieldValue(item, "RepeatCaseCountInWindow", "repeatCaseCountInWindow", "1")} :: ${fieldValue(item, "RawMessage", "rawMessage", "")}`;
        }).join("\n");
        const scored = await scoreAtRisk({
          studentName: studentName(student),
          roll: studentRoll(student),
          caseSummaries: summary,
          calledByUserId: userIds[0] || "unknown"
        });
        const prior = existing.find((item) => assessmentStudentId(item) === id);
        await upsertAtRisk({
          StudentId: id,
          Score: scored.score,
          Level: scored.level,
          Reasoning: scored.reasoning,
          existingId: prior ? optionalRecordId(prior) : undefined
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["atrisk"] });
    },
    onError: (caught) => setError(aiErrorMessage(caught, "Could not recalculate at-risk scores."))
  });

  return (
    <section>
      <PageHeader
        title="Manager dashboard"
        subtitle="Open load, first-response speed, repeat requesters, and at-risk students."
        actions={
          <div className="page-actions">
            <button className="icon-button" onClick={() => seed.mutate()} type="button">{seed.isPending ? "Seeding..." : "Seed demo data"}</button>
            <button className="primary-button" onClick={() => recalculate.mutate()} type="button">{recalculate.isPending ? "Scoring..." : "Recalculate at-risk"}</button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {seedMessage ? <Alert tone="info">{seedMessage}</Alert> : null}

      <div className="metrics">
        <div className="metric"><span>Open cases</span><strong>{openCases.length}</strong></div>
        <div className="metric"><span>Avg first response</span><strong>{avgFirstResponse !== undefined ? `${avgFirstResponse} min` : "—"}</strong></div>
        <div className="metric"><span>Repeat students</span><strong>{uniqueRepeatStudents.length}</strong></div>
        <div className="metric"><span>High at-risk</span><strong>{(atRiskQuery.data ?? []).filter((item) => assessmentField(item, "Level", "level", "") === "High").length}</strong></div>
      </div>

      <div className="panel">
        <div className="panel-title">Open cases per staff member</div>
        <DataTable
          columns={[
            { key: "staff", header: "Staff", render: (row) => staffName(row[0]) },
            { key: "count", header: "Open", render: (row) => row[1] }
          ]}
          rows={workload}
        />
      </div>

      <div className="panel">
        <div className="panel-title">Repeat students</div>
        <DataTable
          columns={[
            { key: "student", header: "Student", render: (id) => studentLabel(id) },
            {
              key: "open",
              header: "Latest case",
              render: (id) => {
                const latest = repeats.find((item) => fieldValue(item, "StudentId", "studentId", "") === id);
                return latest ? (
                  <button className="link-button" onClick={() => onNavigate(`/cases/${caseRecordId(latest)}`)} type="button">Open</button>
                ) : "—";
              }
            }
          ]}
          rows={uniqueRepeatStudents}
        />
      </div>

      <div className="panel">
        <div className="panel-title">At-risk list</div>
        <DataTable
          columns={[
            { key: "student", header: "Student", render: (row) => studentLabel(assessmentStudentId(row)) },
            { key: "score", header: "Score", render: (row) => assessmentField(row, "Score", "score", "0") },
            {
              key: "level",
              header: "Level",
              render: (row) => {
                const level = assessmentField(row, "Level", "level", "Low");
                return <StatusPill tone={level === "High" ? "warn" : "neutral"}>{level}</StatusPill>;
              }
            },
            { key: "why", header: "Why", render: (row) => assessmentField(row, "Reasoning", "reasoning", "") }
          ]}
          rows={[...(atRiskQuery.data ?? [])].sort((a, b) => Number(assessmentField(b, "Score", "score", 0)) - Number(assessmentField(a, "Score", "score", 0)))}
        />
      </div>
    </section>
  );
}
