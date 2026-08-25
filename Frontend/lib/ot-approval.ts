export type OtStatusCode =
  | "NoOt"
  | "PendingApproval"
  | "Approved"
  | "Rejected"
  | "SupervisorNotAssigned";

export type OtNopayRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  departmentName?: string | null;
  totalWorkedHours: number;
  expectedHours: number;
  preOtHours?: number;
  postOtHours?: number;
  overtimeHours: number;
  nopayDays: number;
  nopayHours: number;
  lateDays: number;
  presentDays: number;
  absentDays: number;
  overtimeApprovalStatus?: string | null;
  overtimeApprovedAt?: string | null;
  overtimeApproverName?: string | null;
  approvedOvertimeHoursSnapshot?: number | null;
  overtimeHoursOutdated?: boolean;
  remarks?: string | null;
  otStatus?: string | null;
  otStatusLabel?: string | null;
  hasSupervisor?: boolean;
  supervisorId?: string | null;
  supervisorName?: string | null;
  canApprove?: boolean;
};

export type OtNopayDay = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  departmentName?: string | null;
  date: string;
  punchIn?: string | null;
  punchOut?: string | null;
  shiftName?: string | null;
  expectedHours: number;
  workedHours: number;
  preOtHours: number;
  postOtHours: number;
  overtimeHours: number;
};

export const OT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PendingApproval", label: "Pending Approval" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "NoOt", label: "No OT" },
  { value: "SupervisorNotAssigned", label: "Supervisor Not Assigned" },
];

export function hasOtHours(row: OtNopayRow): boolean {
  return (row.overtimeHours ?? 0) > 0 || (row.preOtHours ?? 0) > 0 || (row.postOtHours ?? 0) > 0;
}

export function resolveOtStatus(row: OtNopayRow): OtStatusCode {
  const fromApi = (row.otStatus ?? "").trim();
  if (
    fromApi === "NoOt" ||
    fromApi === "PendingApproval" ||
    fromApi === "Approved" ||
    fromApi === "Rejected" ||
    fromApi === "SupervisorNotAssigned"
  ) {
    return fromApi;
  }
  if (!hasOtHours(row)) return "NoOt";
  const approval = (row.overtimeApprovalStatus ?? "").toLowerCase();
  if (approval === "approved") return "Approved";
  if (approval === "rejected") return "Rejected";
  if (row.hasSupervisor === false) return "SupervisorNotAssigned";
  return "PendingApproval";
}

export function otStatusLabel(row: OtNopayRow): string {
  if (row.otStatusLabel) return row.otStatusLabel;
  const status = resolveOtStatus(row);
  if (status === "Approved" && row.overtimeHoursOutdated) return "Approved (outdated)";
  switch (status) {
    case "Approved":
      return "Approved";
    case "Rejected":
      return "Rejected";
    case "SupervisorNotAssigned":
      return "Supervisor Not Assigned";
    case "PendingApproval":
      return "Pending Approval";
    default:
      return "No OT";
  }
}

export function otStatusBadgeClass(row: OtNopayRow): string {
  const status = resolveOtStatus(row);
  if (status === "Approved" && row.overtimeHoursOutdated) return "badge badge-orange";
  switch (status) {
    case "Approved":
      return "badge badge-green";
    case "Rejected":
      return "badge badge-red";
    case "PendingApproval":
      return "badge badge-yellow";
    case "SupervisorNotAssigned":
      return "badge badge-orange";
    default:
      return "badge badge-slate";
  }
}

export function fmtOtHours(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(1);
}

export function fmtHours(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

export function isOtActionableStatus(row: OtNopayRow, hrCanApprove = false): boolean {
  const status = resolveOtStatus(row);
  if (status === "PendingApproval" || status === "Rejected") return true;
  if (status === "Approved" && row.overtimeHoursOutdated) return true;
  return hrCanApprove && status === "SupervisorNotAssigned";
}

export function canActOnOtRow(
  row: OtNopayRow,
  options: { hrCanApprove?: boolean; ownEmployeeId?: string | null } = {},
): boolean {
  if (!hasOtHours(row)) return false;
  const ownId = (options.ownEmployeeId ?? "").toLowerCase();
  if (ownId && (row.employeeId ?? "").toLowerCase() === ownId) return false;
  if (row.canApprove) return true;
  return !!options.hrCanApprove && isOtActionableStatus(row, true);
}
