"use client";

import { DepartmentOrgChart, type OrgChartDepartment } from "./DepartmentOrgChart";

export interface OrgChartBusinessUnit {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

type Props = {
  companyName: string;
  businessUnits: OrgChartBusinessUnit[];
  departments: OrgChartDepartment[];
  onDeleteDepartment?: (id: string) => void;
  onEditDepartment?: (dept: OrgChartDepartment) => void;
  deletingId?: string | null;
};

/** Departments that belong to a BU tree: roots assigned to the BU plus all descendants. */
function departmentForestForBu(all: OrgChartDepartment[], businessUnitId: string | null): OrgChartDepartment[] {
  const roots = all.filter(
    (d) => (d.businessUnitId ?? null) === businessUnitId && !d.parentDepartmentId
  );
  const included = new Set<string>();

  function walk(id: string) {
    if (included.has(id)) return;
    included.add(id);
    for (const c of all) {
      if (c.parentDepartmentId === id) walk(c.id);
    }
  }

  roots.forEach((r) => walk(r.id));
  return all.filter((d) => included.has(d.id));
}

function CompanyCard({ name }: { name: string }) {
  return (
    <div className="rounded-xl border-2 border-[#2B7DE9]/30 bg-gradient-to-br from-slate-50 to-blue-50/80 px-6 py-4 text-center shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#2B7DE9]">Company</div>
      <div className="mt-1 text-lg font-bold text-slate-800">{name || "Organization"}</div>
      <div className="mt-1 text-xs text-slate-500">Set name under Policy &amp; Settings → Company details</div>
    </div>
  );
}

function BusinessUnitCard({ bu }: { bu: OrgChartBusinessUnit }) {
  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/60 px-4 py-2.5 text-center">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{bu.code}</div>
      <div className="text-sm font-semibold text-indigo-950">{bu.name}</div>
      <div className="text-[10px] text-indigo-600/80">Business unit</div>
    </div>
  );
}

export function CompanyOrgHierarchy({
  companyName,
  businessUnits,
  departments,
  onDeleteDepartment,
  onEditDepartment,
  deletingId,
}: Props) {
  const activeBus = businessUnits.filter((b) => b.isActive);
  const unassignedForest = departmentForestForBu(departments, null);

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--text-muted)]">
        Structure is <strong className="text-slate-700">Company</strong> (from settings) →{" "}
        <strong className="text-slate-700">business units</strong> (subsidiaries / divisions) →{" "}
        <strong className="text-slate-700">departments</strong>. Hover a department card and use the pencil to edit, or create a new department from the toolbar.
      </p>

      <div className="flex flex-col items-center">
        <CompanyCard name={companyName} />
        {activeBus.length > 0 && <div className="h-6 w-px bg-slate-300" aria-hidden />}
        {activeBus.length === 0 && departments.length > 0 && (
          <div className="mt-4 w-full max-w-xl rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
            No active business units found. Add business units under organization administration, then link departments to a unit using{" "}
            <strong>New department</strong> (or assign <code className="rounded bg-amber-100/80 px-1">BusinessUnitId</code> via API).
          </div>
        )}
        {activeBus.length > 0 && (
          <div className="flex w-full flex-wrap items-start justify-center gap-10 pt-2">
            {activeBus.map((bu) => {
              const forest = departmentForestForBu(departments, bu.id);
              return (
                <div key={bu.id} className="flex max-w-full flex-col items-center">
                  <div className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
                  <BusinessUnitCard bu={bu} />
                  <div className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
                  {forest.length > 0 ? (
                    <DepartmentOrgChart
                      departments={forest}
                      onDelete={onDeleteDepartment}
                      onEdit={onEditDepartment}
                      deletingId={deletingId}
                    />
                  ) : (
                    <div className="mt-2 max-w-xs rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-500">
                      No departments linked to this unit. Create a department and choose this business unit, or set{" "}
                      <strong>Parent</strong> under a root that is already linked here.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {unassignedForest.length > 0 && (
        <div className="hris-card border-amber-100 bg-amber-50/20">
          <div className="section-title">
            <h3>Departments without a business unit</h3>
            <span>{unassignedForest.length} in tree</span>
          </div>
          <p className="mb-4 text-xs text-amber-900/80">
            These root departments are not assigned to any unit. Assign a business unit so they appear under the correct company branch.
          </p>
          <DepartmentOrgChart
            departments={unassignedForest}
            onDelete={onDeleteDepartment}
            onEdit={onEditDepartment}
            deletingId={deletingId}
          />
        </div>
      )}

      {activeBus.length === 0 && departments.length === 0 && (
        <DepartmentOrgChart departments={[]} onDelete={onDeleteDepartment} onEdit={onEditDepartment} deletingId={deletingId} />
      )}
    </div>
  );
}
