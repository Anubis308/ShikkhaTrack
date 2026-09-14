import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useRole } from "../../app/providers/RoleProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { StatusPill } from "../../shared/ui/StatusPill";
import { CATEGORY_LABELS, CHANNEL_LABELS, STATUS_LABELS, canManageCases, type CaseStatus } from "../../lib/roles";
import { caseCategories, caseChannel, caseHardship, casePriority, caseRecordId, caseStatus, fieldValue, listVisibleCases } from "./casesApi";
import { listStudents, studentName, studentRoll } from "../profiles/profilesApi";

export function CaseInboxPage({ onNavigate, title, subtitle }: { onNavigate: (path: string) => void; subtitle?: string; title?: string }) {
  const { role, studentId, batchId } = useRole();
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("Open");
  const casesQuery = useQuery({ queryFn: () => listVisibleCases(role, studentId, batchId), queryKey: ["cases", role, studentId, batchId] });
  const studentsQuery = useQuery({ queryFn: listStudents, queryKey: ["students"] });
  const studentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of studentsQuery.data ?? []) {
      const id = String(student.ItemId ?? student.itemId ?? "");
      map.set(id, `${studentRoll(student)} · ${studentName(student)}`);
    }
    return map;
  }, [studentsQuery.data]);

  const rows = (casesQuery.data ?? []).filter((item) => statusFilter === "all" || caseStatus(item) === statusFilter);

  return (
    <section>
      <PageHeader
        title={title ?? "Case inbox"}
        subtitle={subtitle ?? "Every logged request, with who owns it and what is still open."}
        actions={canManageCases(role) ? <ActionButton onClick={() => onNavigate("/cases/new")}><Plus size={16} /> New case</ActionButton> : undefined}
      />
      <div className="toolbar">
        <label className="form-field" style={{ maxWidth: 220 }}>
          <span>Status</span>
          <select onChange={(event) => setStatusFilter(event.target.value as CaseStatus | "all")} value={statusFilter}>
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {!rows.length ? (
        <EmptyState description="Log the next Facebook DM, phone call, or corridor request as a case." title="No cases in this view" />
      ) : (
        <DataTable
          columns={[
            { key: "student", header: "Student", render: (row) => studentMap.get(fieldValue(row, "StudentId", "studentId", "")) || fieldValue(row, "StudentId", "studentId", "") },
            { key: "category", header: "Category", render: (row) => caseCategories(row).map((item) => CATEGORY_LABELS[item]).join(", ") },
            { key: "channel", header: "Channel", render: (row) => CHANNEL_LABELS[caseChannel(row)] },
            {
              key: "flags",
              header: "Flags",
              render: (row) => (
                <div className="chips">
                  {caseHardship(row) ? <StatusPill tone="warn">Hardship</StatusPill> : null}
                  {fieldValue(row, "IsRepeatEscalation", "isRepeatEscalation", false) ? <StatusPill tone="warn">Repeat</StatusPill> : null}
                  <StatusPill tone={casePriority(row) === "High" ? "warn" : "neutral"}>{casePriority(row)}</StatusPill>
                </div>
              )
            },
            { key: "status", header: "Status", render: (row) => <StatusPill tone={caseStatus(row) === "Resolved" ? "good" : "neutral"}>{STATUS_LABELS[caseStatus(row)]}</StatusPill> },
            {
              key: "open",
              header: "",
              render: (row) => <button className="link-button" onClick={() => onNavigate(`/cases/${caseRecordId(row)}`)} type="button">Open</button>
            }
          ]}
          rows={rows}
        />
      )}
    </section>
  );
}
