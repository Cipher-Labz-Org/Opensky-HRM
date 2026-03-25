"use client";

export interface ReportingHierarchyNode {
  id: string;
  employeeCode: string;
  fullName: string;
  jobTitleName?: string | null;
  departmentName?: string | null;
  isTopOfHierarchy: boolean;
  children: ReportingHierarchyNode[];
}

function EmployeeCard({ node }: { node: ReportingHierarchyNode }) {
  return (
    <div
      className={`rounded-xl border-2 bg-white px-4 py-3 text-center shadow-sm min-w-[200px] max-w-[260px] ${
        node.isTopOfHierarchy ? "border-[#2B7DE9]/40" : "border-slate-200"
      }`}
    >
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">{node.employeeCode}</div>
      <div className="mt-0.5 text-sm font-semibold leading-tight text-slate-800">{node.fullName}</div>
      <div className="mt-1 text-xs text-slate-500">{node.jobTitleName || "No job title"}</div>
      <div className="text-[11px] text-slate-500/90">{node.departmentName || "No department"}</div>
      {node.isTopOfHierarchy && (
        <div className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2B7DE9]">
          Head of organization
        </div>
      )}
    </div>
  );
}

function TreeNode({ node }: { node: ReportingHierarchyNode }) {
  return (
    <div className="flex flex-col items-center">
      <EmployeeCard node={node} />
      {node.children.length > 0 && (
        <>
          <div className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
          <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
                <TreeNode node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EmployeeHierarchyChart({ roots }: { roots: ReportingHierarchyNode[] }) {
  if (roots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center text-sm text-slate-500">
        No reporting hierarchy data found. Add supervisors or mark the head of organization to build the hierarchy.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex min-w-full justify-center px-4">
        <div className="flex flex-wrap items-start justify-center gap-12">
          {roots.map((root) => (
            <TreeNode key={root.id} node={root} />
          ))}
        </div>
      </div>
    </div>
  );
}
