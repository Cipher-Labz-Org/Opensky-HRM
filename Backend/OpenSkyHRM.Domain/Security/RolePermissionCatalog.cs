namespace OpenSkyHRM.Domain.Security;

/// <summary>
/// Menu-level modules shown on Roles &amp; permissions. Codes are stored on <c>Permission.Module</c>.
/// <see cref="RolePermissionModuleDefinition.LicenseAnyOf"/> maps each row to sellable licensed modules.
/// Empty <see cref="RolePermissionModuleDefinition.LicenseAnyOf"/> means always available (Help).
/// </summary>
public sealed record RolePermissionModuleDefinition(
    string Code,
    string Label,
    string Category,
    int SortOrder,
    string[] LicenseAnyOf);

public static class RolePermissionCatalog
{
    public static readonly RolePermissionModuleDefinition[] Modules =
    {
        new("Dashboard", "Dashboard", "Core", 10, ["Dashboard"]),
        new("People", "People Hub", "Core", 20, ["People"]),
        new("EmployeeBio", "Employee bio", "Core", 25, ["EmployeeBio"]),
        new("Recruitment", "Recruitment", "Core", 30, ["Recruitment"]),
        new("EmployeeTasks", "Employee Tasks", "Core", 40, ["EmployeeTasks"]),
        new("EmployeeActions", "Employee Actions", "Core", 50, ["EmployeeActions"]),
        new("Onboarding", "Onboarding", "Core", 55, ["Onboarding"]),
        new("Offboarding", "Offboarding", "Core", 56, ["Offboarding"]),

        new("Leave", "Leave & Absence", "Workforce", 60, ["Leave"]),
        new("Approvals", "Approvals", "Workforce", 65, ["Approvals"]),
        new("Attendance", "Time & Attendance", "Workforce", 70, ["Attendance"]),
        new("Payroll", "Payroll", "Workforce", 80, ["Payroll"]),
        new("Performance", "Performance Appraisal", "Workforce", 90, ["Performance"]),
        new("Learning", "Learning & Skills", "Workforce", 100, ["Learning"]),

        new("Reports", "Reports", "Intelligence", 110, ["Reports"]),
        new("OrgStructure", "Org Structure", "Intelligence", 120, ["OrgStructure"]),
        new("Analytics", "Analytics", "Intelligence", 130, ["Analytics"]),
        new("CompanyProfile", "Company Profile", "Intelligence", 135, ["CompanyProfile"]),
        new("Settings", "Policy & Settings", "Intelligence", 140, ["Settings"]),
        new("Billing", "Billing", "Intelligence", 150, ["Billing"]),
        new("AiAssistant", "OpenSky AI", "Intelligence", 155, ["AiAssistant"]),

        new("EmailTemplates", "Email & letter templates", "Audit & Compliance", 160, ["EmailTemplates"]),
        new("EmailDeliveryLog", "Email delivery log", "Audit & Compliance", 170, ["EmailDeliveryLog"]),

        new("Administration", "Data Import / Export", "Administration", 180, ["Administration"]),
        new("UserManagement", "User Management", "Administration", 190, ["UserManagement"]),

        new("Help", "Help & guides", "Help", 200, []),
    };

    /// <summary>Parent module → child menu codes. Used to copy existing role access when submenu rows are introduced.</summary>
    public static readonly (string Parent, string Child)[] ParentToChildCopies =
    {
        ("People", "EmployeeBio"),
        ("People", "EmployeeActions"),
        ("Analytics", "Reports"),
        ("Settings", "CompanyProfile"),
        ("Settings", "EmailTemplates"),
        ("Settings", "EmailDeliveryLog"),
        ("Administration", "UserManagement"),
    };

    public static IReadOnlyList<RolePermissionModuleDefinition> FilterByLicenses(IEnumerable<string> effectiveLicenseCodes)
    {
        var set = effectiveLicenseCodes.ToHashSet(StringComparer.Ordinal);
        return Modules
            .Where(m => m.LicenseAnyOf.Length == 0 || m.LicenseAnyOf.Any(set.Contains))
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Label, StringComparer.Ordinal)
            .ToList();
    }
}
