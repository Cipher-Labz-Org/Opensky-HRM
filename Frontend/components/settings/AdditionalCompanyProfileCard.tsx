"use client";

import { CurrencySearchCombobox } from "@/components/forms/CurrencySearchCombobox";
import { EmailInput, PhoneInput } from "@/components/ui";
import type { AdditionalCompanyProfile } from "@/lib/additional-company-profiles";

type Props = {
  index: number;
  profile: AdditionalCompanyProfile;
  onChange: (next: AdditionalCompanyProfile) => void;
  onRemove: () => void;
};

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

export function AdditionalCompanyProfileCard({ index, profile, onChange, onRemove }: Props) {
  function patch(fields: Partial<AdditionalCompanyProfile>) {
    onChange({ ...profile, ...fields });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">Company profile {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Company Name *</label>
            <input
              value={profile.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Registration No.</label>
            <input
              value={profile.regNo}
              onChange={(e) => patch({ regNo: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Default currency</label>
            <CurrencySearchCombobox
              value={profile.defaultCurrency}
              onValueChange={(v) => patch({ defaultCurrency: v.toUpperCase() })}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Address Line 1</label>
          <input
            value={profile.address1}
            onChange={(e) => patch({ address1: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Address Line 2</label>
          <input
            value={profile.address2}
            onChange={(e) => patch({ address2: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">City</label>
            <input
              value={profile.city}
              onChange={(e) => patch({ city: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">State / Province</label>
            <input
              value={profile.state}
              onChange={(e) => patch({ state: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Postal Code</label>
            <input
              value={profile.postalCode}
              onChange={(e) => patch({ postalCode: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Country</label>
          <input
            value={profile.country}
            onChange={(e) => patch({ country: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Phone</label>
            <PhoneInput
              value={profile.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email</label>
            <EmailInput
              value={profile.email}
              onChange={(e) => patch({ email: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Website</label>
            <input
              value={profile.website}
              onChange={(e) => patch({ website: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
