import { useState, type FormEvent } from "react";
import { resetAccountPassword } from "../../lib/blocks/auth";
import { Alert } from "../../shared/ui/Alert";
import { PasswordField } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage({ code, onNavigate }: { code: string; onNavigate: (path: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await resetAccountPassword({ code, password });
      onNavigate("/login?reset=1");
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Set a new password to sign in to ShikkhaTrack.">
      {!code ? <Alert tone="error">This reset link is missing a code.</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="auth-form" onSubmit={onSubmit}>
        <PasswordField label="New password" onChange={(event) => setPassword(event.target.value)} required value={password} />
        <PasswordField label="Confirm password" onChange={(event) => setConfirm(event.target.value)} required value={confirm} />
        <button className="primary-button auth-submit" disabled={!code || pending} type="submit">{pending ? "Updating..." : "Update password"}</button>
      </form>
    </AuthLayout>
  );
}
