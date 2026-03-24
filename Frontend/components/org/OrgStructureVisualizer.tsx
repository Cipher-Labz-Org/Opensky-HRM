"use client";

import { useState, useEffect, useCallback } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateDepartmentModal } from "@/components/forms/CreateDepartmentModal";
import { apiFetch } from "@/lib/api";
import { CompanyOrgHierarchy, type OrgChartBusinessUnit } from "./CompanyOrgHierarchy";
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

type Tab = "chart" | "registry";

export function OrgStructureVisualizer({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<OrgChartDepartment | null>(null);
  const [departments, setDepartments] = useState<OrgChartDepartment[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [businessUnits, setBusinessUnits] = useState<OrgChartBusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, pos, settings, bus] = await Promise.all([
        apiFetch<OrgChartDepartment[]>("/api/organization/departments"),
        apiFetch<Position[]>("/api/organization/positions"),
        apiFetch<Record<string, string>>("/api/system-settings").catch(() => ({}) as Record<string, string>),
        apiFetch<Array<{ id: string; name: string; code: string; isActive: boolean }>>("/api/organization/business-units").catch(
          () => []
        ),
      ]);
      setDepartments(Array.isArray(depts) ? depts : []);
      setPositions(Array.isArray(pos) ? pos : []);
      setCompanyName(typeof settings.CompanyName === "string" ? settings.CompanyName : "");
      setBusinessUnits(
        Array.isArray(bus)
          ? bus.map((b) => ({ id: b.id, name: b.name, code: b.code, isActive: b.isActive !== false }))
          : []
      );
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
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-[#2B7DE9] disabled:opacity-40"
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
    if (!window.confirm(msg)) return;
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

  const title = initialTab === "chart" ? "Organization chart" : "Organization & position management";
  const subtitle =
    initialTab === "chart"
      ? "Live hierarchy from departments. Refreshes when you return to this tab or click Refresh."
      : "Legal entities, business units, departments, locations, positions, vacancies, and reporting lines.";

  return (
    <>
      <AppTopbar title={title} subtitle={subtitle} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("chart")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "chart" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Org chart
          </button>
          <button
            type="button"
            onClick={() => setTab("registry")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "registry" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Registry & details
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
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
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${notice.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}
        >
          {notice.text}
        </div>
      )}

      {loading && departments.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading organization data…</div>
      ) : tab === "chart" ? (
        <div className="hris-card">
          <div className="section-title">
            <h3>Company → units → departments</h3>
            <span>{departments.length} departments</span>
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
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="hris-card">
              <div className="section-title">
                <h3>Departments</h3>
                <span>{departments.length} total</span>
              </div>
              {departments.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                  No departments yet. Click &quot;+ New department&quot; to add one.
                </p>
              ) : (
                <div className="hris-timeline">
                  <RecursiveList parentId={null} depth={0} />
                </div>
              )}
            </div>

            <div className="hris-card">
              <div className="section-title">
                <h3>Position registry</h3>
                <span>{positions.length} positions</span>
              </div>
              {positions.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">No positions registered.</p>
              ) : (
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
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="hris-card">
              <div className="section-title">
                <h3>Location model</h3>
                <span>Multi-entity</span>
              </div>
              <div className="hris-list">
                <div className="hris-list-item">
                  <div>
                    <strong>Country</strong>
                    <small>Sri Lanka</small>
                  </div>
                  <span>1</span>
                </div>
                <div className="hris-list-item">
                  <div>
                    <strong>Regions</strong>
                    <small>Western, Central, Southern</small>
                  </div>
                  <span>3</span>
                </div>
                <div className="hris-list-item">
                  <div>
                    <strong>Sites</strong>
                    <small>HQ, factory, outlets, warehouses</small>
                  </div>
                  <span>46</span>
                </div>
              </div>
            </div>
            <div className="hris-card">
              <div className="section-title">
                <h3>Cost allocation</h3>
                <span>Finance mapping</span>
              </div>
              <div className="hris-list">
                <div className="hris-list-item">
                  <div>
                    <strong>Cost center alignment</strong>
                    <small>Every position carries financial ownership</small>
                  </div>
                  <span>&#10003;</span>
                </div>
                <div className="hris-list-item">
                  <div>
                    <strong>Budgeted headcount</strong>
                    <small>Linked to annual manpower plan</small>
                  </div>
                  <span>&#10003;</span>
                </div>
              </div>
            </div>
            <div className="hris-card">
              <div className="section-title">
                <h3>Controls</h3>
                <span>Architectural must-have</span>
              </div>
              <div className="hris-list">
                <div className="hris-list-item">
                  <div>
                    <strong>Effective dating</strong>
                    <small>Future org changes can be staged safely</small>
                  </div>
                  <span>&#10003;</span>
                </div>
                <div className="hris-list-item">
                  <div>
                    <strong>Position vacancy logic</strong>
                    <small>Recruitment starts from approved position</small>
                  </div>
                  <span>&#10003;</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <p className="footer-note mt-6">
        Chart and lists load from the live API. Add or remove departments to see updates after refresh or when you switch back to this browser tab.
      </p>
    </>
  );
}
