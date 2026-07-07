import { apiFetch } from "@/api/client";
import type { PayStatement, PagedPayStatements } from "@/types/payroll";

export async function getEmployeePayStatements(employeeId: string): Promise<PayStatement[]> {
  return apiFetch<PayStatement[]>(`/api/Payroll/statements/employee/${employeeId}`);
}

export async function getPayStatementsPaged(params: {
  employeeId: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedPayStatements> {
  const search = new URLSearchParams({
    employeeId: params.employeeId,
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 24),
  });
  return apiFetch<PagedPayStatements>(`/api/Payroll/statements?${search.toString()}`);
}

export async function getPayStatement(id: string): Promise<PayStatement> {
  return apiFetch<PayStatement>(`/api/Payroll/statements/${id}`);
}
