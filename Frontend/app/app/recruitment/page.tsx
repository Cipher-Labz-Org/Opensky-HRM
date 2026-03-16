"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateRequisitionModal } from "@/components/forms/CreateRequisitionModal";

export default function RecruitmentPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Recruitment & Hiring"
        subtitle="Workforce planning, requisitions, candidate pipeline, interview scheduling, offers, and hiring analytics."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Requisition</Button>
      </div>

      <CreateRequisitionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open Jobs", value: "37", sub: "11 approved this month" },
          { label: "Candidates in Pipeline", value: "482", sub: "Across all stages" },
          { label: "Avg Time to Hire", value: "24d", sub: "Target 21 days" },
          { label: "Offer Acceptance", value: "82%", sub: "Stable" },
        ].map((kpi) => (
          <div key={kpi.label} className="hris-card kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="hris-card lg:col-span-2">
          <div className="section-title">
            <h3>Candidate Pipeline</h3>
            <span>By requisition</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Job</th><th>Sourcing</th><th>Screening</th><th>Interview</th><th>Offer</th><th>Owner</th></tr>
            </thead>
            <tbody>
              <tr><td>HR Executive</td><td>42</td><td>11</td><td>5</td><td>1</td><td>N. Jayasena</td></tr>
              <tr><td>Plant Supervisor</td><td>34</td><td>9</td><td>3</td><td>2</td><td>T. Kumara</td></tr>
              <tr><td>Senior Developer</td><td>57</td><td>13</td><td>6</td><td>1</td><td>P. Fernando</td></tr>
              <tr><td>Outlet Cashier</td><td>88</td><td>26</td><td>9</td><td>4</td><td>K. Silva</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Workflow Steps</h3>
            <span>Standardized ATS</span>
          </div>
          <div className="hris-timeline">
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">1</div>
              <div className="hris-timeline-body">
                <strong>Requisition & budget approval</strong>
                <div>Validate headcount plan and hiring priority.</div>
              </div>
            </div>
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">2</div>
              <div className="hris-timeline-body">
                <strong>Screening & scoring</strong>
                <div>CV parsing, knockout questions, scorecards.</div>
              </div>
            </div>
            <div className="hris-timeline-item">
              <div className="hris-timeline-date">3</div>
              <div className="hris-timeline-body">
                <strong>Interview & offer</strong>
                <div>Panel scheduling, feedback, approval, offer letter.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Interview Calendar</h3>
            <span>Today</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>09:30 - HR Executive</strong><small>Panel: HRBP, Talent Lead</small></div>
              <span className="badge badge-blue">Virtual</span>
            </div>
            <div className="hris-list-item">
              <div><strong>11:00 - Plant Supervisor</strong><small>Panel: Factory Manager, HR</small></div>
              <span className="badge badge-green">Onsite</span>
            </div>
            <div className="hris-list-item">
              <div><strong>02:30 - Senior Developer</strong><small>Panel: CTO, Engineering Lead</small></div>
              <span className="badge badge-blue">Remote</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Offer Governance</h3>
            <span>Controlled approvals</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Compensation grid match</strong><small>Offer should align to pay band and budget</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Reference check</strong><small>Mandatory before final approval</small></div>
              <span>✓</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Background screening</strong><small>Configurable by role category</small></div>
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
