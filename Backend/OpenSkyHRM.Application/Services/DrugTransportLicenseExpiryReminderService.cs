using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class DrugTransportLicenseExpiryReminderService : IDrugTransportLicenseExpiryReminderService
{
    public const string Category = "DrugTransportLicenseExpiry";
    private const string DedupePrefix = "DTL-T30";

    private readonly AppDbContext _db;
    private readonly IUserNotificationService _notifications;
    private readonly ILogger<DrugTransportLicenseExpiryReminderService> _logger;

    public DrugTransportLicenseExpiryReminderService(
        AppDbContext db,
        IUserNotificationService notifications,
        ILogger<DrugTransportLicenseExpiryReminderService> logger)
    {
        _db = db;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<int> ProcessForUtcDateAsync(DateTime utcToday, CancellationToken cancellationToken = default)
    {
        var today = utcToday.Kind == DateTimeKind.Utc ? utcToday.Date : DateTime.SpecifyKind(utcToday, DateTimeKind.Utc).Date;
        var expiryCalendarTarget = today.AddDays(30);

        var attachments = await _db.EmployeeAttachments.AsNoTracking()
            .Include(a => a.AttachmentType)
            .Include(a => a.Employee)
            .Where(a =>
                a.AttachmentTypeId != null
                && a.AttachmentType != null
                && a.ExpiryDate != null
                && a.ExpiryDate.Value.Date == expiryCalendarTarget
                && (a.AttachmentType!.Code == "ATT-DTL"
                    || EF.Functions.ILike(a.AttachmentType.Name, "%drug%transport%licen%")))
            .ToListAsync(cancellationToken);

        var created = 0;
        foreach (var att in attachments)
        {
            if (att.AttachmentType is null || att.Employee is null)
                continue;

            var employeeName = $"{att.Employee.FirstName} {att.Employee.LastName}".Trim();
            var expiryLabel = att.ExpiryDate!.Value.Date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

            var ownerUserIds = await _db.Users.AsNoTracking()
                .Where(u => u.IsActive && u.EmployeeId == att.EmployeeId)
                .Select(u => u.Id)
                .Distinct()
                .ToListAsync(cancellationToken);

            var supervisorEmployeeIds = await _db.EmployeeSupervisors.AsNoTracking()
                .Where(es => es.EmployeeId == att.EmployeeId && es.ReportingMethod == "Direct")
                .Select(es => es.SupervisorId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var supervisorUserIds = supervisorEmployeeIds.Count == 0
                ? new List<Guid>()
                : await _db.Users.AsNoTracking()
                    .Where(u => u.IsActive && u.EmployeeId != null && supervisorEmployeeIds.Contains(u.EmployeeId!.Value))
                    .Select(u => u.Id)
                    .Distinct()
                    .ToListAsync(cancellationToken);

            foreach (var uid in ownerUserIds)
            {
                var dedupe = $"{DedupePrefix}:{att.Id}:{uid}";
                var title = "Drug transport license expiring soon";
                var body =
                    $"Your drug transport license expires on {expiryLabel} (30 days from today).";
                if (await _notifications.TryCreateDedupedAsync(uid, dedupe, title, body, Category, att.Id,
                        cancellationToken))
                {
                    created++;
                    _logger.LogInformation("Drug transport license reminder created for user {UserId}, attachment {AttachmentId}",
                        uid, att.Id);
                }
            }

            foreach (var uid in supervisorUserIds)
            {
                if (ownerUserIds.Contains(uid))
                    continue;

                var dedupe = $"{DedupePrefix}:{att.Id}:{uid}";
                var title = "Drug transport license expiring soon";
                var body =
                    $"The drug transport license for {employeeName} expires on {expiryLabel} (30 days from today).";
                if (await _notifications.TryCreateDedupedAsync(uid, dedupe, title, body, Category, att.Id,
                        cancellationToken))
                {
                    created++;
                    _logger.LogInformation("Drug transport license supervisor reminder for user {UserId}, attachment {AttachmentId}",
                        uid, att.Id);
                }
            }
        }

        return created;
    }
}
