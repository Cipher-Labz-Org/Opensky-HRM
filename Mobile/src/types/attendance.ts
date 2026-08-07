export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  workedHours: number | null;
  status: string;
  source: string | null;
  shiftName: string | null;
  isLate: boolean;
  lateMins: number;
  isEarlyDeparture: boolean;
  isOnLeave: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface AttendanceSummary {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalNoPunch: number;
  averageWorkHours: number;
}

export interface PunchRequest {
  type: "in" | "out";
  employeeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: string;
  businessUnitId?: string | null;
  locationId?: string | null;
  qrPayload?: string | null;
}

export interface PagedAttendanceResult {
  items: AttendanceRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BusinessUnitAttendanceQr {
  businessUnitId: string;
  name: string;
  code: string;
  payload: string;
}

export interface ValidateAttendanceQrResult {
  valid: boolean;
  message?: string | null;
  businessUnitId?: string | null;
  locationId?: string | null;
  businessUnitName?: string | null;
  businessUnitCode?: string | null;
  locationName?: string | null;
  locationCode?: string | null;
}
