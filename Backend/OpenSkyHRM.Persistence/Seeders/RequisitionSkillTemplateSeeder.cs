using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Persistence.Seeders;

public static class RequisitionSkillTemplateSeeder
{
    private static readonly (string Name, string Keywords, string Skills, int SortOrder)[] Defaults =
    [
        ("Chef / Culinary",
            "chef|sous chef|head chef|executive chef|culinary|cook|kitchen|pastry|baker|banquet chef",
            "Food safety & hygiene (HACCP), Menu development & costing, Knife skills & prep, Kitchen equipment operation, Inventory & wastage control, Plating & presentation, Dietary requirements & allergens, Team supervision, High-volume service, Banquet & catering experience",
            10),
        ("Software Engineer",
            "software|developer|engineer|programmer|backend|frontend|full stack|full-stack|web dev|mobile|react|node|.net|java",
            "Software design & architecture, REST / HTTP APIs, Git version control, Code review, Unit & integration testing, Debugging & profiling, Security awareness (OWASP basics), CI/CD familiarity, Relational databases, Cloud deployment basics",
            20),
        ("Data Science / ML",
            "data science|machine learning|ml engineer|ai engineer|deep learning",
            "Python, SQL, Statistics, Machine learning, Data visualization, Feature engineering, Experiment design, Cloud (AWS/GCP/Azure), Pandas / NumPy, Model evaluation",
            30),
        ("Data / Business Analyst",
            "data analyst|business analyst|bi analyst|analytics",
            "SQL, Excel / spreadsheets, Data visualization, Dashboards (Power BI / Tableau), Requirements gathering, Reporting, Statistics basics, Stakeholder communication",
            40),
        ("DevOps / Platform",
            "devops|sre|site reliability|platform engineer|cloud engineer|infrastructure",
            "CI/CD, Docker / Kubernetes, Linux administration, IaC (Terraform / Ansible), Monitoring & observability, Scripting (Bash/Python), Networking & security basics, Cloud (AWS/GCP/Azure)",
            50),
        ("QA / Testing",
            "qa|quality|test engineer|sdet|automation test",
            "Test planning, Manual testing, Test automation, API testing, Regression testing, Bug tracking (Jira), CI integration, Performance testing basics",
            60),
        ("UX / UI Design",
            "ux|ui|product design|graphic design|designer",
            "User research, Wireframing & prototyping, Figma (or similar), Visual design, Design systems, Accessibility (WCAG), Usability testing, Handoff to engineering",
            70),
        ("HR / Recruitment",
            "hr|human resources|people ops|recruiter|talent acquisition|payroll specialist",
            "Recruitment & sourcing, Employment law awareness, HRIS / ATS, Onboarding, Performance management, Employee relations, Compensation & benefits basics, Confidentiality & ethics",
            80),
        ("Finance / Accounting",
            "accountant|finance|financial|controller|bookkeeper|auditor|fp&a|treasury",
            "Financial reporting, GAAP / IFRS awareness, Excel / financial modeling, Budgeting & forecasting, ERP / accounting software, Reconciliation, Tax basics, Internal controls",
            90),
        ("Sales",
            "sales|business development|account executive|account manager|bdr|sdr",
            "Prospecting, CRM (Salesforce / HubSpot), Pipeline management, Negotiation, Presentation skills, Solution selling, Market knowledge, Quota ownership",
            100),
        ("Marketing",
            "marketing|growth|content|seo|sem|brand|communications|social media",
            "Campaign planning, Content creation, SEO / SEM basics, Analytics (GA4 / ads), Email marketing, Brand messaging, A/B testing, Stakeholder alignment",
            110),
        ("Healthcare / Clinical",
            "nurse|clinical|physician|doctor|medical|healthcare|patient care",
            "Clinical protocols, Patient assessment, Electronic health records (EHR), Infection control, Team coordination, Empathy & bedside manner, Regulatory compliance, Documentation",
            120),
        ("Project / Delivery",
            "project manager|program manager|scrum master|agile coach|delivery manager",
            "Project planning, Risk management, Agile / Scrum, Stakeholder management, Budget & timeline tracking, Jira / Azure DevOps, Reporting, Facilitation",
            130),
        ("Product Management",
            "product manager|product owner",
            "Product discovery, Roadmapping, Prioritization (RICE etc.), User stories & acceptance criteria, Analytics & experimentation, Stakeholder management, Market / competitor awareness, Go-to-market alignment",
            140),
        ("Customer Support",
            "support|helpdesk|service desk|customer success|technical support",
            "Ticket handling, Customer communication, Troubleshooting, Knowledge base, SLA awareness, Remote diagnostics, Product expertise, Escalation management",
            150),
        ("Admin / Office",
            "admin|executive assistant|office manager|coordinator|secretary",
            "Calendar management, Travel coordination, Minute-taking, Confidentiality, Microsoft 365 / Google Workspace, Vendor liaison, Event coordination, Prioritization",
            160),
        ("Hospitality / F&B Service",
            "waiter|waitress|server|bartender|barista|host|hostess|f&b|food and beverage|restaurant",
            "Customer service, POS systems, Order taking, Table service, Cash handling, Upselling, Health & safety, Team coordination, Complaint handling",
            170),
        ("Welder / Fabricator",
            "welder|welding|fabricator|fabrication|mig welder|tig welder|arc welder|boilermaker|pipe welder|structural welder",
            "MIG / TIG / arc welding, Blueprint & drawing reading, Metal fabrication, Cutting & grinding, Weld inspection & quality, Safety (PPE, ventilation, hot work), Material preparation, Jig & fixture setup, Stainless / mild steel / aluminium welding, Equipment maintenance",
            180),
        ("Driver / Transport",
            "driver|chauffeur|delivery driver|truck driver|lorry driver|van driver|bus driver|heavy vehicle|light vehicle|forklift driver|transport officer",
            "Valid driving licence (appropriate class), Defensive driving, Route planning & navigation, Vehicle pre-trip inspection, Load securing & cargo handling, Traffic & road safety regulations, Logbook / trip records, Customer delivery handover, Basic vehicle maintenance awareness, Time management",
            190),
        ("Electrician",
            "electrician|electrical technician|electrical engineer|wireman|lineman|panel builder",
            "Electrical wiring & termination, Blueprint & schematic reading, Testing & troubleshooting, Safety (LOTO, PPE, live-work rules), Panel / DB installation, Conduit & cable routing, Compliance with local electrical codes, Preventive maintenance, Fault finding, Hand tools & test equipment",
            200),
        ("Mechanic / Automotive",
            "mechanic|automotive|auto technician|vehicle technician|motor mechanic|diesel mechanic|fitter",
            "Engine diagnostics & repair, Preventive maintenance schedules, Brake, suspension & steering systems, Electrical & electronic systems (basic), Use of diagnostic tools, Workshop safety, Parts identification & ordering, Service documentation, Customer communication, Quality checks & road tests",
            210),
        ("Warehouse / Logistics",
            "warehouse|storekeeper|store keeper|inventory clerk|logistics assistant|dispatch|picker|packer|material handler",
            "Stock receiving & issuing, Inventory counts & cycle counts, WMS / barcode scanning, FIFO / FEFO practices, Picking, packing & labelling, Forklift / pallet jack operation (if licensed), Health & safety in warehouse, Documentation & GRN, Team coordination, Accuracy & attention to detail",
            220),
        ("Security Officer",
            "security guard|security officer|watchman|gate keeper|cctv operator|loss prevention",
            "Access control & visitor management, Patrol & incident reporting, CCTV monitoring, Emergency response procedures, Conflict de-escalation, First aid awareness, Fire safety & evacuation, Night-shift vigilance, Communication & radio protocol, Legal & ethical conduct",
            230),
        ("Cleaner / Housekeeping",
            "cleaner|housekeeping|janitor|sanitation|domestic worker|room attendant|office cleaner",
            "Cleaning chemicals & safe use, Room / area cleaning standards, Infection control & hygiene, Equipment care (vacuum, mop, etc.), Waste segregation & disposal, Linen handling (hospitality), Attention to detail, Time management, Guest / occupant courtesy, Health & safety (wet floors, PPE)",
            240),
        ("Carpenter / Joiner",
            "carpenter|joiner|woodworker|cabinet maker|furniture maker|formwork carpenter",
            "Timber selection & measurement, Cutting, shaping & joinery, Blueprint & drawing reading, Power & hand tools, Formwork / framing (construction), Finishing & installation, Workplace safety, Material estimation, Quality inspection, Site coordination",
            250),
        ("Construction / Mason",
            "mason|bricklayer|construction worker|labourer|laborer|civil worker|site worker|concreter|plasterer",
            "Masonry & brick/block laying, Concrete mixing & pouring, Blueprint / site instruction reading, Measuring & levelling, Tool & equipment use, Scaffold safety awareness, Quality & alignment checks, Team work on site, PPE & site safety rules, Physical stamina & reliability",
            260),
        ("Plumber",
            "plumber|plumbing|pipefitter|pipe fitter|sanitary technician",
            "Pipe fitting & installation, Blueprint reading, Leak detection & repair, Drainage & sanitary systems, Water supply systems, Soldering / threading / joining methods, Pressure testing, Safety & code compliance, Customer service, Tool & material knowledge",
            270),
        ("Sports / Fitness Coach",
            "coach|cricket coach|football coach|fitness coach|personal trainer|sports instructor|athletic trainer|gym instructor",
            "Coaching & player development, Training session planning, Sport-specific technique & drills, Fitness & conditioning, Injury prevention awareness, Communication & motivation, Team management, First aid / CPR awareness, Performance assessment, Safety & equipment standards",
            280),
    ];

    public static async Task EnsureAsync(AppDbContext db, CancellationToken ct = default)
    {
        var existingNames = await db.RequisitionSkillTemplates
            .AsNoTracking()
            .Select(t => t.Name)
            .ToListAsync(ct);
        var known = new HashSet<string>(existingNames, StringComparer.OrdinalIgnoreCase);

        var added = false;
        foreach (var (name, keywords, skills, sortOrder) in Defaults)
        {
            if (known.Contains(name))
                continue;

            db.RequisitionSkillTemplates.Add(new RequisitionSkillTemplate
            {
                Name = name,
                Keywords = keywords,
                Skills = skills,
                SortOrder = sortOrder,
                IsActive = true,
            });
            added = true;
        }

        if (added)
            await db.SaveChangesAsync(ct);
    }
}
