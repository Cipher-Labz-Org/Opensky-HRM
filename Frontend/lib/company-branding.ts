import { APP_NAME, getAssetBaseUrl, resolveAuthApiPath } from "@/config/constants";

export type CompanyLogoFitMode = "contain" | "cover";

export type CompanyBranding = {
  companyName: string;
  companyLogoUrl: string | null;
  loginLogoScale?: number;
  loginLogoOffsetX?: number;
  loginLogoOffsetY?: number;
  loginLogoFit?: CompanyLogoFitMode;
};

export type CompanyLogoDisplaySettings = {
  scale: number;
  offsetX: number;
  offsetY: number;
  fitMode: CompanyLogoFitMode;
};

export const LOGO_SCALE_MIN = 40;
export const LOGO_SCALE_MAX = 250;
export const LOGO_OFFSET_MIN = -60;
export const LOGO_OFFSET_MAX = 60;

export function clampLogoScale(value: number, _fitMode?: CompanyLogoFitMode): number {
  return Math.min(LOGO_SCALE_MAX, Math.max(LOGO_SCALE_MIN, value));
}

export function clampLogoOffset(value: number): number {
  return Math.min(LOGO_OFFSET_MAX, Math.max(LOGO_OFFSET_MIN, value));
}

export function parseLogoDisplaySettings(settings?: {
  loginLogoScale?: string | number | null;
  loginLogoOffsetX?: string | number | null;
  loginLogoOffsetY?: string | number | null;
  loginLogoFit?: string | null;
  CompanyLogoLoginScale?: string | number | null;
  CompanyLogoLoginOffsetX?: string | number | null;
  CompanyLogoLoginOffsetY?: string | number | null;
  CompanyLogoLoginFit?: string | null;
}): CompanyLogoDisplaySettings {
  const rawScale = settings?.loginLogoScale ?? settings?.CompanyLogoLoginScale;
  const rawOffsetX = settings?.loginLogoOffsetX ?? settings?.CompanyLogoLoginOffsetX;
  const rawOffsetY = settings?.loginLogoOffsetY ?? settings?.CompanyLogoLoginOffsetY;
  const scale = Number(rawScale);
  const offsetX = Number(rawOffsetX);
  const offsetY = Number(rawOffsetY);
  return {
    scale: Number.isFinite(scale) ? clampLogoScale(scale) : 100,
    offsetX: Number.isFinite(offsetX) ? clampLogoOffset(offsetX) : 0,
    offsetY: Number.isFinite(offsetY) ? clampLogoOffset(offsetY) : 0,
    fitMode: "contain",
  };
}

/** Resets broken/low zoom values so the circle logo always starts usable. */
export function normalizeLogoDisplaySettings(
  settings: CompanyLogoDisplaySettings,
): { settings: CompanyLogoDisplaySettings; repaired: boolean } {
  const needsRepair = settings.scale < 70 || settings.scale > 200;
  if (!needsRepair) {
    return { settings: { ...settings, fitMode: "contain" }, repaired: false };
  }
  return {
    settings: {
      scale: 100,
      offsetX: 0,
      offsetY: 0,
      fitMode: "contain",
    },
    repaired: true,
  };
}

/** Builds a logo URL. Prefer same-origin `/uploads/...` so PDF→PNG conversion works. */
export function resolveCompanyLogoSrc(companyLogoUrl?: string | null): string | null {
  const rawLogo = companyLogoUrl?.trim() ?? "";
  if (!rawLogo) return null;
  if (/^https?:\/\//i.test(rawLogo)) return rawLogo;
  const path = rawLogo.startsWith("/") ? rawLogo : `/${rawLogo}`;
  // Browser: use relative path (Next.js rewrites /uploads → API) — avoids CORS.
  if (typeof window !== "undefined") return path;
  return `${getAssetBaseUrl()}${path}`;
}

export function isPdfLogoUrl(companyLogoUrl?: string | null): boolean {
  const raw = companyLogoUrl?.trim().toLowerCase() ?? "";
  if (!raw) return false;
  const path = raw.split("?")[0]?.split("#")[0] ?? raw;
  return path.endsWith(".pdf");
}

const LOGO_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export function isAllowedCompanyLogoFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "application/pdf" || LOGO_IMAGE_TYPES.has(type)) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || /\.(jpe?g|png|webp|gif|svg)$/.test(name);
}

/** Loads company name + logo from Settings (public branding endpoint). */
export async function fetchCompanyBranding(): Promise<CompanyBranding> {
  try {
    const res = await fetch(resolveAuthApiPath("/api/auth/branding"));
    if (!res.ok) throw new Error("branding fetch failed");
    const data = (await res.json()) as {
      companyName?: string;
      companyLogoUrl?: string;
      loginLogoScale?: number;
      loginLogoOffsetX?: number;
      loginLogoOffsetY?: number;
      loginLogoFit?: string;
    };
    const display = parseLogoDisplaySettings(data);
    return {
      companyName: (data.companyName ?? "").trim() || APP_NAME,
      companyLogoUrl: data.companyLogoUrl?.trim() ? data.companyLogoUrl.trim() : null,
      loginLogoScale: display.scale,
      loginLogoOffsetX: display.offsetX,
      loginLogoOffsetY: display.offsetY,
      loginLogoFit: "contain",
    };
  } catch {
    return { companyName: APP_NAME, companyLogoUrl: null };
  }
}
