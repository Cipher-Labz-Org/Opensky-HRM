import { apiFetch } from "@/api/client";
import type {
  AttendanceRecord,
  AttendanceSummary,
  PunchRequest,
  PagedAttendanceResult,
  ValidateAttendanceQrResult,
} from "@/types/attendance";

export async function getAttendanceCheckInMode(): Promise<{ mode: string }> {
  return apiFetch<{ mode: string }>("/api/Attendance/check-in-mode");
}

export async function punchAttendance(body: PunchRequest): Promise<AttendanceRecord> {
  return apiFetch<AttendanceRecord>("/api/Attendance/punch", {
    method: "POST",
    body: JSON.stringify({
      ...body,
      source: body.source ?? "Mobile QR",
    }),
  });
}

export async function getAttendanceRecords(params: {
  employeeId: string;
  from: string;
  to: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<PagedAttendanceResult> {
  const search = new URLSearchParams({
    employeeId: params.employeeId,
    from: params.from,
    to: params.to,
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 50),
  });
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);
  return apiFetch<PagedAttendanceResult>(`/api/Attendance?${search.toString()}`);
}

export async function getAttendanceSummary(params: {
  employeeId: string;
  from: string;
  to: string;
}): Promise<AttendanceSummary> {
  const search = new URLSearchParams({
    employeeId: params.employeeId,
    from: params.from,
    to: params.to,
  });
  return apiFetch<AttendanceSummary>(`/api/Attendance/summary?${search.toString()}`);
}

export async function validateAttendanceQr(input: {
  token?: string;
  payload?: string;
}): Promise<ValidateAttendanceQrResult> {
  return apiFetch<ValidateAttendanceQrResult>("/api/Attendance/qr-validate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
