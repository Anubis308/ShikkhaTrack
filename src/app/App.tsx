import { AppProviders } from "./providers/AppProviders";
import { AuthProvider } from "./providers/AuthProvider";
import { RoleProvider } from "./providers/RoleProvider";
import { AppRouter } from "./router/routes";

export function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <RoleProvider>
          <AppRouter />
        </RoleProvider>
      </AuthProvider>
    </AppProviders>
  );
}
