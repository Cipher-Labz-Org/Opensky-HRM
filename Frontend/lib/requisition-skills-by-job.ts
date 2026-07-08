/**
 * Suggested skills for requisitions, derived from the requisition title field.
 * Matching is keyword-based so it works with org-specific role names.
 */

const DEFAULT_SKILLS = [
  "Communication",
  "Problem solving",
  "Collaboration",
  "Time management",
  "Microsoft 365 / Google Workspace",
  "Documentation",
  "Stakeholder management",
  "Attention to detail",
];

type Rule = { test: (text: string) => boolean; skills: string[] };

const RULES: Rule[] = [
  {
    test: (t) =>
      /\b(data\s*science|machine\s*learning|ml\s*engineer|ai\s*engineer|deep\s*learning)\b/.test(t),
    skills: [
      "Python",
      "SQL",
      "Statistics",
      "Machine learning",
      "Data visualization",
      "Feature engineering",
      "Experiment design",
      "Cloud (AWS/GCP/Azure)",
      "Pandas / NumPy",
      "Model evaluation",
    ],
  },
  {
    test: (t) => /\b(data\s*analyst|business\s*analyst|bi\s*analyst|analytics)\b/.test(t),
    skills: [
      "SQL",
      "Excel / spreadsheets",
      "Data visualization",
      "Dashboards (Power BI / Tableau)",
      "Requirements gathering",
      "Reporting",
      "Statistics basics",
      "Stakeholder communication",
    ],
  },
  {
    test: (t) =>
      /\b(devops|sre|site\s*reliability|platform\s*engineer|cloud\s*engineer|infrastructure)\b/.test(t),
    skills: [
      "CI/CD",
      "Docker / Kubernetes",
      "Linux administration",
      "IaC (Terraform / Ansible)",
      "Monitoring & observability",
      "Scripting (Bash/Python)",
      "Networking & security basics",
      "Cloud (AWS/GCP/Azure)",
    ],
  },
  {
    test: (t) => /\b(qa|quality|test\s*engineer|sdet|automation\s*test)\b/.test(t),
    skills: [
      "Test planning",
      "Manual testing",
      "Test automation",
      "API testing",
      "Regression testing",
      "Bug tracking (Jira)",
      "CI integration",
      "Performance testing basics",
    ],
  },
  {
    test: (t) => /\b(ux|ui|product\s*design|graphic\s*design|designer)\b/.test(t),
    skills: [
      "User research",
      "Wireframing & prototyping",
      "Figma (or similar)",
      "Visual design",
      "Design systems",
      "Accessibility (WCAG)",
      "Usability testing",
      "Handoff to engineering",
    ],
  },
  {
    test: (t) =>
      /\b(hr|human\s*resources|people\s*ops|recruiter|talent\s*acquisition|payroll\s*specialist)\b/.test(t),
    skills: [
      "Recruitment & sourcing",
      "Employment law awareness",
      "HRIS / ATS",
      "Onboarding",
      "Performance management",
      "Employee relations",
      "Compensation & benefits basics",
      "Confidentiality & ethics",
    ],
  },
  {
    test: (t) =>
      /\b(accountant|finance|financial|controller|bookkeeper|auditor|fp&a|treasury)\b/.test(t),
    skills: [
      "Financial reporting",
      "GAAP / IFRS awareness",
      "Excel / financial modeling",
      "Budgeting & forecasting",
      "ERP / accounting software",
      "Reconciliation",
      "Tax basics",
      "Internal controls",
    ],
  },
  {
    test: (t) =>
      /\b(sales|business\s*development|account\s*executive|account\s*manager|bdr|sdr)\b/.test(t),
    skills: [
      "Prospecting",
      "CRM (Salesforce / HubSpot)",
      "Pipeline management",
      "Negotiation",
      "Presentation skills",
      "Solution selling",
      "Market knowledge",
      "Quota ownership",
    ],
  },
  {
    test: (t) =>
      /\b(marketing|growth|content|seo|sem|brand|communications|social\s*media)\b/.test(t),
    skills: [
      "Campaign planning",
      "Content creation",
      "SEO / SEM basics",
      "Analytics (GA4 / ads)",
      "Email marketing",
      "Brand messaging",
      "A/B testing",
      "Stakeholder alignment",
    ],
  },
  {
    test: (t) =>
      /\b(nurse|clinical|physician|doctor|medical|healthcare|patient\s*care)\b/.test(t),
    skills: [
      "Clinical protocols",
      "Patient assessment",
      "Electronic health records (EHR)",
      "Infection control",
      "Team coordination",
      "Empathy & bedside manner",
      "Regulatory compliance",
      "Documentation",
    ],
  },
  {
    test: (t) =>
      /\b(project\s*manager|program\s*manager|scrum\s*master|agile\s*coach|delivery\s*manager)\b/.test(t),
    skills: [
      "Project planning",
      "Risk management",
      "Agile / Scrum",
      "Stakeholder management",
      "Budget & timeline tracking",
      "Jira / Azure DevOps",
      "Reporting",
      "Facilitation",
    ],
  },
  {
    test: (t) =>
      /\b(product\s*manager|product\s*owner)\b/.test(t),
    skills: [
      "Product discovery",
      "Roadmapping",
      "Prioritization (RICE etc.)",
      "User stories & acceptance criteria",
      "Analytics & experimentation",
      "Stakeholder management",
      "Market / competitor awareness",
      "Go-to-market alignment",
    ],
  },
  {
    test: (t) => {
      if (/\b(civil|mechanical|electrical|structural|chemical)\s+engineer\b/.test(t)) return false;
      return /\b(software|developer|engineer|programmer|backend|frontend|full[\s-]?stack|web\s*dev|mobile|ios|android|\.net|java|react|node)\b/.test(
        t
      );
    },
    skills: [
      "Software design & architecture",
      "REST / HTTP APIs",
      "Git version control",
      "Code review",
      "Unit & integration testing",
      "Debugging & profiling",
      "Security awareness (OWASP basics)",
      "CI/CD familiarity",
      "Relational databases",
      "Cloud deployment basics",
    ],
  },
  {
    test: (t) => /\b(support|helpdesk|service\s*desk|customer\s*success|technical\s*support)\b/.test(t),
    skills: [
      "Ticket handling",
      "Customer communication",
      "Troubleshooting",
      "Knowledge base",
      "SLA awareness",
      "Remote diagnostics",
      "Product expertise",
      "Escalation management",
    ],
  },
  {
    test: (t) => /\b(admin|executive\s*assistant|office\s*manager|coordinator|secretary)\b/.test(t),
    skills: [
      "Calendar management",
      "Travel coordination",
      "Minute-taking",
      "Confidentiality",
      "Microsoft 365 / Google Workspace",
      "Vendor liaison",
      "Event coordination",
      "Prioritization",
    ],
  },
];

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns an ordered, de-duplicated list of suggested skills for checkboxes.
 * Uses the requisition title only.
 */
export function getSuggestedSkillsForTitle(title: string): string[] {
  const text = normalizeTitle(title);
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (skills: readonly string[]) => {
    for (const s of skills) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  };

  for (const rule of RULES) {
    if (text.length > 0 && rule.test(text)) {
      push(rule.skills);
    }
  }

  if (out.length === 0) {
    push(DEFAULT_SKILLS);
  }

  return out;
}
