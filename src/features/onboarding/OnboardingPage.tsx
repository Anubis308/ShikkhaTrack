import { useState, type FormEvent } from "react";
import { useRole } from "../../app/providers/RoleProvider";
import { findStudentByRoll, updateStudent } from "../profiles/profilesApi";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";

export function OnboardingPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { claimManager, refreshRole, userIds } = useRole();
  const [roll, setRoll] = useState("");
  const [managerName, setManagerName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<"student" | "manager" | undefined>();

  async function claimStudent(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending("student");
    try {
      const student = await findStudentByRoll(roll.trim());
      if (!student) throw new Error("No student roster row matches that roll. Ask support to add you first.");
      const id = String(student.ItemId ?? student.itemId ?? "");
      const userId = userIds[0];
      if (!id || !userId) throw new Error("Could not link this account.");
      await updateStudent(id, { UserId: userId });
      await refreshRole();
      onNavigate("/my-requests");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(undefined);
    }
  }

  async function claimAsManager(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending("manager");
    try {
      await claimManager(managerName);
      onNavigate("/dashboard");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(undefined);
    }
  }

  return (
    <section>
      <PageHeader title="Choose how you use ShikkhaTrack" subtitle="Students claim an existing roll. The first staff member can bootstrap as branch manager; later staff are added from Team." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid">
        <form className="panel" onSubmit={claimStudent}>
          <h3>I am a student</h3>
          <p className="muted">Enter the roll number from your ID card. Demo roll: HSC-1187 after seed data is created.</p>
          <FormField label="Roll number" onChange={(event) => setRoll(event.target.value)} placeholder="HSC-1187" required value={roll} />
          <button className="primary-button" disabled={pending === "student"} type="submit">{pending === "student" ? "Linking..." : "Link my roll"}</button>
        </form>
        <form className="panel" onSubmit={claimAsManager}>
          <h3>I am setting up the centre</h3>
          <p className="muted">Only works if no branch manager exists yet. Teachers and support staff are invited from the Team page after that.</p>
          <FormField label="Your name" onChange={(event) => setManagerName(event.target.value)} required value={managerName} />
          <button className="primary-button" disabled={pending === "manager"} type="submit">{pending === "manager" ? "Creating..." : "Become branch manager"}</button>
        </form>
      </div>
    </section>
  );
}
