"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface Employee {
  id: string; employeeCode: string; firstName: string; middleName?: string;
  lastName: string; fullName: string; email: string; phone?: string;
  addressStreet1?: string; addressStreet2?: string; city?: string; country?: string;
  stateProvince?: string; zipPostalCode?: string; pollingDivision?: string;
  distanceToOffice?: string; modeOfTransport?: string;
  homeTelephone?: string; workTelephone?: string; otherEmail?: string;
  permanentStreet1?: string; permanentStreet2?: string; permanentCity?: string;
  permanentCountry?: string; permanentStateProvince?: string; permanentZipPostalCode?: string;
  permanentPollingDivision?: string; permanentDistanceToOffice?: string;
  dateOfBirth: string; gender: string; maritalStatus?: string;
  nationality?: string; religion?: string; ethnicity?: string;
  otherId?: string; nationalId?: string; tinNumber?: string;
  epfNumber?: string; etfNumber?: string;
  driversLicenseNumber?: string; licenseExpiryDate?: string; driversLicenseIssuingCountry?: string;
  joinDate: string; probationEndDate?: string; dateOfPermanency?: string;
  terminationDate?: string; terminationReason?: string; terminationNote?: string;
  status: string;
  departmentId: string; departmentName?: string;
  businessUnitId?: string; businessUnitName?: string;
  positionId?: string; positionTitle?: string;
  locationId?: string; locationName?: string;
  gradeId?: string; gradeName?: string;
  jobTitleId?: string; jobTitleName?: string;
  managerId?: string; managerName?: string;
  profileImageUrl?: string; isTopOfHierarchy: boolean; hasDirectSupervisor: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  FullTimePermanent: "bg-green-100 text-green-700",
  FullTimeContract: "bg-blue-100 text-blue-700",
  FullTimeProbation: "bg-yellow-100 text-yellow-700",
  PartTime: "bg-purple-100 text-purple-700",
  Intern: "bg-indigo-100 text-indigo-700",
  Terminated: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  FullTimePermanent: "Full-Time Permanent",
  FullTimeContract: "Full-Time Contract",
  FullTimeProbation: "Full-Time Probation",
  PartTime: "Part-Time",
  Intern: "Intern",
  Terminated: "Terminated",
};

