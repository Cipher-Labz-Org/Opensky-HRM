using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetExpiringDocumentsTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetExpiringDocumentsTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_expiring_documents";
    public override string Description =>
        "List immigration documents, licenses, and certifications expiring within the next N days.";
    public override IReadOnlyList<string> RequiredModules => ["People"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            days = new { type = "integer", description = "Lookahead days (default 60)" },
            limit = new { type = "integer", description = "Max rows (default 20)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var days = Math.Clamp(GetInt(args, "days") ?? 60, 1, 365);
        var limit = Math.Clamp(GetInt(args, "limit") ?? 20, 1, 50);
        var today = DateTime.UtcNow.Date;
        var endDate = today.AddDays(days);

        var alerts = new List<(int DaysUntilExpiry, object Item)>();

        var immigrationQ = ctx.Db.Immigrations.AsNoTracking()
            .Include(i => i.Employee)
            .Where(i => !i.IsDeleted
                        && i.ExpiryDate != null
                        && i.ExpiryDate >= today
                        && i.ExpiryDate <= endDate);

        if (allowedIds != null)
            immigrationQ = immigrationQ.Where(i => allowedIds.Contains(i.EmployeeId));

        var immigration = await immigrationQ
            .Select(i => new
            {
                type = "Immigration",
                documentType = i.DocumentType,
                employee = i.Employee.FirstName + " " + i.Employee.LastName,
                i.Employee.EmployeeCode,
                expiryDate = i.ExpiryDate!.Value.ToString("yyyy-MM-dd"),
                daysUntilExpiry = (i.ExpiryDate!.Value.Date - today).Days,
            })
            .ToListAsync(ct);

        alerts.AddRange(immigration.Select(i => (i.daysUntilExpiry, (object)i)));

        var licenseQ = ctx.Db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted
                        && e.LicenseExpiryDate != null
                        && e.LicenseExpiryDate >= today
                        && e.LicenseExpiryDate <= endDate
                        && !string.Equals(e.Status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase));

        if (allowedIds != null)
            licenseQ = licenseQ.Where(e => allowedIds.Contains(e.Id));

        var licenses = await licenseQ
            .Select(e => new
            {
                type = "License",
                documentType = "Transport License",
                employee = e.FirstName + " " + e.LastName,
                e.EmployeeCode,
                expiryDate = e.LicenseExpiryDate!.Value.ToString("yyyy-MM-dd"),
                daysUntilExpiry = (e.LicenseExpiryDate!.Value.Date - today).Days,
            })
            .ToListAsync(ct);

        alerts.AddRange(licenses.Select(l => (l.daysUntilExpiry, (object)l)));

        var certQ = ctx.Db.EmployeeCertifications.AsNoTracking()
            .Include(c => c.Employee)
            .Include(c => c.Certification)
            .Where(c => !c.IsDeleted
                        && c.ExpiryDate != null
                        && c.ExpiryDate >= today
                        && c.ExpiryDate <= endDate);

        if (allowedIds != null)
            certQ = certQ.Where(c => allowedIds.Contains(c.EmployeeId));

        var certs = await certQ
            .Select(c => new
            {
                type = "Certification",
                documentType = c.Certification != null ? c.Certification.Name : "Certification",
                employee = c.Employee.FirstName + " " + c.Employee.LastName,
                c.Employee.EmployeeCode,
                expiryDate = c.ExpiryDate!.Value.ToString("yyyy-MM-dd"),
                daysUntilExpiry = (c.ExpiryDate!.Value.Date - today).Days,
            })
            .ToListAsync(ct);

        alerts.AddRange(certs.Select(c => (c.daysUntilExpiry, (object)c)));

        var sorted = alerts
            .OrderBy(a => a.DaysUntilExpiry)
            .Take(limit)
            .Select(a => a.Item)
            .ToList();

        return AiToolResult.Ok(new { days, totalExpiring = alerts.Count, expiringDocuments = sorted },
            alerts.Count == 0
                ? $"No documents expiring in the next {days} days"
                : $"{alerts.Count} document(s) expiring in the next {days} days");
    }
}
