import { apiFetch } from "@/api/client";
import type {
  ApproveRejectLeaveRequest,
  CreateLeaveRequest,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  PagedResult,
} from "@/types/leave";

export async function getLeaveBalances(
  employeeId: string,
  year = new Date().getFullYear()
): Promise<LeaveBalance[]> {
  return apiFetch<LeaveBalance[]>(`/api/leave/balances/${employeeId}?year=${year}`);
}

export async function getLeaveTypes(): Promise<LeaveType[]> {
  return apiFetch<LeaveType[]>("/api/leave/types");
}

export async function getMyLeaveRequests(
  employeeId: string,
  params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<PagedResult<LeaveRequest>> {
  const search = new URLSearchParams();
  search.set("employeeId", employeeId);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  return apiFetch<PagedResult<LeaveRequest>>(`/api/leave/requests?${qs}`);
}

export async function getTeamPendingLeaveRequests(
  status: "Pending" | "PendingLevel2"
): Promise<PagedResult<LeaveRequest>> {
  return apiFetch<PagedResult<LeaveRequest>>(
    `/api/leave/requests?status=${status}&excludeSelf=true&pageSize=100`
  );
}

export async function createLeaveRequest(body: CreateLeaveRequest): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>("/api/leave/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createLeaveRequestWithDocument(
  fields: CreateLeaveRequest & { medicalCertificateUri: string; medicalCertificateName: string }
): Promise<LeaveRequest> {
  const formData = new FormData();
  formData.append("employeeId", fields.employeeId);
  formData.append("leaveTypeId", fields.leaveTypeId);
  formData.append("startDate", fields.startDate);
  formData.append("endDate", fields.endDate);
  formData.append("totalDays", String(fields.totalDays));
  if (fields.reason) formData.append("reason", fields.reason);
  if (fields.coveragePerson) formData.append("coveragePerson", fields.coveragePerson);
  formData.append("medicalCertificate", {
    uri: fields.medicalCertificateUri,
    name: fields.medicalCertificateName,
    type: "application/pdf",
  } as unknown as Blob);

  return apiFetch<LeaveRequest>("/api/leave/requests/with-document", {
    method: "POST",
    body: formData,
  });
}

export async function approveLeaveRequest(id: string, body: ApproveRejectLeaveRequest): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/api/leave/requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rejectLeaveRequest(id: string, body: ApproveRejectLeaveRequest): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/api/leave/requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
