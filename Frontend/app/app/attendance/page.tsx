"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateAttendanceModal } from "@/components/forms/CreateAttendanceModal";

export default function AttendancePage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Time & Attendance"
        subtitle="Shift patterns, rosters, mobile/web punch, biometrics integration, overtime, and anomaly detection."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ Log Attendance</Button>
      </div>

      <CreateAttendanceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Today Attendance</h3>
            <span>Live status</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Present</strong><small>2,177 employees</small></div>
              <span className="badge badge-green">94.2%</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Late Punches</strong><small>68 employees</small></div>
              <span className="badge badge-orange">Watch</span>
            </div>
            <div className="hris-list-item">
              <div><strong>No Punch</strong><small>24 employees</small></div>
              <span className="badge badge-red">Action</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Roster Templates</h3>
            <span>Workforce scheduling</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Template</th><th>Pattern</th><th>Usage</th></tr></thead>
            <tbody>
              <tr><td>HQ Standard</td><td>Mon-Fri</td><td>620</td></tr>
              <tr><td>Outlet Shift A/B</td><td>Rotational</td><td>1,020</td></tr>
              <tr><td>Factory 3 Shift</td><td>24/7</td><td>530</td></tr>
              <tr><td>Hybrid Remote</td><td>Flexible</td><td>190</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Integration Sources</h3>
            <span>Capture channels</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Biometric devices</strong><small>12 active devices</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Mobile geo-punch</strong><small>Field teams and offsite employees</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Web punch</strong><small>Back office fallback</small></div>
              <span>✓</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 hris-card">
        <div className="section-title">
          <h3>Attendance Exceptions Workbench</h3>
          <span>Supervisor corrections and payroll relevance</span>
        </div>
        <table className="hris-table">
          <thead>
            <tr><th>Employee</th><th>Date</th><th>Issue</th><th>Suggested Reason</th><th>Payroll Impact</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td>L. Kumari</td><td>15 Mar</td><td>Missing out punch</td><td>System estimated shift end</td><td>None</td><td><span className="badge badge-orange">Pending manager</span></td></tr>
            <tr><td>W. Bandara</td><td>15 Mar</td><td>Late in</td><td>Traffic / field return</td><td>OT recalc</td><td><span className="badge badge-blue">Under review</span></td></tr>
            <tr><td>P. Rodrigo</td><td>14 Mar</td><td>Unscheduled OT</td><td>Outlet closure support</td><td>Allowance</td><td><span className="badge badge-green">Approved</span></td></tr>
          </tbody>
        </table>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
