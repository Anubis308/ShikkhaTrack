import { useEffect, useState, type FormEvent } from "react";
import { activateAccount, resendActivationEmail, validateActivationCode } from "../../lib/blocks/auth";
import { isBlocksConfigured } from "../../lib/blocks/config";
import { Alert } from "../../shared/ui/Alert";
import { FormField, PasswordField } from "../../shared/ui/FormField";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { AuthLayout } from "./AuthLayout";

export function ActivatePage({ code, onNavigate }: { code: string; onNavigate: (path: string) => void }) {
  const ready = isBlocksConfigured();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">(code ? "loading" : "invalid");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!code || !ready) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    validateActivationCode(code)
      .then((preview) => {
        if (cancelled) return;
        if (!preview.valid) {
          setStatus("invalid");
          return;
        }
        if (preview.email) setEmail(preview.email);
        if (preview.firstName) setFirstName(preview.firstName);
        if (preview.lastName) setLastName(preview.lastName);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => { cancelled = true; };
  }, [code, ready]);

  async function onActivate(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await activateAccount({ code, firstName, lastName, password });
      onNavigate("/login?activated=1");
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  }

  if (status === "loading") return <LoadingScreen />;
  if (status === "invalid") {
    return (
      <AuthLayout title="Activation link invalid" subtitle="Ask support to resend the activation email.">
        <button className="primary-button auth-submit" onClick={() => onNavigate("/login")} type="button">Back to sign in</button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" subtitle="Activate your ShikkhaTrack account.">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="auth-form" onSubmit={onActivate}>
        <FormField label="Email" onChange={(event) => setEmail(event.target.value)} value={email} />
        <PasswordField label="Password" onChange={(event) => setPassword(event.target.value)} required value={password} />
        <PasswordField label="Confirm password" onChange={(event) => setConfirm(event.target.value)} required value={confirm} />
        <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Activating..." : "Activate"}</button>
      </form>
      {email ? (
        <button className="link-button" onClick={() => resendActivationEmail(email).catch((caught) => setError((caught as Error).message))} type="button">
          Resend activation email
        </button>
      ) : null}
    </AuthLayout>
  );
}
