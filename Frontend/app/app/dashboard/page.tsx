import { AppTopbar } from "@/components/navigation/AppTopbar";

export default function DashboardPage() {
  return (
    <>
      <AppTopbar
        title="Executive Dashboard"
        subtitle="Unified command center for HR, managers, and employees."
      />

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
