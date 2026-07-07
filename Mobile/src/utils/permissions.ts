import type { Permission, UserProfile } from "@/types/auth";

export function hasPermission(
  user: UserProfile | null,
  module: string,
  action: string,
  scopes: string[] = ["Own", "Team", "All"]
): boolean {
  if (!user) return false;
  if (user.roles.includes("ADMIN")) return true;
  return user.permissions.some(
    (p: Permission) =>
      p.module === module && p.action === action && scopes.includes(p.scope)
  );
}

export function canApproveLeave(user: UserProfile | null): boolean {
  return hasPermission(user, "Leave", "Read", ["Team", "All"]);
}

export function hasLicensedModule(user: UserProfile | null, module: string): boolean {
  if (!user) return false;
  return user.licensedModules.includes(module);
}

export function getEmployeeId(user: UserProfile | null): string | null {
  return user?.employeeId ?? null;
}
