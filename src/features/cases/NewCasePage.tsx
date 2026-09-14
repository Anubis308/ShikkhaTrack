import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRole } from "../../app/providers/RoleProvider";
import { Alert } from "../../shared/ui/Alert";
import { FormField, SelectField, TextAreaField } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { StatusPill } from "../../shared/ui/StatusPill";
import { CASE_CATEGORIES, CASE_CHANNELS, CASE_PRIORITIES, CATEGORY_LABELS, CHANNEL_LABELS, PRIORITY_LABELS, type CaseCategory, type CaseChannel, type CasePriority } from "../../lib/roles";
import { aiErrorMessage, classifyMessage, draftReply } from "../ai/openaiClient";
import { countStudentCasesInWindow, createCase, createMessage, repeatCountForNewCase } from "./casesApi";
import { listStudents, optionalRecordId, studentBatchId, studentName, studentRoll } from "../profiles/profilesApi";

export function NewCasePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { role, userIds } = useRole();
  const studentsQuery = useQuery({ queryFn: listStudents, queryKey: ["students"] });
  const [studentId, setStudentId] = useState("");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<CaseChannel>("Facebook");
  const [rawMessage, setRawMessage] = useState("");
  const [categories, setCategories] = useState<CaseCategory[]>(["Other"]);
  const [priority, setPriority] = useState<CasePriority>("Normal");
  const [hardship, setHardship] = useState(false);
  const [rationale, setRationale] = useState("");
  const [aiClassified, setAiClassified] = useState(false);
  const [draft, setDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [repeatCount, setRepeatCount] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (studentsQuery.data ?? []).filter((student) => {
      if (!needle) return true;
      return `${studentRoll(student)} ${studentName(student)}`.toLowerCase().includes(needle);
    });
  }, [query, studentsQuery.data]);

  const selected = (studentsQuery.data ?? []).find((student) => optionalRecordId(student) === studentId);

  const classify = useMutation({
    mutationFn: async () => {
      const result = await classifyMessage(rawMessage, userIds[0] || "unknown");
      setCategories(result.categories);
      setPriority(result.priority);
      setHardship(result.hardshipFlag);
      setRationale(result.rationale);
      setAiClassified(true);
      if (studentId) {
        const existing = await countStudentCasesInWindow(studentId);
        setRepeatCount(existing + 1);
      }
      return result;
    },
    onError: (caught) => setError(aiErrorMessage(caught, "Could not classify this message."))
  });

  const draftMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick a student first.");
      const existing = studentId ? await countStudentCasesInWindow(studentId) : 0;
      const reply = await draftReply({
        rawMessage,
        categories,
        hardshipFlag: hardship,
        isRepeatEscalation: existing + 1 >= 3,
        studentName: studentName(selected),
        roll: studentRoll(selected),
        calledByUserId: userIds[0] || "unknown"
      });
      setDraft(reply);
      setOriginalDraft(reply);
      return reply;
    },
    onError: (caught) => setError(aiErrorMessage(caught, "Could not draft a reply."))
  });

  async function onSave(sendDraft: boolean) {
    setError(undefined);
    if (!selected || !studentId) {
      setError("Select a student.");
      return;
    }
    if (!rawMessage.trim()) {
      setError("Paste the incoming message.");
      return;
    }
    try {
      const existing = await countStudentCasesInWindow(studentId);
      const { count, escalate } = repeatCountForNewCase(existing);
      const caseId = await createCase({
        StudentId: studentId,
        BatchId: studentBatchId(selected),
        RawMessage: rawMessage.trim(),
        Channel: channel,
        Category: categories,
        Priority: priority,
        HardshipFlag: hardship,
        Status: sendDraft ? "InProgress" : "Open",
        AssigneeUserId: userIds[0] || "",
        RepeatCaseCountInWindow: count,
        IsRepeatEscalation: escalate,
        AiClassified: aiClassified
      });
      if (sendDraft && draft.trim() && role) {
        await createMessage({
          CaseId: caseId,
          Message: draft.trim(),
          IsAiGenerated: Boolean(originalDraft),
          IsHumanEdited: originalDraft !== draft,
          SenderRole: role,
          SentAt: new Date().toISOString()
        });
      }
      onNavigate(`/cases/${caseId}`);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  return (
    <section>
      <PageHeader title="Log a case" subtitle="Capture the incoming request, classify it, draft a reply, then send only after a human edit." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {repeatCount && repeatCount >= 3 ? (
        <Alert tone="warn">This is case {repeatCount} for this student in six weeks. Do not send another template — offer a personal follow-up.</Alert>
      ) : null}
      {hardship ? <Alert tone="warn">Hardship flagged. Do not template this away — a human must approve the reply.</Alert> : null}

      <div className="panel">
        <FormField label="Search students" onChange={(event) => setQuery(event.target.value)} placeholder="Roll or name" value={query} />
        <SelectField label="Student" onChange={(event) => setStudentId(event.target.value)} required value={studentId}>
          <option value="">Select…</option>
          {filtered.map((student) => {
            const id = optionalRecordId(student) ?? "";
            return <option key={id} value={id}>{studentRoll(student)} · {studentName(student)}</option>;
          })}
        </SelectField>
        <SelectField label="Channel" onChange={(event) => setChannel(event.target.value as CaseChannel)} value={channel}>
          {CASE_CHANNELS.map((item) => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}
        </SelectField>
        <TextAreaField label="Incoming message" onChange={(event) => setRawMessage(event.target.value)} required rows={6} value={rawMessage} />
        <div className="form-actions">
          <button className="primary-button" disabled={!rawMessage.trim() || classify.isPending} onClick={() => { setError(undefined); classify.mutate(); }} type="button">
            {classify.isPending ? "Classifying..." : "Classify with AI"}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Classification</h3>
        {rationale ? <p className="muted">{rationale}</p> : null}
        <div className="chips">
          {CASE_CATEGORIES.map((item) => (
            <label key={item} className="chip">
              <input
                checked={categories.includes(item)}
                onChange={(event) => {
                  setCategories((current) => event.target.checked ? [...current, item] : current.filter((entry) => entry !== item));
                }}
                type="checkbox"
              />
              {CATEGORY_LABELS[item]}
            </label>
          ))}
        </div>
        <SelectField label="Priority" onChange={(event) => setPriority(event.target.value as CasePriority)} value={priority}>
          {CASE_PRIORITIES.map((item) => <option key={item} value={item}>{PRIORITY_LABELS[item]}</option>)}
        </SelectField>
        <label className="chip">
          <input checked={hardship} onChange={(event) => setHardship(event.target.checked)} type="checkbox" />
          Hardship — needs human judgment
        </label>
        {hardship ? <StatusPill tone="warn">Hardship</StatusPill> : null}
      </div>

      <div className="panel">
        <h3>Reply draft</h3>
        <div className="form-actions">
          <button className="primary-button" disabled={!selected || !rawMessage.trim() || draftMut.isPending} onClick={() => { setError(undefined); draftMut.mutate(); }} type="button">
            {draftMut.isPending ? "Drafting..." : "Draft reply with AI"}
          </button>
        </div>
        <TextAreaField label="Staff-editable reply" onChange={(event) => setDraft(event.target.value)} rows={8} value={draft} />
        {originalDraft && originalDraft !== draft ? <p className="muted">This draft was AI-assisted and human-corrected.</p> : originalDraft ? <p className="muted">AI-assisted draft, not yet edited.</p> : null}
        <div className="form-actions">
          <button className="icon-button" onClick={() => onSave(false)} type="button">Save without sending</button>
          <button className="primary-button" onClick={() => onSave(true)} type="button">Approve & send</button>
        </div>
      </div>
    </section>
  );
}
