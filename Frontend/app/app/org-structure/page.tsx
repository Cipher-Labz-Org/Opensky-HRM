"use client";

import { useState, useEffect, useCallback } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateDepartmentModal } from "@/components/forms/CreateDepartmentModal";
import { apiFetch } from "@/lib/api";

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentDepartmentId: string | null;
  parentDepartmentName: string | null;
  employeeCount: number;
}

interface Position {
  id: string;
  title: string;
  code: string;
  isVacant: boolean;
  departmentName: string;
  locationName: string | null;
  jobTitleName: string | null;
}

export default function OrgStructurePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, pos] = await Promise.all([
        apiFetch<Department[]>("/api/organization/departments"),
        apiFetch<Position[]>("/api/organization/positions"),
      ]);
      setDepartments(depts);
      setPositions(pos);
    } catch {
      /* keep whatever was loaded */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const topLevel = departments.filter((d) => !d.parentDepartmentId);
  const childrenOf = (parentId: string) =>
    departments.filter((d) => d.parentDepartmentId === parentId);

  return (
    <>
      <AppTopbar
        title="Organization & Position Management"
        subtitle="Legal entities, business units, departments, locations, positions, vacancies, and reporting lines."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Department</Button>
      </div>

      <CreateDepartmentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
      />

      {loading && departments.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading organization data...</div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Department tree */}
            <div className="hris-card">
              <div className="section-title">
                <h3>Departments</h3>
                <span>{departments.length} total</span>
              </div>
              {departments.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">No departments yet. Click &quot;+ New Department&quot; to add one.</p>
              ) : (
                <div className="hris-timeline">
                  {topLevel.map((dept) => (
                    <div key={dept.id}>
                      <div className="hris-timeline-item">
                        <div className="hris-timeline-date">{dept.code}</div>
                        <div className="hris-timeline-body">
                          <strong>{dept.name}</strong>
                          <div>
                            {dept.employeeCount} employee{dept.employeeCount !== 1 ? "s" : ""}
                            {dept.description ? ` · ${dept.description}` : ""}
                          </div>
                        </div>
                      </div>
                      {childrenOf(dept.id).map((sub) => (
                        <div key={sub.id} className="hris-timeline-item ml-8">
                          <div className="hris-timeline-date">{sub.code}</div>
                          <div className="hris-timeline-body">
                            <strong>{sub.name}</strong>
                            <div>{sub.employeeCount} employee{sub.employeeCount !== 1 ? "s" : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Position registry */}
            <div className="hris-card">
              <div className="section-title">
                <h3>Position Registry</h3>
                <span>{positions.length} positions</span>
              </div>
              {positions.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">No positions registered.</p>
              ) : (
                <table className="hris-table">
                  <thead>
                    <tr><th>Position</th><th>Department</th><th>Status</th></tr>
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
                <h3>Location Model</h3>
                <span>Multi-entity</span>
              </div>
              <div className="hris-list">
                <div className="hris-list-item">
                  <div><strong>Country</strong><small>Sri Lanka</small></div>
                  <span>1</span>
                </div>
                <div className="hris-list-item">
                  <div><strong>Regions</strong><small>Western, Central, Southern</small></div>
                  <span>3</span>
                </div>
                <div className="hris-list-item">
                  <div><strong>Sites</strong><small>HQ, factory, outlets, warehouses</small></div>
                  <span>46</span>
                </div>
              </div>
            </div>
            <div className="hris-card">
              <div className="section-title">
                <h3>Cost Allocation</h3>
                <span>Finance mapping</span>
              </div>
              <div className="hris-list">
                <div className="hris-list-item">
                  <div><strong>Cost center alignment</strong><small>Every position carries financial ownership</small></div>
                  <span>&#10003;</span>
                </div>
                <div className="hris-list-item">
                  <div><strong>Budgeted headcount</strong><small>Linked to annual manpower plan</small></div>
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
                  <div><strong>Effective dating</strong><small>Future org changes can be staged safely</small></div>
                  <span>&#10003;</span>
                </div>
                <div className="hris-list-item">
                  <div><strong>Position vacancy logic</strong><small>Recruitment starts from approved position</small></div>
                  <span>&#10003;</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
