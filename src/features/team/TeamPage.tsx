import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { FormField, SelectField } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { optionalRecordId } from "../../lib/data/gateway";
import { ROLE_LABELS, type AppRole } from "../../lib/roles";
import { batchName, createStaff, listBatches, listStaff, staffDisplayName, staffRole } from "../profiles/profilesApi";

export function TeamPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Exclude<AppRole, "Student">>("SupportStaff");
  const [batchId, setBatchId] = useState("");

  const staffQuery = useQuery({ queryFn: listStaff, queryKey: ["staff"] });
  const batchesQuery = useQuery({ queryFn: listBatches, queryKey: ["batches"] });

  const create = useMutation({
    mutationFn: () => createStaff({
      DisplayName: displayName.trim(),
      UserId: userId.trim(),
      Role: role,
      BatchId: role === "Teacher" ? batchId : ""
    }),
    onSuccess: async () => {
      setDisplayName("");
      setUserId("");
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (caught) => setError((caught as Error).message)
  });

  return (
    <section>
      <PageHeader title="Team" subtitle="Support staff and teachers are created here. Paste the IAM user id from their Profile page after they sign in once." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form
        className="panel form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          create.mutate();
        }}
      >
        <FormField label="Display name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
        <FormField label="IAM user id" onChange={(event) => setUserId(event.target.value)} required value={userId} />
        <SelectField label="Role" onChange={(event) => setRole(event.target.value as Exclude<AppRole, "Student">)} value={role}>
          <option value="SupportStaff">Support staff</option>
          <option value="Teacher">Teacher</option>
          <option value="BranchManager">Branch manager</option>
        </SelectField>
        {role === "Teacher" ? (
          <SelectField label="Batch" onChange={(event) => setBatchId(event.target.value)} required value={batchId}>
            <option value="">Select…</option>
            {(batchesQuery.data ?? []).map((batch) => {
              const id = optionalRecordId(batch) ?? "";
              return <option key={id} value={id}>{batchName(batch)}</option>;
            })}
          </SelectField>
        ) : null}
        <div className="form-actions">
          <button className="primary-button" disabled={create.isPending} type="submit">{create.isPending ? "Saving..." : "Add staff"}</button>
        </div>
      </form>
      <DataTable
        columns={[
          { key: "name", header: "Name", render: (row) => staffDisplayName(row) },
          { key: "role", header: "Role", render: (row) => ROLE_LABELS[staffRole(row)] },
          { key: "user", header: "User id", render: (row) => String(row.UserId ?? row.userId ?? "") }
        ]}
        rows={staffQuery.data ?? []}
      />
    </section>
  );
}
