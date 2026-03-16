import { AppTopbar } from "@/components/navigation/AppTopbar";

export default function EmployeeProfilePage() {
  return (
    <>
      <AppTopbar
        title="Employee 360 Profile"
        subtitle="Single employee view across personal data, job, leave, assets, payroll touchpoints, and performance."
      />

      <div className="hris-card">
        <div className="hris-profile">
          <div className="hris-avatar">AP</div>
          <div>
            <h3 className="m-0 text-xl font-semibold">Amali Perera</h3>
            <p className="mt-1.5 text-sm text-[var(--muted)]">EMP-001284 · Senior Accountant · Finance Shared Services</p>
            <div className="hris-chips mt-2">
              <span className="hris-chip" style={{ background: "#eff6ff", color: "#1e40af" }}>Colombo HQ</span>
              <span className="hris-chip">Manager: R. Fernando</span>
              <span className="hris-chip">Band M2</span>
              <span className="hris-chip">Joined 12 Jun 2021</span>
            </div>
          </div>
        </div>
        <div className="hris-meta-grid">
          <div className="hris-meta-box"><label>Employment Type</label><strong>Permanent</strong></div>
          <div className="hris-meta-box"><label>Attendance Pattern</label><strong>Hybrid - Mon to Fri</strong></div>
          <div className="hris-meta-box"><label>Payroll Status</label><strong>Synced to payroll</strong></div>
          <div className="hris-meta-box"><label>Leave Balance</label><strong>14 Annual / 6 Casual</strong></div>
          <div className="hris-meta-box"><label>Probation / Review</label><strong>Completed</strong></div>
          <div className="hris-meta-box"><label>Succession Pool</label><strong>Ready in 1 year</strong></div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Core Information</h3>
            <span>Editable sections</span>
          </div>
          <div className="hris-form-grid">
            <div className="hris-field"><label>NIC / Passport</label><div>913451235V</div></div>
            <div className="hris-field"><label>Mobile</label><div>+94 77 555 2345</div></div>
            <div className="hris-field"><label>Email</label><div>amali.perera@company.com</div></div>
            <div className="hris-field"><label>Cost Center</label><div>FIN-110</div></div>
            <div className="hris-field"><label>Bank Account</label><div>Masked / Verified</div></div>
            <div className="hris-field"><label>Emergency Contact</label><div>W. Perera - Spouse</div></div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Active Cases</h3>
            <span>HR + manager actions</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Goal cycle 2026 Q1</strong><small>Employee self-assessment submitted</small></div>
              <span className="badge badge-blue">Review</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Salary increment proposal</strong><small>Effective 01 Apr 2026</small></div>
              <span className="badge badge-orange">Pending</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Training nomination</strong><small>Advanced IFRS workshop</small></div>
              <span className="badge badge-green">Approved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Leave History</h3>
            <span>Last 6 months</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Type</th><th>Days</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Annual Leave</td><td>3.0</td><td><span className="badge badge-green">Taken</span></td></tr>
              <tr><td>Medical</td><td>1.0</td><td><span className="badge badge-green">Taken</span></td></tr>
              <tr><td>Half Day</td><td>0.5</td><td><span className="badge badge-blue">Planned</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Assets & Access</h3>
            <span>IT and admin</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Item</th><th>ID</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Laptop</td><td>IT-8891</td><td><span className="badge badge-green">Assigned</span></td></tr>
              <tr><td>ID Card</td><td>ID-1284</td><td><span className="badge badge-green">Active</span></td></tr>
              <tr><td>Finance ERP Role</td><td>ERP-FN-07</td><td><span className="badge badge-blue">Provisioned</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Compensation Summary</h3>
            <span>Protected access</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Component</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Base Salary</td><td>LKR 245,000</td></tr>
              <tr><td>Travel Allowance</td><td>LKR 18,000</td></tr>
              <tr><td>Last Revision</td><td>01 Jan 2026</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
