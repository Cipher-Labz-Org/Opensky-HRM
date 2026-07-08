import { APP_NAME, getAssetBaseUrl, resolveAuthApiPath } from "@/config/constants";

export type CompanyBranding = {
  companyName: string;
  companyLogoUrl: string | null;
};

/** Builds a full URL for a stored company logo path or absolute URL. */
export function resolveCompanyLogoSrc(companyLogoUrl?: string | null): string | null {
  const rawLogo = companyLogoUrl?.trim() ?? "";
  if (!rawLogo) return null;
  return /^https?:\/\//i.test(rawLogo) ? rawLogo : `${getAssetBaseUrl()}${rawLogo}`;
}

/** Loads company name + logo from Settings (public branding endpoint). */
export async function fetchCompanyBranding(): Promise<CompanyBranding> {
  try {
    const res = await fetch(resolveAuthApiPath("/api/auth/branding"));
    if (!res.ok) throw new Error("branding fetch failed");
    const data = (await res.json()) as { companyName?: string; companyLogoUrl?: string };
    return {
      companyName: (data.companyName ?? "").trim() || APP_NAME,
      companyLogoUrl: data.companyLogoUrl?.trim() ? data.companyLogoUrl.trim() : null,
    };
  } catch {
    return { companyName: APP_NAME, companyLogoUrl: null };
  }
}
