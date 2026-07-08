"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/config/constants";
import {
  fetchCompanyBranding,
  resolveCompanyLogoSrc,
  type CompanyBranding,
} from "@/lib/company-branding";

export const REQUISITION_GRADIENT_BAR_CLASS =
  "bg-gradient-to-r from-[#1a3a6e] via-[#1e4a8c] to-[#2e78e6] px-8 py-7 sm:px-10 sm:py-8";

export function RequisitionDocumentHeader({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  const [branding, setBranding] = useState<CompanyBranding>({
    companyName: APP_NAME,
    companyLogoUrl: null,
  });

  useEffect(() => {
    let mounted = true;
    fetchCompanyBranding().then((next) => {
      if (mounted) setBranding(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const logoSrc = resolveCompanyLogoSrc(branding.companyLogoUrl);

  return (
    <header className={`${REQUISITION_GRADIENT_BAR_CLASS} ${className}`.trim()}>
      <div className="flex items-center gap-5 sm:gap-6">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={`${branding.companyName} logo`}
            className="h-16 w-auto max-w-[10.5rem] shrink-0 object-contain object-left sm:h-20 sm:max-w-[12.5rem]"
            decoding="sync"
            loading="eager"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Job requisition</h2>
          <p className="mt-2 text-sm font-normal text-white/90 sm:text-base">{branding.companyName}</p>
          <p className="mt-3 max-w-2xl text-base font-semibold leading-snug text-white sm:text-lg">{title}</p>
        </div>
      </div>
    </header>
  );
}
