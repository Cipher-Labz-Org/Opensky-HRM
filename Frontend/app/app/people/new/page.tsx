"use client";

import { useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { useAuth } from "@/contexts/auth-context";
import { ROUTES } from "@/config/routes";

export default function NewEmployeePage() {
  const router = useRouter();
  const { hasPermission, isAdmin, isLoading } = useAuth();
  const canCreate = isAdmin || hasPermission("People", "Create");

  if (isLoading) return null;
  if (!canCreate) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
        You do not have permission to create employees.
      </div>
    );
  }

  return (
    <EmployeeForm
      mode="create"
      breadcrumb={[{ label: "People", href: ROUTES.people }, { label: "New employee" }]}
      onCancel={() => router.push(ROUTES.people)}
      onSaved={({ employeeId }) => {
        router.push(employeeId ? ROUTES.peopleDetail(employeeId) : ROUTES.people);
      }}
    />
  );
}
