import { apiFetch } from "@/api/client";
import type {
  AuthResponse,
  BrandingResponse,
  ChangePasswordRequest,
  ForgotPasswordResetRequest,
  ForgotPasswordVerifyRequest,
  ForgotPasswordVerifyResponse,
  MobileConnectionInfo,
  UserProfile,
} from "@/types/auth";

export async function login(body: { username: string; password: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/auth/me");
}

export async function getBranding(baseUrl?: string): Promise<BrandingResponse> {
  return apiFetch<BrandingResponse>("/api/auth/branding", {
    skipAuth: true,
    baseUrl,
  });
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await apiFetch<void>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function forgotPasswordVerify(
  body: ForgotPasswordVerifyRequest
): Promise<ForgotPasswordVerifyResponse> {
  return apiFetch<ForgotPasswordVerifyResponse>("/api/auth/forgot-password/verify", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function forgotPasswordReset(body: ForgotPasswordResetRequest): Promise<void> {
  await apiFetch<void>("/api/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function getMobileConnectionInfo(baseUrl?: string): Promise<MobileConnectionInfo> {
  return apiFetch<MobileConnectionInfo>("/api/mobile/connection-info", {
    skipAuth: true,
    baseUrl,
  });
}

export function getMobileConnectionQrUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/mobile/connection-qr`;
}
