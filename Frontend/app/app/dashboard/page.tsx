"use client";

import { useCallback, useEffect, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface MyTask {
  id: string;
  title: string;
  category: string;
  isCompleted: boolean;
  dueDate: string | null;
  assignmentType: string;
  taskType: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
}

export default function DashboardPage() {
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  const loadMyTasks = useCallback(async () => {
    try {
      const tasks = await apiFetch<MyTask[]>("/api/employee-tasks/my-tasks");
      setMyTasks(tasks);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMyTasks(); }, [loadMyTasks]);

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    try {
      await apiFetch(`/api/offboarding/tasks/${taskId}/complete`, { method: "POST" });
      setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch { alert("Failed to complete task"); }
    setCompleting(null);
  }

  return (
    <>
      <AppTopbar
        title="Executive Dashboard"
        subtitle="Unified command center for HR, managers, and employees."
      />

      {/* ── My Pending Offboarding Tasks ─────────────────────────── */}
      {myTasks.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
          <div className="flex items-center gap-3 border-b border-amber-200 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">My Pending Tasks</h3>
              <p className="text-xs text-amber-600">{myTasks.length} task{myTasks.length !== 1 ? "s" : ""} assigned to you</p>
            </div>
          </div>
          <div className="divide-y divide-amber-100">
            {myTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-6 py-3">
                <button
                  type="button"
                  disabled={completing === task.id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleComplete(task.id); }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 text-amber-400 transition hover:bg-amber-400 hover:text-white cursor-pointer"
                  title="Mark as complete"
                >
                  {completing === task.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800">{task.title}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <a href={`/app/people/${task.employeeId}`} className="relative z-10 text-xs text-blue-600 hover:underline">
                      {task.employeeName}
                    </a>
                    <span className="text-xs text-slate-400">({task.employeeCode})</span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${task.taskType === "Onboarding" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{task.taskType}</span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">{task.category}</span>
                {task.assignmentType === "Supervisor" && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/70 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    Supervisor
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hris-hero">
        <h3>Complete HRIS operating model</h3>
        <p>
          This concept blends employee records, talent acquisition, onboarding, leave, time, payroll integration, performance, learning, organization management, and workforce analytics into one role-based experience. The dashboard is designed to surface urgent approvals, risk alerts, workforce metrics, and action-oriented widgets.
        </p>
        <div className="hris-chips">
          <span className="hris-chip">Role-based widgets</span>
          <span className="hris-chip">Compliance reminders</span>
          <span className="hris-chip">Manager approvals</span>
          <span className="hris-chip">AI-ready assistant zone</span>
          <span className="hris-chip">Cross-module shortcuts</span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Employees", value: "2,486", sub: "+4.8% vs last month" },
          { label: "Open Requisitions", value: "37", sub: "12 urgent positions" },
          { label: "Pending Approvals", value: "58", sub: "Leave, claims, onboarding tasks" },
          { label: "Attrition Risk", value: "6.2%", sub: "AI watchlist: 18 employees" },
        ].map((kpi) => (
          <div key={kpi.label} className="hris-card kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>My Action Center</h3>
            <span>Today</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Approve leave request</strong><small>Finance - 2 requests awaiting supervisor</small></div>
              <span className="badge badge-orange">2 pending</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Confirm onboarding tasks</strong><small>3 employees start tomorrow</small></div>
              <span className="badge badge-blue">3 tasks</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Performance review due</strong><small>Quarterly review closes in 4 days</small></div>
              <span className="badge badge-red">High</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Workforce Snapshot</h3>
            <span>By business unit</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Unit</th><th>Headcount</th><th>Attendance</th></tr>
            </thead>
            <tbody>
              <tr><td>Retail Operations</td><td>712</td><td><span className="badge badge-green">96.4%</span></td></tr>
              <tr><td>Manufacturing</td><td>530</td><td><span className="badge badge-green">94.8%</span></td></tr>
              <tr><td>Head Office</td><td>241</td><td><span className="badge badge-blue">92.6%</span></td></tr>
              <tr><td>Logistics</td><td>386</td><td><span className="badge badge-orange">89.7%</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>HR Program Health</h3>
            <span>Completion</span>
          </div>
          <div className="hris-list">
            <div>
              <strong>Mandatory compliance training</strong>
              <div className="progress-bar mt-2"><span style={{ width: "78%" }}></span></div>
              <small>78% completed</small>
            </div>
            <div className="mt-3">
              <strong>Probation evaluations</strong>
              <div className="progress-bar mt-2"><span style={{ width: "61%" }}></span></div>
              <small>61% completed</small>
            </div>
            <div className="mt-3">
              <strong>Succession bench readiness</strong>
              <div className="progress-bar mt-2"><span style={{ width: "42%" }}></span></div>
              <small>42% positions covered</small>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Recent Workforce Events</h3>
            <span>Live feed</span>
          </div>
          <div className="hris-timeline">
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">09:30 AM</div>
              <div className="hris-timeline-body">
                <strong>New requisition approved</strong>
                <div>Senior Supply Planner - Manufacturing approved by COO.</div>
              </div>
            </div>
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">10:15 AM</div>
              <div className="hris-timeline-body">
                <strong>Policy change published</strong>
                <div>2026 travel reimbursement policy distributed to all employees.</div>
              </div>
            </div>
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">11:05 AM</div>
              <div className="hris-timeline-body">
                <strong>Attendance anomaly detected</strong>
                <div>Outlet Kandy flagged for repeated late punches.</div>
              </div>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Quick Links</h3>
            <span>Frequently used</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Employee Change Requests</strong><small>Transfers, promotions, salary revisions</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Org Chart Explorer</strong><small>Positions, vacancies, reporting lines</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Payroll Interface Queue</strong><small>Pending synchronization with payroll engine</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Recruitment Pipeline</strong><small>View candidate status and interview load</small></div>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
