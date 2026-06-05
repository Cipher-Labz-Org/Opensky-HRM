"use client";

import { appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateDepartmentModal } from "@/components/forms/CreateDepartmentModal";
import { apiFetch } from "@/lib/api";
import { CompanyOrgHierarchy, type OrgChartBusinessUnit } from "./CompanyOrgHierarchy";
import { EmployeeHierarchyChart, type ReportingHierarchyNode } from "./EmployeeHierarchyChart";
import { type OrgChartDepartment } from "./DepartmentOrgChart";

interface Position {
  id: string;
  title: string;
  code: string;
  isVacant: boolean;
  departmentName: string;
  locationName: string | null;
  jobTitleName: string | null;
}

type Tab = "chart" | "reporting" | "registry";

const kpiTileClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const contentCard = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export function OrgStructureVisualizer({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<OrgChartDepartment | null>(null);
  const [departments, setDepartments] = useState<OrgChartDepartment[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [businessUnits, setBusinessUnits] = useState<OrgChartBusinessUnit[]>([]);
  const [reportingHierarchy, setReportingHierarchy] = useState<ReportingHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, pos, settings, bus, hierarchy] = await Promise.all([
        apiFetch<OrgChartDepartment[]>("/api/organization/departments"),
        apiFetch<Position[]>("/api/organization/positions"),
        apiFetch<Record<string, string>>("/api/system-settings").catch(() => ({}) as Record<string, string>),
        apiFetch<Array<{ id: string; name: string; code: string; isActive: boolean }>>("/api/organization/business-units").catch(
          () => []
        ),
        apiFetch<ReportingHierarchyNode[]>("/api/organization/reporting-hierarchy").catch(() => []),
      ]);
      setDepartments(Array.isArray(depts) ? depts : []);
      setPositions(Array.isArray(pos) ? pos : []);
      setCompanyName(typeof settings.CompanyName === "string" ? settings.CompanyName : "");
      setBusinessUnits(
        Array.isArray(bus)
          ? bus.map((b) => ({ id: b.id, name: b.name, code: b.code, isActive: b.isActive !== false }))
          : []
      );
      setReportingHierarchy(Array.isArray(hierarchy) ? hierarchy : []);
    } catch {
      /* keep prior data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadData]);

  const childrenOf = (parentId: string) => departments.filter((d) => d.parentDepartmentId === parentId);
  const topLevel = departments.filter((d) => !d.parentDepartmentId);

  function RecursiveList({ parentId, depth }: { parentId: string | null; depth: number }) {
    const list = parentId === null ? topLevel : childrenOf(parentId);
    if (list.length === 0) return null;
    return (
      <>
        {list.map((dept) => (
          <div key={dept.id}>
            <div className={`hris-timeline-item ${depth > 0 ? "ml-8" : ""}`}>
              <div className="hris-timeline-date">{dept.code}</div>
              <div className="hris-timeline-body">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong>{dept.name}</strong>
                    <div>
                      {dept.employeeCount} employee{dept.employeeCount !== 1 ? "s" : ""}
                      {dept.description ? ` · ${dept.description}` : ""}
                    </div>
                    {dept.businessUnitName ? (
                      <div className="mt-0.5 text-xs font-medium text-indigo-600">Business unit: {dept.businessUnitName}</div>
                    ) : (
                      <div className="mt-0.5 text-xs text-amber-700/90">No business unit assigned</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="Edit department"
                      disabled={!!deletingId}
                      onClick={() => {
                        setEditingDepartment(dept);
                        setDeptModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Delete department"
                      disabled={!!deletingId}
                      onClick={() => handleDeleteDepartment(dept)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <RecursiveList parentId={dept.id} depth={depth + 1} />
          </div>
        ))}
      </>
    );
  }

  async function handleDeleteDepartment(dept: OrgChartDepartment) {
    const kids = childrenOf(dept.id);
    const msg =
      kids.length > 0
        ? `Delete "${dept.name}"? Sub-departments must be reassigned or removed first. This action cannot be undone.`
        : `Delete department "${dept.name}"? This cannot be undone.`;
    if (!(await appConfirm(msg))) return;
    setDeletingId(dept.id);
    setNotice(null);
    try {
      await apiFetch(`/api/organization/departments/${dept.id}`, { method: "DELETE" });
      setNotice({ type: "ok", text: `Removed "${dept.name}".` });
      await loadData();
    } catch (e) {
      setNotice({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete department.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const title =
    tab === "chart"
      ? "Organization chart"
      : tab === "reporting"
        ? "Reporting hierarchy"
        : "Organization & position management";
  const subtitle =
    tab === "chart"
      ? "Company structure by business units and departments."
      : tab === "reporting"
        ? "Supervisor-based hierarchy from employee reporting lines."
        : "Legal entities, business units, departments, locations, and positions.";

  const activeBuCount = useMemo(() => businessUnits.filter((b) => b.isActive).length, [businessUnits]);

  const kpiStats = useMemo(
    () => [
      { label: "Departments", value: departments.length, sub: "In directory" },
      { label: "Positions", value: positions.length, sub: "Registry records" },
      { label: "Business units", value: activeBuCount, sub: `${businessUnits.length} configured` },
      { label: "Reporting trees", value: reportingHierarchy.length, sub: "Supervisor hierarchy roots" },
    ],
    [departments.length, positions.length, activeBuCount, businessUnits.length, reportingHierarchy.length]
  );

  return (
    <>
      <AppTopbar title={title} subtitle={subtitle} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiStats.map((k) => (
          <div key={k.label} className={kpiTileClass}>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</div>
            <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{k.value}</div>
            <div className="mt-2 text-xs text-slate-600">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${panelClass} p-4`}>
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("chart")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "chart" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Org chart
          </button>
          <button
            type="button"
            onClick={() => setTab("reporting")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "reporting" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Reporting hierarchy
          </button>
          <button
            type="button"
            onClick={() => setTab("registry")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "registry" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Registry & details
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" type="button" onClick={() => loadData()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditingDepartment(null);
              setDeptModalOpen(true);
            }}
          >
            + New department
          </Button>
        </div>
      </div>

      <CreateDepartmentModal
        open={deptModalOpen}
        onClose={() => {
          setDeptModalOpen(false);
          setEditingDepartment(null);
        }}
        onCreated={loadData}
        editingDepartment={editingDepartment}
      />

      {notice && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            notice.type === "ok"
              ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-900"
              : "border-rose-200/80 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && departments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500 shadow-sm">
          Loading organization data…
        </div>
      ) : tab === "chart" ? (
        <div className={contentCard}>
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-800">Company → units → departments</h3>
            <span className="text-xs text-slate-500">{departments.length} departments</span>
          </div>
          <CompanyOrgHierarchy
            companyName={companyName}
            businessUnits={businessUnits}
            departments={departments}
            onDeleteDepartment={(id) => {
              const d = departments.find((x) => x.id === id);
              if (d) void handleDeleteDepartment(d);
            }}
            onEditDepartment={(d) => {
              setEditingDepartment(d);
              setDeptModalOpen(true);
            }}
            deletingId={deletingId}
          />
        </div>
      ) : tab === "reporting" ? (
        <div className={contentCard}>
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-800">Reporting hierarchy (supervisors)</h3>
            <span className="text-xs text-slate-500">{reportingHierarchy.length} root node(s)</span>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Built from <strong className="text-slate-800">direct supervisors</strong>, manager assignments, and{" "}
            <strong className="text-slate-800">head of organization</strong> metadata.
          </p>
          <EmployeeHierarchyChart roots={reportingHierarchy} />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={contentCard}>
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-semibold text-slate-800">Departments</h3>
                <span className="text-xs text-slate-500">{departments.length} total</span>
              </div>
              {departments.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No departments yet. Click &quot;+ New department&quot; to add one.
                </p>
              ) : (
                <div className="hris-timeline max-h-[70vh] overflow-y-auto pr-1">
                  <RecursiveList parentId={null} depth={0} />
                </div>
              )}
            </div>

            <div className={contentCard}>
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-semibold text-slate-800">Position registry</h3>
                <span className="text-xs text-slate-500">{positions.length} positions</span>
              </div>
              {positions.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No positions registered.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="hris-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Department</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.id}>
                        <td>{p.title}</td>
                        <td>{p.departmentName}</td>
                        <td>
                          <span className={`badge ${p.isVacant ? "badge-orange" : "badge-green"}`}>
                            {p.isVacant ? "Vacant" : "Filled"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </>
  );
}
