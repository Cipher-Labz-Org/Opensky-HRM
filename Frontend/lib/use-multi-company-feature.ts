"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  MULTI_COMPANY_SETTING_CHANGED_EVENT,
  readMultiCompanyFromSettings,
  type CompanyProfileFilterOption,
} from "@/lib/additional-company-profiles";

export function useMultiCompanyFeature() {
  const [multiCompanyActive, setMultiCompanyActive] = useState(false);
  const [companyFilterOptions, setCompanyFilterOptions] = useState<CompanyProfileFilterOption[]>([]);

  const refreshMultiCompany = useCallback(async () => {
    try {
      const settings = await apiFetch<Record<string, string>>("/api/system-settings");
      const { active, options } = readMultiCompanyFromSettings(settings);
      setMultiCompanyActive(active);
      setCompanyFilterOptions(options);
      return active;
    } catch {
      setMultiCompanyActive(false);
      setCompanyFilterOptions([]);
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshMultiCompany();

    const onRefresh = () => {
      void refreshMultiCompany();
    };
    window.addEventListener(MULTI_COMPANY_SETTING_CHANGED_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener(MULTI_COMPANY_SETTING_CHANGED_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refreshMultiCompany]);

  return { multiCompanyActive, companyFilterOptions, refreshMultiCompany };
}
