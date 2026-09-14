import { Inbox, LayoutDashboard, GraduationCap, UserRound, Users, BookUser } from "lucide-react";
import type { AppRole } from "../../lib/roles";
import { canManageCases, canSeeManagerDashboard } from "../../lib/roles";

export type NavItem = {
  href: string;
  icon: typeof Inbox;
  label: string;
  match?: (path: string) => boolean;
};

export function navItemsForRole(role?: AppRole): NavItem[] {
  if (role === "Student") {
    return [
      { href: "/my-requests", icon: Inbox, label: "My requests", match: (path) => path.startsWith("/my-requests") || path.startsWith("/cases/") },
      { href: "/profile", icon: UserRound, label: "Profile" }
    ];
  }
  if (role === "Teacher") {
    return [
      { href: "/teacher", icon: GraduationCap, label: "Batch cases", match: (path) => path.startsWith("/teacher") || path.startsWith("/cases/") },
      { href: "/profile", icon: UserRound, label: "Profile" }
    ];
  }
  const items: NavItem[] = [];
  if (canSeeManagerDashboard(role)) {
    items.push({ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" });
  }
  if (canManageCases(role)) {
    items.push(
      { href: "/inbox", icon: Inbox, label: "Inbox", match: (path) => path === "/inbox" || path.startsWith("/cases") },
      { href: "/roster", icon: BookUser, label: "Roster" }
    );
  }
  if (canSeeManagerDashboard(role)) {
    items.push({ href: "/team", icon: Users, label: "Team" });
  }
  items.push({ href: "/profile", icon: UserRound, label: "Profile" });
  return items;
}

export function isNavActive(item: NavItem, path: string): boolean {
  if (item.match) return item.match(path);
  return path === item.href;
}
