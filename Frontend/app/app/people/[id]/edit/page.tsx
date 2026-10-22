"use client";

import { useParams, useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { useAuth } from "@/contexts/auth-context";
import { ROUTES } from "@/config/routes";

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission, isAdmin, isLoading } = useAuth();
  const canEdit = isAdmin || hasPermission("People", "Update");

  if (isLoading) return null;
  if (!canEdit) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
        You do not have permission to edit employees.
      </div>
    );
  }

  return (
    <EmployeeForm
      mode="edit"
      employeeId={id}
      breadcrumb={[
        { label: "People", href: ROUTES.people },
        { label: "Employee", href: ROUTES.peopleDetail(id) },
        { label: "Edit" },
      ]}
      onCancel={() => router.push(ROUTES.peopleDetail(id))}
      onSaved={() => router.push(ROUTES.peopleDetail(id))}
    />
  );
}
