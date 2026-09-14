import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { isBlocksConfigured, isLoginConfigured } from "../../lib/blocks/config";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { FormField, PasswordField } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

export function LoginPage({
  justActivated,
  justReset,
  onNavigate,
  returnTo
}: {
  justActivated?: boolean;
  justReset?: boolean;
  onNavigate: (path: string) => void;
  returnTo?: string;
}) {
  const { login, loginWithPassword } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"password" | "sso" | undefined>();
  const [error, setError] = useState<string | undefined>();
  const passwordReady = isBlocksConfigured();
  const ssoReady = isLoginConfigured();

  async function handlePassword(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending("password");
    try {
      await loginWithPassword(email.trim(), password);
      onNavigate(returnTo || "/");
    } catch (caught) {
      setError((caught as Error).message);
      setPending(undefined);
    }
  }

  async function handleSso() {
    setError(undefined);
    setPending("sso");
    try {
      await login(returnTo);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(undefined);
    }
  }

  return (
    <AuthLayout title={t("auth.welcome")} subtitle={t("auth.subtitle")}>
      {justActivated ? <Alert tone="info">Account activated. Sign in to continue.</Alert> : null}
      {justReset ? <Alert tone="info">Password updated. Sign in with your new password.</Alert> : null}
      {!passwordReady ? <Alert tone="warn">{t("auth.notConfigured")}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="auth-form" onSubmit={handlePassword}>
        <FormField autoComplete="email" label="Email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <PasswordField autoComplete="current-password" label="Password" onChange={(event) => setPassword(event.target.value)} required value={password} />
        <button className="primary-button auth-submit" disabled={!passwordReady || Boolean(pending)} type="submit">
          {pending === "password" ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <button className="link-button" onClick={() => onNavigate("/forgot-password")} type="button">Forgot password?</button>
      {ssoReady ? (
        <button className="primary-button auth-submit" disabled={Boolean(pending)} onClick={handleSso} type="button">
          <LogIn size={18} /> {pending === "sso" ? t("auth.redirecting") : t("auth.continue")}
        </button>
      ) : null}
      <p className="muted">Need an account? <button className="link-button" onClick={() => onNavigate("/signup")} type="button">Create student account</button></p>
    </AuthLayout>
  );
}
