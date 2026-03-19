"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateGoalModal } from "@/components/forms/CreateGoalModal";

export default function PerformancePage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Performance & Talent"
        subtitle="Goal setting, review cycles, calibration, 9-box potential, succession, and improvement plans."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Goal</Button>
      </div>

      <CreateGoalModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Goals Active", value: "6,812", sub: "Across current cycle" },
          { label: "Reviews Due", value: "214", sub: "This week" },
          { label: "Hi-Potential Pool", value: "67", sub: "Bench tracked" },
          { label: "Calibration Progress", value: "58%", sub: "Round 1 complete" },
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
            <h3>Review Cycle Builder</h3>
            <span>Template-driven</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Quarterly review</strong><small>Self + manager + skip-level optional</small></div>
              <span className="badge badge-blue">Open</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Probation review</strong><small>30/60/90 checkpoints</small></div>
              <span className="badge badge-green">Active</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Annual appraisal</strong><small>Merit and promotion input</small></div>
              <span className="badge badge-orange">Planning</span>
            </div>
          </div>
        </div>
        <div className="hris-card lg:col-span-2">
          <div className="section-title">
            <h3>Calibration & Talent Grid</h3>
            <span>Leadership view</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Employee</th><th>Performance</th><th>Potential</th><th>Readiness</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td>Amali Perera</td><td>Exceeds</td><td>High</td><td>Ready in 1 year</td><td><span className="badge badge-green">Succession</span></td></tr>
              <tr><td>Kasun Silva</td><td>Strong</td><td>Moderate</td><td>Ready in 2 years</td><td><span className="badge badge-blue">Develop</span></td></tr>
              <tr><td>Nadeesha Jayasena</td><td>Emerging</td><td>High</td><td>Ready in 2 years</td><td><span className="badge badge-orange">Coach</span></td></tr>
              <tr><td>Tharusha Gunasekara</td><td>Needs support</td><td>Moderate</td><td>N/A</td><td><span className="badge badge-red">PIP</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Goal Sheet</h3>
            <span>Weighted objectives</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Goal</th><th>Weight</th><th>Progress</th></tr></thead>
            <tbody>
              <tr><td>Month-end close accuracy</td><td>35%</td><td>82%</td></tr>
              <tr><td>Automation initiative delivery</td><td>25%</td><td>64%</td></tr>
              <tr><td>Team capability development</td><td>20%</td><td>55%</td></tr>
              <tr><td>Audit readiness</td><td>20%</td><td>90%</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Improvement & Development</h3>
            <span>Linked to learning</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Development plan</strong><small>Courses, stretch assignments, mentor</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Performance Improvement Plan</strong><small>Milestones, evidence, review cadence</small></div>
              <span>→</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Succession slate</strong><small>Critical role backups and readiness</small></div>
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
