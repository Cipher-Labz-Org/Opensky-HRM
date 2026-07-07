export interface Permission {
  module: string;
  action: string;
  scope: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  employeeId: string | null;
  employeeName: string | null;
  profileImageUrl: string | null;
  roles: string[];
  permissions: Permission[];
  licensedModules: string[];
  assignedLocationIds: string[];
  assignedBusinessUnitIds: string[];
  assignedGradeIds: string[];
  assignedJobTitleIds: string[];
  mustChangePassword: boolean;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserProfile;
}

export interface BrandingResponse {
  companyName: string;
  companyLogoUrl: string | null;
}

export interface MobileConnectionInfo {
  apiBaseUrl: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyId: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordVerifyRequest {
  employeeCode: string;
  employeeName: string;
}

export interface ForgotPasswordVerifyResponse {
  resetToken: string;
  expiresAt: string;
}

export interface ForgotPasswordResetRequest {
  resetToken: string;
  newPassword: string;
}
