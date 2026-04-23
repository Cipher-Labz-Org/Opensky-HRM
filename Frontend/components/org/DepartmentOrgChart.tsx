"use client";

export interface OrgChartDepartment {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentDepartmentId: string | null;
  businessUnitId?: string | null;
  businessUnitName?: string | null;
  employeeCount: number;
}

type Props = {
  departments: OrgChartDepartment[];
  onDelete?: (id: string) => void;
  onEdit?: (dept: OrgChartDepartment) => void;
  deletingId?: string | null;
};

function DeptCard({
  dept,
  onDelete,
  onEdit,
  deletingId,
}: {
  dept: OrgChartDepartment;
  onDelete?: (id: string) => void;
  onEdit?: (dept: OrgChartDepartment) => void;
  deletingId?: string | null;
}) {
  return (
    <div className="group relative min-w-[168px] max-w-[220px] rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center shadow-sm transition hover:border-indigo-300/80 hover:shadow-md">
      {onEdit && (
        <button
          type="button"
          title="Edit department"
          disabled={!!deletingId}
          onClick={() => onEdit(dept)}
          className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100 disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          title="Remove department"
          disabled={!!deletingId}
          onClick={() => onDelete(dept.id)}
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">{dept.code}</div>
      <div className="mt-0.5 text-sm font-semibold leading-tight text-slate-800">{dept.name}</div>
      <div className="mt-1.5 text-xs text-slate-500">
        {dept.employeeCount} employee{dept.employeeCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function Subtree({
  dept,
  childrenOf,
  onDelete,
  onEdit,
  deletingId,
}: {
  dept: OrgChartDepartment;
  childrenOf: (parentId: string) => OrgChartDepartment[];
  onDelete?: (id: string) => void;
  onEdit?: (dept: OrgChartDepartment) => void;
  deletingId?: string | null;
}) {
  const kids = childrenOf(dept.id);
  return (
    <div className="flex flex-col items-center">
      <DeptCard dept={dept} onDelete={onDelete} onEdit={onEdit} deletingId={deletingId} />
      {kids.length > 0 && (
        <>
          <div className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
          <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
            {kids.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
                <Subtree dept={child} childrenOf={childrenOf} onDelete={onDelete} onEdit={onEdit} deletingId={deletingId} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DepartmentOrgChart({ departments, onDelete, onEdit, deletingId }: Props) {
  const childrenOf = (parentId: string) => departments.filter((d) => d.parentDepartmentId === parentId);
  const roots = departments.filter((d) => !d.parentDepartmentId);

  if (departments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center text-sm text-slate-500">
        No departments yet. Add a department to build your org chart.
      </div>
    );
  }

  if (roots.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        Every department has a parent, but no root department was found. Set one department&apos;s parent to &quot;none&quot; or add a top-level unit.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex min-w-full justify-center px-4">
        <div className="flex flex-wrap items-start justify-center gap-12">
          {roots.map((root) => (
            <Subtree key={root.id} dept={root} childrenOf={childrenOf} onDelete={onDelete} onEdit={onEdit} deletingId={deletingId} />
          ))}
        </div>
      </div>
    </div>
  );
}
