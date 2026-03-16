import { AppTopbar } from "@/components/navigation/AppTopbar";

export default function OrgStructurePage() {
  return (
    <>
      <AppTopbar
        title="Organization & Position Management"
        subtitle="Legal entities, business units, departments, locations, positions, vacancies, and reporting lines."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Organization Tree</h3>
            <span>Position-driven</span>
          </div>
          <div className="hris-timeline">
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">CEO</div>
              <div className="hris-timeline-body">
                <strong>Corporate Office</strong>
                <div>4 direct reports · 2 vacant strategic roles</div>
              </div>
            </div>
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">COO</div>
              <div className="hris-timeline-body">
                <strong>Operations Division</strong>
                <div>Manufacturing, Logistics, Retail Operations</div>
              </div>
            </div>
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">CHRO</div>
              <div className="hris-timeline-body">
                <strong>People & Culture</strong>
                <div>Shared services, talent, L&D, employee relations</div>
              </div>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Position Registry</h3>
            <span>Approved headcount</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Position</th><th>Unit</th><th>Status</th><th>Occupant</th></tr></thead>
            <tbody>
              <tr><td>Senior HR Executive</td><td>HR</td><td><span className="badge badge-green">Filled</span></td><td>N. Jayasena</td></tr>
              <tr><td>Factory Planner</td><td>Manufacturing</td><td><span className="badge badge-orange">Vacant</span></td><td>-</td></tr>
              <tr><td>Outlet Supervisor</td><td>Retail</td><td><span className="badge badge-green">Filled</span></td><td>K. Silva</td></tr>
              <tr><td>Data Analyst</td><td>IT</td><td><span className="badge badge-red">Frozen</span></td><td>-</td></tr>
            </tbody>
          </table>
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
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Budgeted headcount</strong><small>Linked to annual manpower plan</small></div>
              <span>✓</span>
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
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Position vacancy logic</strong><small>Recruitment starts from approved position</small></div>
              <span>✓</span>
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
