import { Activity } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function AuthLayout({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  const { t } = useT();
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Activity size={18} /></span><span>{t("app.name")}</span></div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
