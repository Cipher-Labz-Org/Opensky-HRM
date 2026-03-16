"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreatePayrollBatchModal } from "@/components/forms/CreatePayrollBatchModal";

export default function PayrollPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Payroll Interface & Compensation"
        subtitle="Compensation master, variable pay, deductions, payroll handoff, and controlled integration points."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Payroll Batch</Button>
      </div>

      <CreatePayrollBatchModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="hris-hero">
        <h3>Payroll bridge, not hard-coded payroll only</h3>
        <p>
          For enterprise-grade HRIS, compensation and employee master should remain in the HRIS while payroll calculation can be integrated with an existing payroll engine or future payroll module. This screen models pay components, revision workflows, statutory data, and payroll export/import queues.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Compensation Components</h3>
            <span>Reusable setup</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Component</th><th>Type</th><th>Tax</th></tr></thead>
            <tbody>
              <tr><td>Basic Salary</td><td>Earning</td><td>Taxable</td></tr>
              <tr><td>Meal Allowance</td><td>Earning</td><td>Policy-based</td></tr>
              <tr><td>Transport</td><td>Earning</td><td>Taxable</td></tr>
              <tr><td>EPF/ETF</td><td>Deduction</td><td>Statutory</td></tr>
              <tr><td>No-pay</td><td>Deduction</td><td>Derived</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Revision Workflow</h3>
            <span>Secure approvals</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Salary increment batch</strong><small>48 employees effective 01 Apr 2026</small></div>
              <span className="badge badge-orange">Awaiting CFO</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Promotion package</strong><small>13 employees in manager grade</small></div>
              <span className="badge badge-blue">HR review</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Bonus run</strong><small>Festival allowance cycle</small></div>
              <span className="badge badge-green">Approved</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Payroll Sync Queue</h3>
            <span>Current cycle</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Batch</th><th>Scope</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>PR-2026-03-A</td><td>Master changes</td><td><span className="badge badge-green">Pushed</span></td></tr>
              <tr><td>PR-2026-03-B</td><td>Attendance deltas</td><td><span className="badge badge-orange">Pending</span></td></tr>
              <tr><td>PR-2026-03-C</td><td>Leave deductions</td><td><span className="badge badge-blue">Prepared</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Employee Pay Statement View</h3>
            <span>Secure self-service</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Month</th><th>Gross</th><th>Net</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Feb 2026</td><td>LKR 298,000</td><td>LKR 246,420</td><td><span className="badge badge-green">Released</span></td></tr>
              <tr><td>Jan 2026</td><td>LKR 289,000</td><td>LKR 239,110</td><td><span className="badge badge-green">Released</span></td></tr>
              <tr><td>Dec 2025</td><td>LKR 412,000</td><td>LKR 337,280</td><td><span className="badge badge-green">Released</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Governance Controls</h3>
            <span>Must-have</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Four-eyes approval</strong><small>For salary, bonus, and statutory changes</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Retro audit trail</strong><small>Every effective-dated revision is logged</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Data privacy masking</strong><small>Only authorized roles can view pay data</small></div>
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
