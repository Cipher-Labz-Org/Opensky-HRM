"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { LeaveRequestsPanel } from "@/components/workforce/LeaveRequestsPanel";
import { OtNopayPanel } from "@/components/workforce/OtNopayPanel";
import { useAuth } from "@/contexts/auth-context";

function FullScreenSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );
}

function ApprovalsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAdmin, hasPermission, getLeaveReadScope, getPeopleReadScope, hasRole } = useAuth();

  const canLeaveRead = isAdmin || getLeaveReadScope() != null || hasRole("SUPERVISOR");
  const canLeaveApprove = isAdmin || hasPermission("Leave", "Update");
  const canAttendanceRead = isAdmin || hasPermission("Attendance", "Read") || hasRole("SUPERVISOR") || hasRole("HR_MANAGER");

  const leaveScope = getLeaveReadScope();
  const isHrWideLeave = isAdmin || leaveScope === "All";
  const leaveTeamOnly = !isHrWideLeave && (leaveScope === "Team" || hasRole("SUPERVISOR"));
  const attendanceUpdateAll = user?.permissions.some(
    (p) => p.module === "Attendance" && p.action === "Update" && (p.scope ?? "Own") === "All",
  ) ?? false;
  const isHrWideOt = isAdmin || hasRole("HR_MANAGER") || getPeopleReadScope() === "All" || attendanceUpdateAll;
  const otTeamOnly = !isHrWideOt;

  const [tab, setTab] = useState<"leave" | "overtime">("leave");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "overtime" && canAttendanceRead) {
      setTab("overtime");
      return;
    }
    if (t === "leave" && canLeaveRead) {
      setTab("leave");
      return;
    }
    if (canLeaveRead) setTab("leave");
    else if (canAttendanceRead) setTab("overtime");
  }, [searchParams, canLeaveRead, canAttendanceRead]);

  function selectTab(next: "leave" | "overtime") {
    setTab(next);
    router.replace(`/app/approvals?tab=${next}`, { scroll: false });
  }

  if (isLoading || !user) {
    return <FullScreenSpinner />;
  }

  if (!canLeaveRead && !canAttendanceRead) {
    return (
      <>
        <AppTopbar title="Approvals" subtitle="Leave and overtime sign-off." />
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          You do not have access to leave or attendance data. Ask an administrator to grant Leave and/or Time &amp;
          Attendance permissions.
        </div>
      </>
    );
  }

  return (
    <>
      <AppTopbar title="Approvals" subtitle="Review and approve leave requests and period overtime in one place." />

      <div className="mt-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm">
        {canLeaveRead && (
          <button
            type="button"
            onClick={() => selectTab("leave")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "leave"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Leave
          </button>
        )}
        {canAttendanceRead && (
          <button
            type="button"
            onClick={() => selectTab("overtime")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "overtime"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Overtime
          </button>
        )}
      </div>

      {tab === "leave" && canLeaveRead && (
        <LeaveRequestsPanel
          showApprovalActions={canLeaveApprove}
          teamOnly={leaveTeamOnly}
          isEmployeeView={false}
          currentEmployeeId={user.employeeId}
          sectionTitle="Leave requests"
          sectionSubtitle="All employees' leave requests. Filter by department, status, and dates as needed."
          hideApplyShortcut
        />
      )}

      {tab === "overtime" && canAttendanceRead && (
        <div className="mt-6">
          <OtNopayPanel embedded teamOnly={otTeamOnly} />
        </div>
      )}
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <ApprovalsInner />
    </Suspense>
  );
}
