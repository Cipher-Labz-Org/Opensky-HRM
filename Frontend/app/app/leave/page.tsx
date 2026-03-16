"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateLeaveRequestModal } from "@/components/forms/CreateLeaveRequestModal";

export default function LeavePage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Leave & Absence Management"
        subtitle="Policies, leave plans, approvals, calendars, holiday rules, and absence analytics."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Leave Request</Button>
      </div>

      <CreateLeaveRequestModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Requests Today", value: "19", sub: "12 pending approval" },
          { label: "Annual Leave Utilization", value: "63%", sub: "Year to date" },
          { label: "Unplanned Absence", value: "2.8%", sub: "Within threshold" },
          { label: "Restricted Dates", value: "14", sub: "Peak business periods" },
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
            <h3>Policy Library</h3>
            <span>Configurable rules</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Annual Leave</strong><small>Pro-rated by service period</small></div>
              <span className="badge badge-blue">Editable</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Casual Leave</strong><small>Monthly entitlement control</small></div>
              <span className="badge badge-blue">Editable</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Maternity / Paternity</strong><small>Protected leave paths</small></div>
              <span className="badge badge-blue">Editable</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Encashment Rules</strong><small>Country/company specific</small></div>
              <span className="badge badge-blue">Editable</span>
            </div>
          </div>
        </div>
        <div className="hris-card lg:col-span-2">
          <div className="section-title">
            <h3>Approval Board</h3>
            <span>Manager view</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Employee</th><th>Leave Type</th><th>Dates</th><th>Coverage</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>S. Rodrigo</td><td>Annual</td><td>18-20 Mar</td><td>Backfilled by T. Silva</td><td><span className="badge badge-orange">Pending</span></td></tr>
              <tr><td>H. Peris</td><td>Medical</td><td>Today</td><td>Certificate uploaded</td><td><span className="badge badge-blue">Review</span></td></tr>
              <tr><td>A. Dissanayake</td><td>Casual</td><td>24 Mar</td><td>No conflict</td><td><span className="badge badge-green">Auto-approved</span></td></tr>
              <tr><td>N. Perera</td><td>Maternity</td><td>01 Apr - 30 Jun</td><td>Replacement required</td><td><span className="badge badge-red">Escalated</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Team Leave Calendar</h3>
            <span>Conflict detection</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Date</th><th>Team on Leave</th><th>Capacity</th></tr></thead>
            <tbody>
              <tr><td>18 Mar</td><td>3 employees</td><td><span className="badge badge-green">Healthy</span></td></tr>
              <tr><td>26 Mar</td><td>8 employees</td><td><span className="badge badge-orange">Tight</span></td></tr>
              <tr><td>11 Apr</td><td>11 employees</td><td><span className="badge badge-red">Restricted</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Absence Analytics</h3>
            <span>By leave type</span>
          </div>
          <div className="hris-list">
            <div>
              <strong>Annual Leave</strong>
              <div className="progress-bar mt-2"><span style={{ width: "74%" }}></span></div>
              <small>Most utilized in Retail Ops</small>
            </div>
            <div className="mt-3">
              <strong>Medical Leave</strong>
              <div className="progress-bar mt-2"><span style={{ width: "29%" }}></span></div>
              <small>Seasonal spikes monitored</small>
            </div>
            <div className="mt-3">
              <strong>Unpaid Leave</strong>
              <div className="progress-bar mt-2"><span style={{ width: "8%" }}></span></div>
              <small>Approval controlled</small>
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
