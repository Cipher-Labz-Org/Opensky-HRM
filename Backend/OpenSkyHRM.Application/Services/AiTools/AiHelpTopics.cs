namespace OpenSkyHRM.Application.Services.AiTools;

public static class AiHelpTopics
{
    public sealed record HelpTopic(string Slug, string Title, string Description, string ModuleCode);

    public static readonly IReadOnlyList<HelpTopic> Topics =
    [
        new("dashboard", "Dashboard", "Home view for HR KPIs, shortcuts, and tasks.", "Dashboard"),
        new("people", "People Hub", "Directory, search, filters, and employee profile creation.", "People"),
        new("employee-360", "Employee 360", "Personal profile summary and employee records.", "People"),
        new("recruitment", "Recruitment", "Requisitions, candidates, and hiring workflows.", "Recruitment"),
        new("leave", "Leave & Absence", "Leave requests, balances, policies, and approvals.", "Leave"),
        new("attendance", "Time & Attendance", "Punch records, rosters, shifts, and reconciliation.", "Attendance"),
        new("payroll", "Payroll", "Pay batches, statements, and compensation.", "Payroll"),
        new("performance", "Performance", "Goals, review cycles, and appraisals.", "Performance"),
        new("learning", "Learning & Skills", "Courses, certifications, and training assignments.", "Learning"),
        new("analytics", "Analytics & Reports", "Executive dashboards and operational reports.", "Analytics"),
        new("company-profile", "Company Profile", "Company logo, legal details, and mobile app connection.", "CompanyProfile"),
        new("settings", "Policy & Settings", "Company policies, integrations, and system configuration.", "Settings"),
        new("org-structure", "Org Structure", "Departments, locations, grades, and job titles.", "OrgStructure"),
    ];

    public static HelpTopic? Find(string? slugOrModule)
    {
        if (string.IsNullOrWhiteSpace(slugOrModule)) return null;
        var key = slugOrModule.Trim();
        return Topics.FirstOrDefault(t =>
            string.Equals(t.Slug, key, StringComparison.OrdinalIgnoreCase)
            || string.Equals(t.ModuleCode, key, StringComparison.OrdinalIgnoreCase)
            || string.Equals(t.Title, key, StringComparison.OrdinalIgnoreCase));
    }
}
