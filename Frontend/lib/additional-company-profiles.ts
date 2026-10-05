import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { getSystemSetting } from "@/lib/system-settings";

export type AdditionalCompanyProfile = {
  id: string;
  name: string;
  regNo: string;
  defaultCurrency: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
};

export function createEmptyAdditionalCompanyProfile(): AdditionalCompanyProfile {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `company-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    name: "",
    regNo: "",
    defaultCurrency: DEFAULT_CURRENCY,
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    website: "",
  };
}

function readField(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function toProfileList(parsed: unknown): AdditionalCompanyProfile[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const id =
      readField(item, "id", "Id") ||
      `company-${index}-${readField(item, "name", "Name") || "row"}`;
    return {
      id,
      name: readField(item, "name", "Name"),
      regNo: readField(item, "regNo", "RegNo", "registrationNo", "RegistrationNo"),
      defaultCurrency: (readField(item, "defaultCurrency", "DefaultCurrency") || DEFAULT_CURRENCY).toUpperCase(),
      address1: readField(item, "address1", "Address1"),
      address2: readField(item, "address2", "Address2"),
      city: readField(item, "city", "City"),
      state: readField(item, "state", "State"),
      postalCode: readField(item, "postalCode", "PostalCode"),
      country: readField(item, "country", "Country"),
      phone: readField(item, "phone", "Phone"),
      email: readField(item, "email", "Email"),
      website: readField(item, "website", "Website"),
    };
  });
}

export function parseAdditionalCompanyProfiles(raw: unknown): AdditionalCompanyProfile[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
      if (typeof value === "string") value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return toProfileList(value);
}

export function isBlankAdditionalCompanyProfile(profile: AdditionalCompanyProfile): boolean {
  const { id: _id, ...rest } = profile;
  return Object.values(rest).every((value) => !String(value).trim());
}

export function sanitizeAdditionalCompanyProfiles(
  profiles: AdditionalCompanyProfile[],
): AdditionalCompanyProfile[] {
  return profiles
    .map((profile) => ({
      ...profile,
      name: profile.name.trim(),
      regNo: profile.regNo.trim(),
      defaultCurrency: (profile.defaultCurrency.trim() || DEFAULT_CURRENCY).toUpperCase(),
      address1: profile.address1.trim(),
      address2: profile.address2.trim(),
      city: profile.city.trim(),
      state: profile.state.trim(),
      postalCode: profile.postalCode.trim(),
      country: profile.country.trim(),
      phone: profile.phone.trim(),
      email: profile.email.trim(),
      website: profile.website.trim(),
    }))
    .filter((profile) => !isBlankAdditionalCompanyProfile(profile));
}

export const PRIMARY_COMPANY_PROFILE_KEY = "primary";

export type CompanyProfileFilterOption = { value: string; label: string };

export const MULTI_COMPANY_SETTING_CHANGED_EVENT = "opensky:multi-company-changed";

export function notifyMultiCompanySettingChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MULTI_COMPANY_SETTING_CHANGED_EVENT));
  }
}

export function readMultiCompanyFromSettings(
  settings: Record<string, string | undefined>,
): { active: boolean; options: CompanyProfileFilterOption[] } {
  const active = isMultiCompanyFeatureActive(getSystemSetting(settings, "MultiCompanyFeatureActive"));
  return {
    active,
    options: active ? buildCompanyProfileFilterOptions(settings) : [],
  };
}

export function buildCompanyProfileFilterOptions(
  settings: Record<string, string | undefined>,
): CompanyProfileFilterOption[] {
  const primaryName = (getSystemSetting(settings, "CompanyName") ?? "").trim() || "Primary company";
  const additional = sanitizeAdditionalCompanyProfiles(
    parseAdditionalCompanyProfiles(getSystemSetting(settings, "AdditionalCompanyProfiles")),
  );
  return [
    { value: "", label: "All companies" },
    { value: PRIMARY_COMPANY_PROFILE_KEY, label: primaryName },
    ...additional.map((profile, index) => ({
      value: profile.id,
      label: profile.name.trim() || `Company profile ${index + 1}`,
    })),
  ];
}

export function isMultiCompanyFeatureActive(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
