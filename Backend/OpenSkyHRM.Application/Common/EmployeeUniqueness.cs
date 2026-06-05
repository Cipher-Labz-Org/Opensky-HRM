using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Common;

public static class EmployeeUniqueness
{
    public static async Task ValidateForCreateAsync(AppDbContext db, string employeeCode, string email)
    {
        if (string.IsNullOrWhiteSpace(employeeCode))
            throw new InvalidOperationException("Employee code is required.");

        var normalizedCode = employeeCode.Trim();
        var normalizedEmail = email.Trim();

        if (await db.Employees.IgnoreQueryFilters().AnyAsync(e => e.EmployeeCode == normalizedCode))
        {
            throw new InvalidOperationException(
                $"Employee code '{normalizedCode}' is already in use (including archived employees). Choose a different code.");
        }

        if (await db.Employees.IgnoreQueryFilters().AnyAsync(e => e.Email == normalizedEmail))
        {
            throw new InvalidOperationException(
                $"Email '{normalizedEmail}' is already used by another employee (including archived records). Use a different email or delete the archived employee first.");
        }
    }

    public static async Task ValidateEmailForUpdateAsync(AppDbContext db, Guid employeeId, string email)
    {
        var normalizedEmail = email.Trim();
        if (await db.Employees.IgnoreQueryFilters()
                .AnyAsync(e => e.Id != employeeId && e.Email == normalizedEmail))
        {
            throw new InvalidOperationException(
                $"Email '{normalizedEmail}' is already used by another employee (including archived records).");
        }
    }

    /// <summary>Rewrites email on soft-delete so the unique index can accept a new hire with the same address.</summary>
    public static string ArchiveEmail(Guid employeeId, string currentEmail)
    {
        const string marker = ".archived.";
        if (currentEmail.Contains(marker, StringComparison.OrdinalIgnoreCase))
            return currentEmail;

        var at = currentEmail.LastIndexOf('@');
        if (at <= 0)
            return $"archived-{employeeId:N}@employee.noemail.opensky.hrm";

        var local = currentEmail[..at];
        var domain = currentEmail[(at + 1)..];
        var suffix = $"{marker}{employeeId:N}";
        var maxLocalLen = 255 - suffix.Length - domain.Length - 1;
        if (maxLocalLen < 1)
            return $"archived-{employeeId:N}@{domain}"[..Math.Min(255, $"archived-{employeeId:N}@{domain}".Length)];

        var trimmedLocal = local.Length > maxLocalLen ? local[..maxLocalLen] : local;
        return $"{trimmedLocal}{suffix}@{domain}";
    }
}
