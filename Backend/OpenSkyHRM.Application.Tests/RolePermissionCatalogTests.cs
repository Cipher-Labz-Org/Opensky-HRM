using OpenSkyHRM.Domain.Security;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class RolePermissionCatalogTests
{
    [Fact]
    public void FilterByLicenses_Includes_Sidebar_Rows_And_Help()
    {
        var codes = RolePermissionCatalog.FilterByLicenses(
            [
                "Dashboard", "People", "Settings", "Billing", "Recruitment", "EmployeeTasks",
                "Onboarding", "Offboarding", "Leave", "Attendance", "Payroll", "Performance",
                "Learning", "OrgStructure", "Analytics", "AiAssistant", "Administration"
            ]).Select(m => m.Code).ToList();

        Assert.Contains("EmployeeBio", codes);
        Assert.Contains("EmployeeActions", codes);
        Assert.Contains("Approvals", codes);
        Assert.Contains("Reports", codes);
        Assert.Contains("EmailTemplates", codes);
        Assert.Contains("EmailDeliveryLog", codes);
        Assert.Contains("UserManagement", codes);
        Assert.Contains("Help", codes);
        Assert.Equal("Dashboard", codes[0]);
        Assert.Equal("Help", codes[^1]);
    }

    [Fact]
    public void FilterByLicenses_Hides_Rows_When_Parent_Unlicensed()
    {
        var codes = RolePermissionCatalog.FilterByLicenses(["Dashboard", "People", "Settings", "Billing"])
            .Select(m => m.Code)
            .ToList();

        Assert.Contains("EmployeeBio", codes);
        Assert.Contains("EmailTemplates", codes);
        Assert.Contains("Help", codes);
        Assert.DoesNotContain("Approvals", codes);
        Assert.DoesNotContain("UserManagement", codes);
        Assert.DoesNotContain("Reports", codes);
        Assert.DoesNotContain("Payroll", codes);
    }

    [Fact]
    public void ParentToChildCopies_Cover_New_Sidebar_Rows()
    {
        var children = RolePermissionCatalog.ParentToChildCopies.Select(x => x.Child).ToHashSet();
        Assert.Contains("EmployeeBio", children);
        Assert.Contains("EmployeeActions", children);
        Assert.Contains("Reports", children);
        Assert.Contains("EmailTemplates", children);
        Assert.Contains("EmailDeliveryLog", children);
        Assert.Contains("UserManagement", children);
    }
}
