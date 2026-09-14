import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from "./guards";
import { ActivatePage } from "../../features/auth/ActivatePage";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { ForgotPasswordPage } from "../../features/auth/ForgotPasswordPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { ResetPasswordPage } from "../../features/auth/ResetPasswordPage";
import { SignupPage } from "../../features/auth/SignupPage";
import { CaseDetailPage } from "../../features/cases/CaseDetailPage";
import { CaseInboxPage } from "../../features/cases/CaseInboxPage";
import { NewCasePage } from "../../features/cases/NewCasePage";
import { ManagerDashboardPage } from "../../features/manager/ManagerDashboardPage";
import { MyRequestsPage } from "../../features/my-requests/MyRequestsPage";
import { OnboardingPage } from "../../features/onboarding/OnboardingPage";
import { ProfilePage } from "../../features/profile/ProfilePage";
import { RosterPage } from "../../features/roster/RosterPage";
import { TeacherCasesPage } from "../../features/teacher/TeacherCasesPage";
import { TeamPage } from "../../features/team/TeamPage";
import { useRole } from "../providers/RoleProvider";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  if (path === "/login/callback") return <CallbackPage onNavigate={navigate} />;

  if (path === "/login") {
    const params = new URLSearchParams(search);
    const returnTo = params.get("returnTo") || undefined;
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <LoginPage
          justActivated={params.get("activated") === "1"}
          justReset={params.get("reset") === "1"}
          onNavigate={navigate}
          returnTo={returnTo}
        />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/signup") {
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <SignupPage onNavigate={navigate} />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/activate") {
    const params = new URLSearchParams(search);
    return <ActivatePage code={params.get("code")?.trim() ?? ""} onNavigate={navigate} />;
  }

  if (path === "/forgot-password") {
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <ForgotPasswordPage onNavigate={navigate} />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/reset-password") {
    const params = new URLSearchParams(search);
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <ResetPasswordPage code={params.get("code")?.trim() ?? params.get("token")?.trim() ?? ""} onNavigate={navigate} />
      </RedirectIfAuthenticated>
    );
  }

  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <AuthenticatedRoutes navigate={navigate} path={path} />
    </RequireAuth>
  );
}

function AuthenticatedRoutes({ navigate, path }: { navigate: (path: string) => void; path: string }) {
  const { homePath, role, status } = useRole();

  if (status !== "ready") return <LoadingScreen />;

  if (path === "/") {
    window.history.replaceState({}, "", homePath);
    return <AuthenticatedRoutes navigate={navigate} path={homePath} />;
  }

  if (path === "/onboarding") {
    if (role) {
      window.history.replaceState({}, "", homePath);
      return <AuthenticatedRoutes navigate={navigate} path={homePath} />;
    }
    return (
      <AppShell activePath={path} onNavigate={navigate}>
        <OnboardingPage onNavigate={navigate} />
      </AppShell>
    );
  }

  if (!role) {
    window.history.replaceState({}, "", "/onboarding");
    return <AuthenticatedRoutes navigate={navigate} path="/onboarding" />;
  }

  const page = renderProtected(path, navigate);
  if (!page) return <NotFoundPage onNavigate={navigate} />;

  return (
    <AppShell activePath={path} onNavigate={navigate}>
      {page}
    </AppShell>
  );
}

function renderProtected(path: string, navigate: (path: string) => void) {
  if (path === "/profile") return <ProfilePage />;
  if (path === "/error") return <ErrorPage onNavigate={navigate} />;
  if (path === "/my-requests") {
    return <RequireRole allow={["Student"]} onNavigate={navigate}><MyRequestsPage onNavigate={navigate} /></RequireRole>;
  }
  if (path === "/teacher") {
    return <RequireRole allow={["Teacher"]} onNavigate={navigate}><TeacherCasesPage onNavigate={navigate} /></RequireRole>;
  }
  if (path === "/inbox") {
    return <RequireRole allow={["SupportStaff", "BranchManager"]} onNavigate={navigate}><CaseInboxPage onNavigate={navigate} /></RequireRole>;
  }
  if (path === "/cases/new") {
    return <RequireRole allow={["SupportStaff", "BranchManager"]} onNavigate={navigate}><NewCasePage onNavigate={navigate} /></RequireRole>;
  }
  if (path === "/dashboard") {
    return <RequireRole allow={["BranchManager"]} onNavigate={navigate}><ManagerDashboardPage onNavigate={navigate} /></RequireRole>;
  }
  if (path === "/roster") {
    return <RequireRole allow={["SupportStaff", "BranchManager"]} onNavigate={navigate}><RosterPage /></RequireRole>;
  }
  if (path === "/team") {
    return <RequireRole allow={["BranchManager"]} onNavigate={navigate}><TeamPage /></RequireRole>;
  }
  const caseMatch = /^\/cases\/([^/]+)$/.exec(path);
  if (caseMatch?.[1]) {
    return <CaseDetailPage id={caseMatch[1]} onNavigate={navigate} />;
  }
  return null;
}
