import { AppTopbar } from "@/components/navigation/AppTopbar";

export default function AnalyticsPage() {
  return (
    <>
      <AppTopbar
        title="Reporting & Workforce Analytics"
        subtitle="Operational reports, executive dashboards, workforce planning, and decision support."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Headcount Growth", value: "+8.4%", sub: "Year on year" },
          { label: "Attrition", value: "11.2%", sub: "Annualized" },
          { label: "Time-to-fill", value: "24d", sub: "Talent acquisition KPI" },
          { label: "Training Completion", value: "78%", sub: "Mandatory programs" },
        ].map((kpi) => (
          <div key={kpi.label} className="hris-card kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Standard Report Packs</h3>
            <span>Export to PDF/Excel</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Employee master reports</strong><small>Headcount, demographics, movement</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Leave & attendance reports</strong><small>Absence trends, late punches, overtime</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Recruitment reports</strong><small>Source effectiveness, offer ratio, cycle time</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Talent reports</strong><small>Goals, calibration, succession readiness</small></div>
              <span>→</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Executive Storyboards</h3>
            <span>Decision focused</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Dashboard</th><th>Audience</th><th>Refresh</th></tr></thead>
            <tbody>
              <tr><td>CEO Workforce Cockpit</td><td>C-suite</td><td>Daily</td></tr>
              <tr><td>HR Operations Dashboard</td><td>HR shared services</td><td>Hourly</td></tr>
              <tr><td>Manager Team Pulse</td><td>Line managers</td><td>Daily</td></tr>
              <tr><td>Talent & Succession Board</td><td>Leadership</td><td>Monthly</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 hris-card">
        <div className="section-title">
          <h3>Predictive & Advanced Insights</h3>
          <span>Phase 2 / 3 enhancements</span>
        </div>
        <table className="hris-table">
          <thead>
            <tr><th>Use Case</th><th>Inputs</th><th>Outcome</th></tr>
          </thead>
          <tbody>
            <tr><td>Attrition risk</td><td>Attendance, tenure, manager changes, salary position</td><td>Retention intervention list</td></tr>
            <tr><td>Absence forecasting</td><td>Seasonality, shift patterns, leave trends</td><td>Staffing risk alerts</td></tr>
            <tr><td>Hiring demand planning</td><td>Approved headcount, vacancies, growth plans</td><td>Recruitment capacity planning</td></tr>
            <tr><td>Skill gap heatmap</td><td>Role matrix, learning completion, assessments</td><td>Training investment priorities</td></tr>
          </tbody>
        </table>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
