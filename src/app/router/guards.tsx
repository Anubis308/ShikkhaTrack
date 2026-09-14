import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useRole } from "../providers/RoleProvider";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { homeForRole, type AppRole } from "../../lib/roles";

type GuardProps = { children: ReactNode; onNavigate: (path: string) => void };

export function RequireAuth({ children, currentPath, onNavigate }: GuardProps & { currentPath: string }) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      onNavigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
    }
  }, [currentPath, status, onNavigate]);

  if (status !== "authenticated") return <LoadingScreen />;
  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children, onNavigate }: GuardProps) {
  const { status } = useAuth();
  const { homePath, status: roleStatus } = useRole();

  useEffect(() => {
    if (status === "authenticated" && roleStatus === "ready") onNavigate(homePath);
  }, [homePath, roleStatus, status, onNavigate]);

  if (status === "loading" || status === "authenticated") return <LoadingScreen />;
  return <>{children}</>;
}

export function RequireRole({
  allow,
  children,
  onNavigate
}: GuardProps & { allow: AppRole[] }) {
  const { role, status, homePath } = useRole();

  useEffect(() => {
    if (status !== "ready") return;
    if (!role) {
      onNavigate("/onboarding");
      return;
    }
    if (!allow.includes(role)) onNavigate(homePath);
  }, [allow, homePath, onNavigate, role, status]);

  if (status !== "ready" || !role || !allow.includes(role)) return <LoadingScreen />;
  return <>{children}</>;
}

export { homeForRole };
