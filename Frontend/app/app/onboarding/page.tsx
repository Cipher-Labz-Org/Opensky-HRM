"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateOnboardingTaskModal } from "@/components/forms/CreateOnboardingTaskModal";

export default function OnboardingPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Onboarding Journey"
        subtitle="Preboarding, document collection, task orchestration, provisioning, and probation tracking."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Onboarding Task</Button>
      </div>

      <CreateOnboardingTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Upcoming Joiners</h3>
            <span>Next 14 days</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>3 new hires - 17 Mar</strong><small>Finance, IT, Operations</small></div>
              <span className="badge badge-orange">Prep</span>
            </div>
            <div className="hris-list-item">
              <div><strong>5 new hires - 01 Apr</strong><small>Outlet onboarding batch</small></div>
              <span className="badge badge-blue">Queued</span>
            </div>
            <div className="hris-list-item">
              <div><strong>2 interns - 08 Apr</strong><small>University internship cycle</small></div>
              <span className="badge badge-blue">Queued</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Preboarding Packet</h3>
            <span>Digital completion</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Step</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Offer acceptance</td><td><span className="badge badge-green">Done</span></td></tr>
              <tr><td>ID documents upload</td><td><span className="badge badge-blue">In progress</span></td></tr>
              <tr><td>Bank / tax info</td><td><span className="badge badge-orange">Pending</span></td></tr>
              <tr><td>Policy acknowledgement</td><td><span className="badge badge-orange">Pending</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Provisioning</h3>
            <span>Cross-functional SLA</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Area</th><th>Owner</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Workspace</td><td>Admin</td><td><span className="badge badge-green">Ready</span></td></tr>
              <tr><td>Laptop / Email</td><td>IT</td><td><span className="badge badge-blue">Processing</span></td></tr>
              <tr><td>ERP Roles</td><td>IT Apps</td><td><span className="badge badge-orange">Awaiting</span></td></tr>
              <tr><td>Welcome induction</td><td>HR</td><td><span className="badge badge-green">Scheduled</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 hris-card">
        <div className="section-title">
          <h3>90-Day Journey Board</h3>
          <span>Experience + compliance</span>
        </div>
        <table className="hris-table">
          <thead>
            <tr><th>Milestone</th><th>Owner</th><th>Target</th><th>Completion</th><th>Risk</th></tr>
          </thead>
          <tbody>
            <tr><td>Day 1 induction</td><td>HR</td><td>17 Mar 2026</td><td>100%</td><td><span className="badge badge-green">Low</span></td></tr>
            <tr><td>Role training completion</td><td>Manager</td><td>31 Mar 2026</td><td>63%</td><td><span className="badge badge-orange">Medium</span></td></tr>
            <tr><td>Probation objective setup</td><td>Manager + HR</td><td>25 Mar 2026</td><td>40%</td><td><span className="badge badge-orange">Medium</span></td></tr>
            <tr><td>30/60/90 reviews</td><td>Supervisor</td><td>15 Jun 2026</td><td>Not started</td><td><span className="badge badge-blue">Tracked</span></td></tr>
          </tbody>
        </table>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
