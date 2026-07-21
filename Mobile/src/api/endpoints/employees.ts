import { apiFetch } from "@/api/client";
import type { Employee, UpdateEmployeeRequest } from "@/types/employee";

export async function getEmployee(id: string): Promise<Employee> {
  return apiFetch<Employee>(`/api/Employees/${id}`);
}

export async function updateEmployee(id: string, body: UpdateEmployeeRequest): Promise<Employee> {
  return apiFetch<Employee>(`/api/Employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function uploadEmployeePhoto(id: string, uri: string, fileName: string): Promise<Employee> {
  const formData = new FormData();
  formData.append("file", {
    uri,
    name: fileName,
    type: "image/jpeg",
  } as unknown as Blob);

  return apiFetch<Employee>(`/api/Employees/${id}/photo`, {
    method: "POST",
    body: formData,
  });
}
