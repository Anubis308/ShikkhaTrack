import { Activity, Moon, PanelLeft, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isNavActive, navItemsForRole } from "./navItems";
import { UserMenu } from "./UserMenu";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { useRole } from "../providers/RoleProvider";
import { useTheme } from "../providers/ThemeProvider";

const COLLAPSED_KEY = "blocks-app:sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 880px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AppShell({ activePath, children, onNavigate }: { activePath: string; children: ReactNode; onNavigate: (path: string) => void }) {
  const isMobile = useIsMobile();
  const [collapsedPref, setCollapsedPref] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const { t } = useT();
  const { homePath, role } = useRole();
  const { theme, toggleTheme } = useTheme();
  const navItems = navItemsForRole(role);
  const collapsed = collapsedPref || isMobile;
  const activeItem = navItems.find((item) => isNavActive(item, activePath));

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsedPref));
  }, [collapsedPref]);

  return (
    <div className="shell">
      <aside className={collapsed ? "collapsed" : ""}>
        <div className="sidebar-header">
          {collapsed ? null : (
            <a className="brand" href={homePath} onClick={(event) => { event.preventDefault(); onNavigate(homePath); }}>
              <span className="brand-mark"><Activity size={16} /></span>
              <span>{t("app.name")}</span>
            </a>
          )}
          <button className="icon-button sidebar-collapse-toggle" onClick={() => setCollapsedPref((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <PanelLeft size={16} />
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-label={item.label}
              data-tooltip={item.label}
              className={isNavActive(item, activePath) ? "active" : ""}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.href);
              }}
            >
              <item.icon size={18} />
              {collapsed ? null : <span>{item.label}</span>}
            </a>
          ))}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          {activeItem ? (
            <div className="breadcrumb">
              <activeItem.icon size={16} />
              <span>{activeItem.label}</span>
            </div>
          ) : null}
          <div className="topbar-spacer" />
          <button
            className="icon-button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <UserMenu onNavigate={onNavigate} />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
