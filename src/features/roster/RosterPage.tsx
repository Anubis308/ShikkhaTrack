import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { FormField, SelectField } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { optionalRecordId } from "../../lib/data/gateway";
import { batchName, createStudent, listBatches, listStudents, studentName, studentRoll } from "../profiles/profilesApi";

export function RosterPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const [roll, setRoll] = useState("");
  const [fullName, setFullName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [phone, setPhone] = useState("");

  const batchesQuery = useQuery({ queryFn: listBatches, queryKey: ["batches"] });
  const studentsQuery = useQuery({ queryFn: listStudents, queryKey: ["students"] });

  const create = useMutation({
    mutationFn: () => createStudent({ Roll: roll.trim(), FullName: fullName.trim(), BatchId: batchId, GuardianPhone: phone.trim() }),
    onSuccess: async () => {
      setRoll("");
      setFullName("");
      setPhone("");
      await queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (caught) => setError((caught as Error).message)
  });

  const batchLabel = (id: string) => {
    const match = (batchesQuery.data ?? []).find((batch) => optionalRecordId(batch) === id);
    return match ? batchName(match) : id;
  };

  return (
    <section>
      <PageHeader title="Student roster" subtitle="Roll numbers used when logging cases and when students claim their account." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form
        className="panel form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          create.mutate();
        }}
      >
        <FormField label="Roll" onChange={(event) => setRoll(event.target.value)} required value={roll} />
        <FormField label="Full name" onChange={(event) => setFullName(event.target.value)} required value={fullName} />
        <SelectField label="Batch" onChange={(event) => setBatchId(event.target.value)} required value={batchId}>
          <option value="">Select…</option>
          {(batchesQuery.data ?? []).map((batch) => {
            const id = optionalRecordId(batch) ?? "";
            return <option key={id} value={id}>{batchName(batch)}</option>;
          })}
        </SelectField>
        <FormField label="Guardian phone" onChange={(event) => setPhone(event.target.value)} value={phone} />
        <div className="form-actions">
          <button className="primary-button" disabled={create.isPending} type="submit">{create.isPending ? "Saving..." : "Add student"}</button>
        </div>
      </form>
      <DataTable
        columns={[
          { key: "roll", header: "Roll", render: (row) => studentRoll(row) },
          { key: "name", header: "Name", render: (row) => studentName(row) },
          { key: "batch", header: "Batch", render: (row) => batchLabel(String(row.BatchId ?? row.batchId ?? "")) }
        ]}
        rows={studentsQuery.data ?? []}
      />
    </section>
  );
}
