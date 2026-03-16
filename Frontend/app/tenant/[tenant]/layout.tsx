/**
 * Tenant layout – placeholder for future multi-tenant support.
 * Future responsibilities: load tenant info, apply tenant theme, isolate tenant data.
 * For now, only renders children.
 */
export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
