import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "../../lib/blocks/auth";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

export function ForgotPasswordPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we will send a reset link if an account exists.">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {sent ? <Alert tone="info">If that email is registered, a reset link is on the way.</Alert> : null}
      <form className="auth-form" onSubmit={onSubmit}>
        <FormField autoComplete="email" label="Email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Sending..." : "Send reset link"}</button>
      </form>
      <button className="link-button" onClick={() => onNavigate("/login")} type="button">Back to sign in</button>
    </AuthLayout>
  );
}
