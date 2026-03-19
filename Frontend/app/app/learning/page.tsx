"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateCourseModal } from "@/components/forms/CreateCourseModal";

export default function LearningPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Learning & Skills"
        subtitle="Learning catalog, certifications, mandatory training, skill matrices, and career path enablement."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Course</Button>
      </div>

      <CreateCourseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Learning Catalog</h3>
            <span>Curated paths</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Leadership Academy</strong><small>For managers and successors</small></div>
              <span className="badge badge-blue">18 courses</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Compliance</strong><small>Mandatory safety, policy, privacy</small></div>
              <span className="badge badge-orange">12 courses</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Role Skills</strong><small>Job-family based curriculum</small></div>
              <span className="badge badge-green">52 paths</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Certification Tracker</h3>
            <span>Expiry management</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Certification</th><th>Assigned</th><th>Expiring</th></tr></thead>
            <tbody>
              <tr><td>Food Safety Level 2</td><td>128</td><td>11</td></tr>
              <tr><td>Forklift License</td><td>36</td><td>4</td></tr>
              <tr><td>Data Privacy</td><td>860</td><td>0</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Skill Matrix</h3>
            <span>Factory operations sample</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Skill</th><th>Coverage</th><th>Gap</th></tr></thead>
            <tbody>
              <tr><td>Machine setup</td><td>78%</td><td><span className="badge badge-orange">Need 6</span></td></tr>
              <tr><td>Quality inspection</td><td>92%</td><td><span className="badge badge-green">Healthy</span></td></tr>
              <tr><td>Lean reporting</td><td>48%</td><td><span className="badge badge-red">Critical</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 hris-card">
        <div className="section-title">
          <h3>Career & Capability Mapping</h3>
          <span>Role-based growth</span>
        </div>
        <table className="hris-table">
          <thead>
            <tr><th>Job Family</th><th>Current Role</th><th>Next Roles</th><th>Required Courses</th><th>Assessment</th></tr>
          </thead>
          <tbody>
            <tr><td>Finance</td><td>Accountant</td><td>Senior Accountant → Assistant Manager</td><td>IFRS, Power BI, People leadership</td><td>Skill + performance</td></tr>
            <tr><td>Retail</td><td>Cashier</td><td>Senior Cashier → Outlet Supervisor</td><td>POS controls, customer service, scheduling</td><td>Certification + attendance</td></tr>
            <tr><td>IT</td><td>Developer</td><td>Senior Developer → Tech Lead</td><td>Architecture, mentoring, DevOps</td><td>Project evidence</td></tr>
          </tbody>
        </table>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
