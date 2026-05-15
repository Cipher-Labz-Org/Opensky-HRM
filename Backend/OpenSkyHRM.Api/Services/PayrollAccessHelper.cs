using System.Security.Claims;

namespace OpenSkyHRM.Api.Services;

/// <summary>Payroll authorization: org-wide admin vs employee self-service (own payslip / advance).</summary>
public static class PayrollAccessHelper
{
    /// <summary>
    /// ADMIN or any <c>Payroll:*:All</c> permission — run payroll, edit compensation, view all payslips, settings.
    /// </summary>
    public static bool HasPayrollAllScope(ClaimsPrincipal user)
    {
        if (user.IsInRole("ADMIN"))
            return true;

        foreach (var c in user.FindAll("permission"))
        {
            var v = c.Value;
            if (!v.StartsWith("Payroll:", StringComparison.OrdinalIgnoreCase))
                continue;
            var parts = v.Split(':');
            if (parts.Length >= 3 && string.Equals(parts[2], "All", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    /// <summary>Any <c>Payroll:*:Own</c> permission (e.g. employee payslip + advance).</summary>
    public static bool HasPayrollOwnScope(ClaimsPrincipal user)
    {
        foreach (var c in user.FindAll("permission"))
        {
            var v = c.Value;
            if (!v.StartsWith("Payroll:", StringComparison.OrdinalIgnoreCase))
                continue;
            var parts = v.Split(':');
            if (parts.Length >= 3 && string.Equals(parts[2], "Own", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    /// <summary>Open pay-run list for salary advance (employees) or full batch APIs (HR).</summary>
    public static bool CanAccessPayrollBatchListing(ClaimsPrincipal user)
        => HasPayrollAllScope(user) || HasPayrollOwnScope(user);

    /// <summary>View/submit own advance requests (or full access via HR).</summary>
    public static bool CanUseSalaryAdvanceEmployeeApis(ClaimsPrincipal user)
        => HasPayrollAllScope(user) || HasPayrollOwnScope(user);

    /// <summary>Users who can view the HR queue and approve or reject salary advance requests.</summary>
    public static bool CanManageSalaryAdvanceApprovals(ClaimsPrincipal user)
    {
        if (user.IsInRole("ADMIN"))
            return true;

        foreach (var c in user.FindAll("permission"))
        {
            var v = c.Value;
            if (!v.StartsWith("Payroll:", StringComparison.OrdinalIgnoreCase))
                continue;
            if (v.Contains(":Update:All", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }
}
