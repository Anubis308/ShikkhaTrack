import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { useCurrentUser } from "../../features/profile/useCurrentUser";
import {
  createStaff,
  findStaffByUserId,
  findStudentByUserId,
  listStaff,
  staffBatchId,
  staffDisplayName,
  staffRole,
  studentBatchId,
  studentName,
  studentRoll,
  type StaffProfile,
  type StudentProfile
} from "../../features/profiles/profilesApi";
import { fieldValue, optionalRecordId, userCandidateIds } from "../../lib/data/gateway";
import { homeForRole, type AppRole } from "../../lib/roles";

type RoleStatus = "loading" | "ready";

type RoleContextValue = {
  batchId?: string;
  claimManager: (displayName: string) => Promise<void>;
  displayName: string;
  homePath: string;
  refreshRole: () => Promise<void>;
  role?: AppRole;
  staff?: StaffProfile;
  status: RoleStatus;
  student?: StudentProfile;
  studentId?: string;
  userIds: string[];
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { claims, status: authStatus } = useAuth();
  const me = useCurrentUser();
  const [staff, setStaff] = useState<StaffProfile | undefined>();
  const [student, setStudent] = useState<StudentProfile | undefined>();
  const [status, setStatus] = useState<RoleStatus>("loading");

  const userIds = useMemo(
    () => userCandidateIds(me.data?.data?.itemId, claims),
    [claims, me.data?.data?.itemId]
  );

  const refreshRole = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setStaff(undefined);
      setStudent(undefined);
      setStatus(authStatus === "loading" ? "loading" : "ready");
      return;
    }
    setStatus("loading");
    const [staffMatch, studentMatch] = await Promise.all([
      findStaffByUserId(userIds),
      findStudentByUserId(userIds)
    ]);
    setStaff(staffMatch);
    setStudent(studentMatch);
    setStatus("ready");
  }, [authStatus, userIds]);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  const role: AppRole | undefined = staff ? staffRole(staff) : student ? "Student" : undefined;
  const batchId = staff ? staffBatchId(staff) : student ? studentBatchId(student) : undefined;
  const displayName = staff
    ? staffDisplayName(staff)
    : student
      ? studentName(student) || studentRoll(student)
      : "";

  const claimManager = useCallback(async (name: string) => {
    const existing = await listStaff();
    if (existing.some((item) => fieldValue(item, "Role", "role", "") === "BranchManager")) {
      throw new Error("A branch manager already exists. Ask them to add you on the Team page.");
    }
    const userId = userIds[0];
    if (!userId) throw new Error("Could not read your user id from IAM.");
    await createStaff({
      UserId: userId,
      Role: "BranchManager",
      DisplayName: name.trim() || "Branch manager"
    });
    await refreshRole();
  }, [refreshRole, userIds]);

  const value = useMemo<RoleContextValue>(() => ({
    batchId,
    claimManager,
    displayName,
    homePath: homeForRole(role),
    refreshRole,
    role,
    staff,
    status: authStatus === "loading" || status === "loading" || me.isLoading ? "loading" : "ready",
    student,
    studentId: student ? optionalRecordId(student) : undefined,
    userIds
  }), [authStatus, batchId, claimManager, displayName, me.isLoading, refreshRole, role, staff, status, student, userIds]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
