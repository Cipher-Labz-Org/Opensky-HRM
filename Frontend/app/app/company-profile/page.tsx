"use client";

import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { CompanyProfileContent } from "@/components/settings/CompanyProfileContent";
import { ROUTES } from "@/config/routes";

export default function CompanyProfilePage() {
  return (
    <>
      <AppTopbar
        title="Company Profile"
        subtitle="Logo, legal details, and how employees connect to this company."
      />

      <div className="mt-6 flex flex-wrap justify-end gap-2 text-sm">
        <Link
          href={ROUTES.settings}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:shadow-sm"
        >
          Policy &amp; Settings →
        </Link>
      </div>

      <div className="mt-6">
        <CompanyProfileContent />
      </div>
    </>
  );
}