type Tab = "personal" | "job" | "identity" | "address";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("personal");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Employee>(`/api/employees/${id}`);
      setEmployee(data);
    } catch { setError("Failed to load employee details."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]"><AppTopbar />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)]/20 border-t-[var(--primary)]" />
      </div>
    </div>
  );

  if (error || !employee) return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]"><AppTopbar />
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || "Employee not found"}</p>
        <Link href="/app/people" className="text-[var(--primary)] hover:underline">Back to People Hub</Link>
      </div>
    </div>
  );

  const e = employee;
  const statusLabel = STATUS_LABELS[e.status] ?? e.status;
  const statusColor = STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-700";
  const initials = e.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <AppTopbar />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Link href="/app/people" className="hover:text-[var(--primary)]">People Hub</Link>
          <span>/</span>
          <span className="text-[var(--text)]">{e.fullName}</span>
        </div>

        {/* Header Card */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              {e.profileImageUrl ? (
                <img src={e.profileImageUrl} alt={e.fullName}
                  className="h-20 w-20 rounded-2xl object-cover border border-[var(--border)]" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-2xl font-bold text-[var(--primary)]">
                  {initials}
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-[var(--text)]">{e.fullName}</h1>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  {e.jobTitleName ?? "No job title"}
                  {e.departmentName && <> &middot; {e.departmentName}</>}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{e.employeeCode}</span>
                  <span>{e.email}</span>
                  {e.phone && <span>{e.phone}</span>}
                  {e.locationName && <span>{e.locationName}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/app/people")}>Back</Button>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[var(--bg)] p-4 sm:grid-cols-4 lg:grid-cols-6">
            <InfoItem label="Department" value={e.departmentName} />
            <InfoItem label="Position" value={e.positionTitle} />
            <InfoItem label="Manager" value={e.managerName} />
            <InfoItem label="Grade" value={e.gradeName} />
            <InfoItem label="Joined" value={e.joinDate ? new Date(e.joinDate).toLocaleDateString() : undefined} />
            <InfoItem label="Business Unit" value={e.businessUnitName} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl border border-[var(--border)] bg-white p-1 shadow-sm w-fit">
          {([
            { key: "personal", label: "Personal" },
            { key: "job", label: "Job & Organization" },
            { key: "identity", label: "Identity & Documents" },
            { key: "address", label: "Address" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition
                ${tab === t.key ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg)]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "personal" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard title="Basic Information">
              <Field label="First Name" value={e.firstName} />
              <Field label="Middle Name" value={e.middleName} />
              <Field label="Last Name" value={e.lastName} />
              <Field label="Email" value={e.email} />
              <Field label="Phone" value={e.phone} />
              <Field label="Other Email" value={e.otherEmail} />
              <Field label="Home Telephone" value={e.homeTelephone} />
              <Field label="Work Telephone" value={e.workTelephone} />
            </DetailCard>
            <DetailCard title="Demographics">
              <Field label="Date of Birth" value={e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString() : undefined} />
              <Field label="Gender" value={e.gender} />
              <Field label="Marital Status" value={e.maritalStatus} />
              <Field label="Nationality" value={e.nationality} />
              <Field label="Religion" value={e.religion} />
              <Field label="Ethnicity" value={e.ethnicity} />
            </DetailCard>
          </div>
        )}

        {tab === "job" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard title="Employment">
              <Field label="Employee Code" value={e.employeeCode} />
              <Field label="Status" value={statusLabel} />
              <Field label="Join Date" value={e.joinDate ? new Date(e.joinDate).toLocaleDateString() : undefined} />
              <Field label="Probation End" value={e.probationEndDate ? new Date(e.probationEndDate).toLocaleDateString() : undefined} />
              <Field label="Date of Permanency" value={e.dateOfPermanency ? new Date(e.dateOfPermanency).toLocaleDateString() : undefined} />
              {e.terminationDate && <Field label="Termination Date" value={new Date(e.terminationDate).toLocaleDateString()} />}
              {e.terminationReason && <Field label="Termination Reason" value={e.terminationReason} />}
              {e.terminationNote && <Field label="Termination Note" value={e.terminationNote} />}
            </DetailCard>
            <DetailCard title="Organization">
              <Field label="Department" value={e.departmentName} />
              <Field label="Business Unit" value={e.businessUnitName} />
              <Field label="Job Title" value={e.jobTitleName} />
              <Field label="Position" value={e.positionTitle} />
              <Field label="Grade" value={e.gradeName} />
              <Field label="Location" value={e.locationName} />
              <Field label="Manager" value={e.managerName} />
            </DetailCard>
          </div>
        )}

        {tab === "identity" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard title="Identification">
              <Field label="National ID" value={e.nationalId} />
              <Field label="Other ID" value={e.otherId} />
              <Field label="TIN Number" value={e.tinNumber} />
              <Field label="EPF Number" value={e.epfNumber} />
              <Field label="ETF Number" value={e.etfNumber} />
            </DetailCard>
            <DetailCard title="Driver's License">
              <Field label="License Number" value={e.driversLicenseNumber} />
              <Field label="Issuing Country" value={e.driversLicenseIssuingCountry} />
              <Field label="Expiry Date" value={e.licenseExpiryDate ? new Date(e.licenseExpiryDate).toLocaleDateString() : undefined} />
            </DetailCard>
          </div>
        )}

        {tab === "address" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard title="Current Address">
              <Field label="Street 1" value={e.addressStreet1} />
              <Field label="Street 2" value={e.addressStreet2} />
              <Field label="City" value={e.city} />
              <Field label="State / Province" value={e.stateProvince} />
              <Field label="Country" value={e.country} />
              <Field label="Zip / Postal Code" value={e.zipPostalCode} />
              <Field label="Polling Division" value={e.pollingDivision} />
              <Field label="Distance to Office" value={e.distanceToOffice} />
              <Field label="Mode of Transport" value={e.modeOfTransport} />
            </DetailCard>
            <DetailCard title="Permanent Address">
              <Field label="Street 1" value={e.permanentStreet1} />
              <Field label="Street 2" value={e.permanentStreet2} />
              <Field label="City" value={e.permanentCity} />
              <Field label="State / Province" value={e.permanentStateProvince} />
              <Field label="Country" value={e.permanentCountry} />
              <Field label="Zip / Postal Code" value={e.permanentZipPostalCode} />
              <Field label="Polling Division" value={e.permanentPollingDivision} />
              <Field label="Distance to Office" value={e.permanentDistanceToOffice} />
            </DetailCard>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--text)] truncate">{value || "—"}</dd>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-[var(--text)] uppercase tracking-wide">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
