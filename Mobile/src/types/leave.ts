export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string;
  entitled: number;
  used: number;
  carriedForward: number;
  broughtForwardDays: number;
  remaining: number;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  defaultDaysPerYear: number;
  isPaid: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  coveragePerson: string | null;
  approverRemarks: string | null;
  createdAt: string;
  currentApprovalLevel: number;
  responsibleUserName: string | null;
  responsibleEmployeeId: string | null;
  medicalCertificateUrl: string | null;
}

export interface CreateLeaveRequest {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  coveragePerson?: string;
}

export interface ApproveRejectLeaveRequest {
  remarks?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
