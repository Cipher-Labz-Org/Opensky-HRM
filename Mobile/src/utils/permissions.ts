import type { Permission, UserProfile } from "@/types/auth";

export function hasPermission(
  user: UserProfile | null,
  module: string,
  action: string,
  scopes: string[] = ["Own", "Team", "All"]
): boolean {
  if (!user) return false;
  if (user.roles.some((role) => role.toUpperCase() === "ADMIN")) return true;
  return user.permissions.some(
    (p: Permission) =>
      p.module === module && p.action === action && scopes.includes(p.scope)
  );
}

function highestReadScope(user: UserProfile, module: string): string | null {
  const reads = user.permissions.filter((p) => p.module === module && p.action === "Read");
  if (reads.length === 0) return null;
  if (reads.some((p) => p.scope === "All")) return "All";
  if (reads.some((p) => p.scope === "Team")) return "Team";
  return "Own";
}

function maxScope(a: string | null, b: string | null): string | null {
  const rank = (s: string | null) => (s === "All" ? 3 : s === "Team" ? 2 : s === "Own" ? 1 : 0);
  if (rank(a) >= rank(b)) return a;
  return b;
}

/** Approvals tab / inbox: Leave or Approvals read with team-or-wider scope. */
export function canApproveLeave(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.some((role) => role.toUpperCase() === "ADMIN")) return true;
  const scope = maxScope(highestReadScope(user, "Leave"), highestReadScope(user, "Approvals"));
  return scope === "Team" || scope === "All";
}

export function canViewApprovalsWorkspace(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.some((role) => role.toUpperCase() === "ADMIN")) return true;
  return (
    hasPermission(user, "Approvals", "Read")
    || hasPermission(user, "Leave", "Read")
    || canApproveLeave(user)
  );
}

export function hasLicensedModule(user: UserProfile | null, module: string): boolean {
  if (!user) return false;
  return user.licensedModules.includes(module);
}

export function getEmployeeId(user: UserProfile | null): string | null {
  return user?.employeeId ?? null;
}
