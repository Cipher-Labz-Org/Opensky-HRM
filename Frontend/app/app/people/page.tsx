"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateEmployeeModal } from "@/components/forms/CreateEmployeeModal";

export default function PeoplePage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="People Hub"
        subtitle="Central employee master, contracts, documents, and lifecycle changes."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ Create New Employee</Button>
      </div>

      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card lg:col-span-2">
          <div className="section-title">
            <h3>Employee Directory</h3>
            <span>2,486 active records</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Role</th><th>Status</th><th>Manager</th></tr>
            </thead>
            <tbody>
              <tr><td>Amali Perera</td><td>Finance</td><td>Senior Accountant</td><td><span className="badge badge-green">Active</span></td><td>R. Fernando</td></tr>
              <tr><td>Kasun Silva</td><td>Retail Ops</td><td>Area Manager</td><td><span className="badge badge-green">Active</span></td><td>D. Wijesinghe</td></tr>
              <tr><td>Nadeesha Jayasena</td><td>HR</td><td>Talent Partner</td><td><span className="badge badge-blue">Probation</span></td><td>S. Ramanayake</td></tr>
              <tr><td>Imesha Fonseka</td><td>Manufacturing</td><td>Quality Executive</td><td><span className="badge badge-orange">Transfer</span></td><td>P. Cooray</td></tr>
              <tr><td>Tharusha Gunasekara</td><td>IT</td><td>System Analyst</td><td><span className="badge badge-red">Notice</span></td><td>M. Abeywickrama</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Master Data Blocks</h3>
            <span>Reusable configuration</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Business Units</strong><small>12 configured</small></div>
              <span className="badge badge-blue">Edit</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Grades & Bands</strong><small>8 pay grades</small></div>
              <span className="badge badge-blue">Edit</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Job Catalog</strong><small>186 job titles</small></div>
              <span className="badge badge-blue">Edit</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Document Types</strong><small>NDA, contract, visa, NIC</small></div>
              <span className="badge badge-blue">Edit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Lifecycle Transactions</h3>
            <span>Controlled via workflows</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>New Hire</strong><small>Create person, assign position, open onboarding</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Promotion / Transfer</strong><small>Manage effective date, salary, reporting line</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Contract Renewal</strong><small>Alert before expiry, revised terms</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Separation</strong><small>Resignation, termination, final clearance</small></div>
              <span>→</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Document Compliance</h3>
            <span>Expiry watch</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Document</th><th>Count</th><th>Risk</th></tr>
            </thead>
            <tbody>
              <tr><td>Passport/Visa</td><td>18</td><td><span className="badge badge-orange">30 days</span></td></tr>
              <tr><td>Medical certificates</td><td>9</td><td><span className="badge badge-red">Expired</span></td></tr>
              <tr><td>Probation letters</td><td>31</td><td><span className="badge badge-blue">Due review</span></td></tr>
              <tr><td>Contract addendums</td><td>14</td><td><span className="badge badge-orange">Pending sign</span></td></tr>
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
