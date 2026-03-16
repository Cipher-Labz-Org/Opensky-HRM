type Props = { params?: { tenant: string } };

export default function TenantSettingsPage({ params }: Props) {
  const tenant = params?.tenant ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          Tenant Settings
        </h1>
        <p className="text-sm text-[var(--muted)]">Tenant ID: {tenant}</p>
      </div>
      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
        <p className="text-sm text-[var(--muted)]">
          Tenant-scoped settings placeholder. Future: tenant theme, branding, config.
        </p>
      </div>
    </div>
  );
}