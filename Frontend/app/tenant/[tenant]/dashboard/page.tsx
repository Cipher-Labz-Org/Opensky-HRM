type Props = { params?: { tenant: string } };

export default function TenantDashboardPage({ params }: Props) {
  const tenant = params?.tenant ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          Tenant Dashboard
        </h1>
        <p className="text-sm text-[var(--muted)]">Tenant ID: {tenant}</p>
      </div>
      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
        <p className="text-sm text-[var(--muted)]">
          Tenant-scoped dashboard content placeholder. Future: tenant context and data.
        </p>
      </div>
    </div>
  );
}
