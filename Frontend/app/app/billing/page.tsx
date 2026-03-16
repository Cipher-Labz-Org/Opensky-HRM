import { AppTopbar } from "@/components/navigation/AppTopbar";

export default function BillingPage() {
  return (
    <>
      <AppTopbar
        title="Billing"
        subtitle="Plans, usage, and payment."
      />
      <div className="mt-6 rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
        <h3 className="text-lg font-semibold text-[var(--text)]">
          Billing placeholder
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Billing and subscription UI will be added here. Server component.
        </p>
      </div>
    </>
  );
}
