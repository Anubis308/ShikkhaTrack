export const APP_ROLES = ["Student", "SupportStaff", "Teacher", "BranchManager"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ACADEMIC_CATEGORIES = ["ClassAccess", "ExamSchedule"] as const;
export const SENSITIVE_CATEGORIES = ["Fees", "Scholarship", "TeacherComplaint"] as const;
export const CASE_CATEGORIES = ["Fees", "ClassAccess", "ExamSchedule", "Scholarship", "TeacherComplaint", "Other"] as const;
export const CASE_CHANNELS = ["Facebook", "Phone", "InPerson", "Other"] as const;
export const CASE_STATUSES = ["Open", "InProgress", "Resolved", "Closed"] as const;
export const CASE_PRIORITIES = ["Low", "Normal", "High"] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];
export type CaseChannel = (typeof CASE_CHANNELS)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const REPEAT_WINDOW_DAYS = 42;
export const REPEAT_ESCALATION_THRESHOLD = 3;

export function isStaffRole(role?: AppRole): boolean {
  return role === "SupportStaff" || role === "BranchManager";
}

export function canManageCases(role?: AppRole): boolean {
  return isStaffRole(role);
}

export function canSeeManagerDashboard(role?: AppRole): boolean {
  return role === "BranchManager";
}

export function homeForRole(role?: AppRole): string {
  if (role === "Student") return "/my-requests";
  if (role === "Teacher") return "/teacher";
  if (role === "SupportStaff") return "/inbox";
  if (role === "BranchManager") return "/dashboard";
  return "/onboarding";
}

export function isAcademicOnly(categories: string[], hardshipFlag: boolean): boolean {
  if (hardshipFlag) return false;
  if (!categories.length) return false;
  return categories.every((category) => (ACADEMIC_CATEGORIES as readonly string[]).includes(category));
}

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  Fees: "Fees",
  ClassAccess: "Class access",
  ExamSchedule: "Exam schedule",
  Scholarship: "Scholarship",
  TeacherComplaint: "Teacher concern",
  Other: "Other"
};

export const CHANNEL_LABELS: Record<CaseChannel, string> = {
  Facebook: "Facebook",
  Phone: "Phone",
  InPerson: "In person",
  Other: "Other"
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  Open: "Open",
  InProgress: "In progress",
  Resolved: "Resolved",
  Closed: "Closed"
};

export const PRIORITY_LABELS: Record<CasePriority, string> = {
  Low: "Low",
  Normal: "Normal",
  High: "High"
};

export const ROLE_LABELS: Record<AppRole, string> = {
  Student: "Student",
  SupportStaff: "Support staff",
  Teacher: "Teacher",
  BranchManager: "Branch manager"
};
