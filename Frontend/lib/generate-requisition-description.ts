/** Snapshot of requisition form values used to build a draft job description. */
export type RequisitionDescriptionSnapshot = {
  title: string;
  code: string;
  vacancies: number;
  targetDate: string;
  priority: string;
  employmentType: string;
  employmentTypeLabel: string;
  experienceMin: string;
  experienceMax: string;
  salaryMin: string;
  salaryMax: string;
  departmentName: string;
  jobTitleName: string;
  hiringManagerName: string;
  locationName: string;
  skills: string[];
};

function nonEmpty(s: string): boolean {
  return s.trim().length > 0;
}

function expRange(min: string, max: string): string | null {
  const hasMin = min !== "" && !Number.isNaN(Number(min));
  const hasMax = max !== "" && !Number.isNaN(Number(max));
  if (hasMin && hasMax) return `${min}–${max} years`;
  if (hasMin) return `at least ${min} years`;
  if (hasMax) return `up to ${max} years`;
  return null;
}

function salaryRange(min: string, max: string): string | null {
  const hasMin = min !== "" && !Number.isNaN(Number(min));
  const hasMax = max !== "" && !Number.isNaN(Number(max));
  if (hasMin && hasMax) return `${min} – ${max}`;
  if (hasMin) return `from ${min}`;
  if (hasMax) return `up to ${max}`;
  return null;
}

/**
 * Builds a plain-text job description from the requisition wizard fields.
 * Intended as a starting point the hiring team can edit before posting.
 */
export function generateRequisitionDescription(s: RequisitionDescriptionSnapshot): string {
  const blocks: string[] = [];
  const headline = nonEmpty(s.title) ? s.title.trim() : nonEmpty(s.jobTitleName) ? s.jobTitleName.trim() : "Open position";
  const roleLine = nonEmpty(s.jobTitleName) && s.jobTitleName.trim() !== headline ? ` (${s.jobTitleName.trim()})` : "";

  blocks.push(`${headline}${roleLine}`);
  if (nonEmpty(s.code)) {
    blocks.push(`Requisition: ${s.code.trim()}`);
  }
  blocks.push("");

  blocks.push("Overview");
  blocks.push("—".repeat(40));
  const dept = nonEmpty(s.departmentName) ? ` in ${s.departmentName}` : "";
  const loc = nonEmpty(s.locationName) ? ` based in ${s.locationName}` : "";
  const openCount = s.vacancies > 1 ? `There are ${s.vacancies} openings for this role.` : "We are hiring for this role.";
  blocks.push(
    `${openCount} This requisition covers${dept}${loc}. ` +
      "The summary below is generated from the details you entered; please review and adjust the tone and responsibilities before publishing or sharing with candidates."
  );
  blocks.push("");

  blocks.push("Role details");
  blocks.push("—".repeat(40));
  const detailLines: string[] = [];
  if (nonEmpty(s.priority)) detailLines.push(`• Priority: ${s.priority}`);
  if (nonEmpty(s.employmentTypeLabel) || nonEmpty(s.employmentType)) {
    detailLines.push(`• Employment type: ${nonEmpty(s.employmentTypeLabel) ? s.employmentTypeLabel : s.employmentType}`);
  }
  const exp = expRange(s.experienceMin, s.experienceMax);
  if (exp) detailLines.push(`• Experience: ${exp}`);
  const sal = salaryRange(s.salaryMin, s.salaryMax);
  if (sal) detailLines.push(`• Compensation band (numbers as entered on the form): ${sal}`);
  if (nonEmpty(s.targetDate)) detailLines.push(`• Target hire / start date: ${s.targetDate}`);
  if (nonEmpty(s.hiringManagerName)) detailLines.push(`• Hiring manager / point of contact: ${s.hiringManagerName}`);
  if (detailLines.length === 0) {
    detailLines.push("• Add priority, employment type, experience, salary, or target date above to enrich this section.");
  }
  blocks.push(detailLines.join("\n"));
  blocks.push("");

  blocks.push("What you will do");
  blocks.push("—".repeat(40));
  blocks.push(
    `As ${headline}, you will contribute to the goals of${dept || " the team"}, collaborating with colleagues and stakeholders. ` +
      "Define concrete outcomes, systems, and stakeholders here to match your organization’s expectations."
  );
  blocks.push("");

  blocks.push("Skills and qualifications");
  blocks.push("—".repeat(40));
  if (s.skills.length > 0) {
    blocks.push("The hiring team highlighted the following areas (edit as needed):");
    for (const sk of s.skills) {
      blocks.push(`• ${sk}`);
    }
    blocks.push("");
    blocks.push("Additional requirements (degrees, certifications, tools, languages) can be listed here.");
  } else {
    blocks.push(
      "No skills were selected on the requisition yet. Add relevant technical and soft skills above, or describe qualifications in this paragraph."
    );
  }

  return blocks.join("\n").trim();
}
