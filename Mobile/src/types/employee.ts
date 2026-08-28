export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  addressStreet1: string | null;
  addressStreet2: string | null;
  city: string | null;
  country: string | null;
  stateProvince: string | null;
  zipPostalCode: string | null;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string | null;
  nationality: string | null;
  nationalId: string | null;
  epfNumber: string | null;
  etfNumber: string | null;
  joinDate: string;
  probationEndDate: string | null;
  status: string;
  employmentType: string;
  departmentId: string;
  departmentName: string | null;
  businessUnitId: string | null;
  businessUnitName: string | null;
  locationId: string | null;
  positionTitle: string | null;
  locationName: string | null;
  gradeName: string | null;
  jobTitleName: string | null;
  managerId: string | null;
  managerName: string | null;
  profileImageUrl: string | null;
  shiftPatternName: string | null;
  hasDirectSupervisor: boolean;
  needsProfileSetup: boolean;
}

export interface UpdateEmployeeRequest {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email?: string;
  phone?: string | null;
  addressStreet1?: string | null;
  addressStreet2?: string | null;
  city?: string | null;
  country?: string | null;
  stateProvince?: string | null;
  zipPostalCode?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
}
