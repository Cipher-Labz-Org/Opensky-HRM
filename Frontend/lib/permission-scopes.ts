export type RbacScope = "Own" | "Team" | "All";

type PermissionRow = { module: string; action: string; scope?: string | null };

function scopeRank(scope: string | null | undefined): number {
  switch (scope ?? "Own") {
    case "All":
      return 3;
    case "Team":
      return 2;
    case "Own":
      return 1;
    default:
      return 0;
  }
}

export function maxRbacScope(a: RbacScope | null, b: RbacScope | null): RbacScope | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return scopeRank(a) >= scopeRank(b) ? a : b;
}

/** Highest Read scope for a module (multiple roles merged). */
export function getModuleReadScope(
  permissions: ReadonlyArray<PermissionRow>,
  module: string,
): RbacScope | null {
  const reads = permissions.filter((p) => p.module === module && p.action === "Read");
  if (reads.length === 0) return null;
  const norm = (scope: string | null | undefined) => {
    const s = (scope ?? "").trim();
    if (s === "" || s === "All") return "All";
    if (s === "Team") return "Team";
    return "Own";
  };
  if (reads.some((p) => norm(p.scope) === "All")) return "All";
  if (reads.some((p) => norm(p.scope) === "Team")) return "Team";
  return "Own";
}

/** Leave request lists: broadest of Leave and Approvals Read scopes. */
export function getLeaveRequestsReadScope(
  permissions: ReadonlyArray<PermissionRow>,
): RbacScope | null {
  return maxRbacScope(getModuleReadScope(permissions, "Leave"), getModuleReadScope(permissions, "Approvals"));
}
