import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRole } from "../../app/providers/RoleProvider";
import { Alert } from "../../shared/ui/Alert";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { StatusPill } from "../../shared/ui/StatusPill";
import { TextAreaField } from "../../shared/ui/FormField";
import { CATEGORY_LABELS, CHANNEL_LABELS, ROLE_LABELS, STATUS_LABELS, canManageCases, type AppRole } from "../../lib/roles";
import { asBoolean, fieldValue } from "../../lib/data/gateway";
import {
  canViewCase,
  caseCategories,
  caseChannel,
  caseHardship,
  casePriority,
  caseRecordId,
  caseStatus,
  getCase,
  listMessages,
  resolveCase,
  sendCaseReply,
  updateCase
} from "./casesApi";
import { getStudent, listStaff, staffDisplayName, studentName, studentRoll } from "../profiles/profilesApi";

export function CaseDetailPage({ id, onNavigate }: { id: string; onNavigate: (path: string) => void }) {
  const { role, studentId, batchId, userIds } = useRole();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | undefined>();

  const caseQuery = useQuery({ queryFn: () => getCase(id), queryKey: ["case", id] });
  const messagesQuery = useQuery({ queryFn: () => listMessages(id), queryKey: ["messages", id] });
  const studentQuery = useQuery({
    enabled: Boolean(caseQuery.data),
    queryFn: () => getStudent(fieldValue(caseQuery.data!, "StudentId", "studentId", "")),
    queryKey: ["student", caseQuery.data ? fieldValue(caseQuery.data, "StudentId", "studentId", "") : ""]
  });
  const staffQuery = useQuery({ queryFn: listStaff, queryKey: ["staff"] });

  const visible = caseQuery.data ? canViewCase(caseQuery.data, role, studentId, batchId) : true;
  const item = caseQuery.data;

  const send = useMutation({
    mutationFn: async () => {
      if (!item || !role || !reply.trim()) throw new Error("Write a reply first.");
      await sendCaseReply({
        caseItem: item,
        message: reply.trim(),
        role,
        isAiGenerated: false,
        isHumanEdited: false
      });
    },
    onSuccess: async () => {
      setReply("");
      await queryClient.invalidateQueries({ queryKey: ["messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["case", id] });
    },
    onError: (caught) => setError((caught as Error).message)
  });

  if (caseQuery.isError) return <EmptyState title="Could not load case" description={(caseQuery.error as Error).message} />;
  if (!item) return <section><PageHeader title="Case" subtitle="Loading..." /></section>;
  if (!visible) {
    return (
      <section>
        <PageHeader title="Not available" subtitle="This case is outside your batch or category scope." />
        <Alert tone="warn">Teachers only see academic cases for their own batch. Students only see their own requests.</Alert>
      </section>
    );
  }

  const assignee = (staffQuery.data ?? []).find((profile) => fieldValue(profile, "UserId", "userId", "").toLowerCase() === fieldValue(item, "AssigneeUserId", "assigneeUserId", "").toLowerCase());
  const studentLabel = studentQuery.data ? `${studentRoll(studentQuery.data)} · ${studentName(studentQuery.data)}` : fieldValue(item, "StudentId", "studentId", "");

  return (
    <section>
      <PageHeader
        title={studentLabel}
        subtitle={`${CHANNEL_LABELS[caseChannel(item)]} · ${caseCategories(item).map((entry) => CATEGORY_LABELS[entry]).join(", ") || "Uncategorized"}`}
        actions={
          canManageCases(role) && caseStatus(item) !== "Resolved" ? (
            <button className="primary-button" onClick={() => resolveCase(caseRecordId(item)).then(() => queryClient.invalidateQueries({ queryKey: ["case", id] }))} type="button">
              Mark resolved
            </button>
          ) : null
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {caseHardship(item) ? <Alert tone="warn">Hardship case — needs human judgment, not a template.</Alert> : null}
      {asBoolean(fieldValue(item, "IsRepeatEscalation", "isRepeatEscalation", false)) ? (
        <Alert tone="warn">Repeat requester: case {fieldValue(item, "RepeatCaseCountInWindow", "repeatCaseCountInWindow", "3")} in six weeks. Offer a personal follow-up.</Alert>
      ) : null}

      <div className="chips">
        <StatusPill tone={caseStatus(item) === "Resolved" ? "good" : "neutral"}>{STATUS_LABELS[caseStatus(item)]}</StatusPill>
        <StatusPill tone={casePriority(item) === "High" ? "warn" : "neutral"}>{casePriority(item)}</StatusPill>
        {assignee ? <span className="chip">Assigned: {staffDisplayName(assignee)}</span> : null}
      </div>

      <div className="panel">
        <div className="panel-title">Original request</div>
        <p>{fieldValue(item, "RawMessage", "rawMessage", "")}</p>
      </div>

      <div className="thread">
        {(messagesQuery.data ?? []).map((message) => (
          <article className="thread-item" key={String(message.ItemId ?? message.itemId)}>
            <header>
              <strong>{ROLE_LABELS[(fieldValue(message, "SenderRole", "senderRole", "SupportStaff") as AppRole)] ?? "Staff"}</strong>
              <span className="muted">{fieldValue(message, "SentAt", "sentAt", "")}</span>
              {asBoolean(fieldValue(message, "IsAiGenerated", "isAiGenerated", false)) ? <StatusPill tone="neutral">AI-assisted</StatusPill> : null}
              {asBoolean(fieldValue(message, "IsHumanEdited", "isHumanEdited", false)) ? <StatusPill tone="good">Human-corrected</StatusPill> : null}
            </header>
            <p>{fieldValue(message, "Message", "message", "")}</p>
          </article>
        ))}
      </div>

      {role ? (
        <div className="panel">
          <TextAreaField label={role === "Student" ? "Follow-up" : "Reply"} onChange={(event) => setReply(event.target.value)} rows={5} value={reply} />
          <div className="form-actions">
            {canManageCases(role) ? (
              <SelectAssignee
                current={fieldValue(item, "AssigneeUserId", "assigneeUserId", "")}
                onChange={(value) => updateCase(caseRecordId(item), { AssigneeUserId: value }).then(() => queryClient.invalidateQueries({ queryKey: ["case", id] }))}
                staff={staffQuery.data ?? []}
              />
            ) : null}
            <button className="primary-button" disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()} type="button">
              {send.isPending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SelectAssignee({
  current,
  onChange,
  staff
}: {
  current: string;
  onChange: (value: string) => void;
  staff: { ItemId?: string; UserId?: string; userId?: string; DisplayName?: string; displayName?: string }[];
}) {
  return (
    <label className="form-field">
      <span>Assignee</span>
      <select onChange={(event) => onChange(event.target.value)} value={current}>
        <option value="">Unassigned</option>
        {staff.map((profile) => {
          const userId = String(profile.UserId ?? profile.userId ?? "");
          return <option key={userId} value={userId}>{String(profile.DisplayName ?? profile.displayName ?? userId)}</option>;
        })}
      </select>
    </label>
  );
}
