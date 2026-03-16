import { AppTopbar } from "@/components/navigation/AppTopbar";

export default function SettingsPage() {
  return (
    <>
      <AppTopbar
        title="Policy, Security & Configuration"
        subtitle="Workflow engine, role-based access, localization, statutory rules, and platform administration."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Workflow Builder</h3>
            <span>No-code flow control</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Leave approval chain</strong><small>Employee → Manager → HR for exceptions</small></div>
              <span className="badge badge-blue">Live</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Salary revision</strong><small>Manager → HR → Finance → CEO</small></div>
              <span className="badge badge-orange">Restricted</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Separation clearance</strong><small>HR, IT, Admin, Finance sign-off</small></div>
              <span className="badge badge-blue">Live</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Security Model</h3>
            <span>Granular access</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Role</th><th>Scope</th></tr></thead>
            <tbody>
              <tr><td>Employee</td><td>Self-service only</td></tr>
              <tr><td>Manager</td><td>Direct team and approvals</td></tr>
              <tr><td>HRBP</td><td>Assigned business units</td></tr>
              <tr><td>HR Admin</td><td>Full operational control</td></tr>
              <tr><td>Payroll Admin</td><td>Compensation-restricted</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Localization</h3>
            <span>Multi-country ready</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Company calendars</strong><small>Public holidays and work week</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Leave rules</strong><small>Country/entity specific entitlements</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Currencies & language packs</strong><small>Regional deployment ready</small></div>
              <span>✓</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Audit & Compliance</h3>
            <span>Non-negotiable enterprise controls</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Control</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>Audit trail</td><td>Every master and transaction change logged with user, time, old/new value</td></tr>
              <tr><td>Document retention</td><td>Controlled storage and expiry/removal policies</td></tr>
              <tr><td>PII protection</td><td>Field masking, encryption, scoped exports</td></tr>
              <tr><td>Approval evidence</td><td>Who approved, comments, timestamps, attached files</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Platform Settings</h3>
            <span>Architecture hooks</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>API integrations</strong><small>Payroll, biometrics, email, identity provider</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Notification engine</strong><small>Email, in-app, SMS, Teams/Slack optional</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Master configuration</strong><small>Legal entities, documents, lookups, numbering</small></div>
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
