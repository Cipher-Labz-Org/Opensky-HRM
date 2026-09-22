namespace OpenSkyHRM.Domain.Security;

/// <summary>
/// Maps an API's declared license code to the sellable SKUs that may unlock it.
/// Sidebar visibility stays 1:1 with catalog codes; this only keeps shared APIs working
/// when a child menu (Employee bio, Reports, User Management, …) is licensed on its own.
/// </summary>
public static class LicensedModuleAccess
{
    /// <summary>
    /// Sellable sidebar modules shown in the vendor panel, matching the in-app menu.
    /// Extra SKUs in the database are not listed and are left unchanged when saving.
    /// </summary>
    public static readonly (string Code, string DisplayName, string Category, int Sort)[] VendorSidebarModules =
    {
        ("Dashboard", "Dashboard", "Core", 10),
        ("People", "People Hub", "Core", 20),
        ("EmployeeBio", "Employee bio", "Core", 30),
        ("Recruitment", "Recruitment", "Core", 40),
        ("EmployeeTasks", "Employee Tasks", "Core", 50),
        ("EmployeeActions", "Employee Actions", "Core", 60),

        ("Leave", "Leave & Absence", "Workforce", 70),
        ("Approvals", "Approvals", "Workforce", 80),
        ("Attendance", "Time & Attendance", "Workforce", 90),
        ("Payroll", "Payroll", "Workforce", 100),
        ("Performance", "Performance Appraisal", "Workforce", 110),
        ("Learning", "Learning & Skills", "Workforce", 120),

        ("Reports", "Reports", "Intelligence", 130),
        ("OrgStructure", "Org Structure", "Intelligence", 140),
        ("Analytics", "Analytics", "Intelligence", 150),
        ("CompanyProfile", "Company Profile", "Intelligence", 160),
        ("Settings", "Policy & Settings", "Intelligence", 170),
        ("Billing", "Billing", "Intelligence", 180),

        ("EmailTemplates", "Email & letter templates", "Audit & Compliance", 190),
        ("EmailDeliveryLog", "Email delivery log", "Audit & Compliance", 200),

        ("Administration", "Data Import / Export", "Administration", 210),
        ("UserManagement", "User Management", "Administration", 220),
    };

    public static readonly HashSet<string> VendorSidebarModuleCodes =
        VendorSidebarModules.Select(m => m.Code).ToHashSet(StringComparer.Ordinal);

    public static bool IsVendorSidebarModule(string? code) =>
        !string.IsNullOrWhiteSpace(code) && VendorSidebarModuleCodes.Contains(code);

    public static IReadOnlyList<string> CodesThatUnlock(string requiredCode)
    {
        if (string.IsNullOrWhiteSpace(requiredCode))
            return Array.Empty<string>();

        var set = new HashSet<string>(StringComparer.Ordinal) { requiredCode };

        switch (requiredCode)
        {
            case "People":
            case "Employee360":
            case "EmployeeBio":
            case "EmployeeActions":
                set.Add("People");
                set.Add("Employee360");
                set.Add("EmployeeBio");
                set.Add("EmployeeActions");
                break;
            case "Analytics":
            case "Reports":
                set.Add("Analytics");
                set.Add("Reports");
                break;
            case "Settings":
            case "CompanyProfile":
            case "EmailTemplates":
            case "EmailDeliveryLog":
                set.Add("Settings");
                set.Add("CompanyProfile");
                set.Add("EmailTemplates");
                set.Add("EmailDeliveryLog");
                break;
            case "Administration":
            case "UserManagement":
                set.Add("Administration");
                set.Add("UserManagement");
                break;
            case "Leave":
            case "Attendance":
            case "Approvals":
                set.Add("Leave");
                set.Add("Attendance");
                set.Add("Approvals");
                break;
        }

        return set.ToList();
    }

    public static IReadOnlyList<string> CodesThatUnlockAny(IEnumerable<string> requiredCodes)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var code in requiredCodes)
        {
            foreach (var unlocked in CodesThatUnlock(code))
                set.Add(unlocked);
        }
        return set.ToList();
    }
}
