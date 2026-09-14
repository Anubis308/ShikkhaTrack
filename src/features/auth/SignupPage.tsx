import { useState, type FormEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { isBlocksConfigured } from "../../lib/blocks/config";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

export function SignupPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { signup } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [created, setCreated] = useState(false);
  const ready = isBlocksConfigured();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      const result = await signup({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim() });
      if (result.signedIn) {
        onNavigate("/");
        return;
      }
      setCreated(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent an activation link. Set your password from that email, then sign in.">
        <button className="primary-button auth-submit" onClick={() => onNavigate("/login")} type="button">Back to sign in</button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create a student account" subtitle="Students self-register. Support staff and teachers are added by the branch manager.">
      {!ready ? <Alert tone="warn">Blocks is not configured yet.</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-name-row">
          <FormField label="First name" onChange={(event) => setFirstName(event.target.value)} required value={firstName} />
          <FormField label="Last name" onChange={(event) => setLastName(event.target.value)} required value={lastName} />
        </div>
        <FormField autoComplete="email" label="Email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <button className="primary-button auth-submit" disabled={!ready || pending} type="submit">{pending ? "Creating..." : "Create account"}</button>
      </form>
      <p className="muted">Already have an account? <button className="link-button" onClick={() => onNavigate("/login")} type="button">Sign in</button></p>
    </AuthLayout>
  );
}
