using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class EmployeeBirthdayDigestReminderService : IEmployeeBirthdayDigestReminderService
{
    public const string CategoryBirthdayToday = "BirthdayToday";
    public const string CategoryBirthdayUpcoming = "BirthdayUpcoming";
    private const string LegacyDigestCategory = "EmployeeBirthdayDigest";

    private readonly AppDbContext _db;
    private readonly ILogger<EmployeeBirthdayDigestReminderService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public EmployeeBirthdayDigestReminderService(
        AppDbContext db,
        ILogger<EmployeeBirthdayDigestReminderService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<int> ProcessForUtcDateAsync(DateTime utcToday, CancellationToken cancellationToken = default)
    {
        var today = utcToday.Kind == DateTimeKind.Utc
            ? utcToday.Date
            : DateTime.SpecifyKind(utcToday, DateTimeKind.Utc).Date;
        var windowEnd = today.AddDays(6);
        var runKey = today.ToString("yyyyMMdd", CultureInfo.InvariantCulture);

        var employees = await _db.Employees.AsNoTracking()
            .Include(e => e.Department)
            .Where(e =>
                e.DateOfBirth.Year > 1900
                && (e.TerminationDate == null || e.TerminationDate.Value.Date >= today))
            .ToListAsync(cancellationToken);

        var entries = new List<BirthdayEntry>();
        for (var d = today; d <= windowEnd; d = d.AddDays(1))
        {
            foreach (var emp in employees)
            {
                if (!IsBirthdayAnniversary(d, emp.DateOfBirth))
                    continue;
                var name = string.IsNullOrWhiteSpace(emp.MiddleName)
                    ? $"{emp.FirstName} {emp.LastName}".Trim()
                    : $"{emp.FirstName} {emp.MiddleName} {emp.LastName}".Trim();
                var dept = emp.Department?.Name?.Trim();
                entries.Add(new BirthdayEntry(d, name, emp.Id, string.IsNullOrEmpty(dept) ? null : dept, d == today));
            }
        }

        if (entries.Count == 0)
            return 0;

        entries.Sort((a, b) =>
        {
            if (a.IsToday != b.IsToday)
                return a.IsToday ? -1 : 1;
            var c = a.OccasionDate.CompareTo(b.OccasionDate);
            return c != 0 ? c : string.Compare(a.FullName, b.FullName, StringComparison.OrdinalIgnoreCase);
        });

        var recipientIds = await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && !u.IsDeleted)
            .Select(u => u.Id)
            .Distinct()
            .ToListAsync(cancellationToken);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await _db.UserNotifications
                .Where(n =>
                    n.Category == CategoryBirthdayToday
                    || n.Category == CategoryBirthdayUpcoming
                    || n.Category == LegacyDigestCategory)
                .ExecuteDeleteAsync(cancellationToken);

            var inv = CultureInfo.InvariantCulture;
            var rows = new List<UserNotification>();
            foreach (var userId in recipientIds)
            {
                foreach (var e in entries)
                {
                    if (e.IsToday)
                    {
                        var iso = e.OccasionDate.ToString("yyyy-MM-dd", inv);
                        var payload = new BirthdayTodayPayload(e.EmployeeId, e.DepartmentName, iso);
                        var body = JsonSerializer.Serialize(payload, JsonOpts);
                        rows.Add(new UserNotification
                        {
                            UserId = userId,
                            Title = $"Birthday today: {e.FullName}",
                            Body = body,
                            Category = CategoryBirthdayToday,
                            DedupeKey = $"BD-TODAY:{runKey}:{e.EmployeeId:N}:{userId:N}",
                        });
                    }
                    else
                    {
                        var inDays = (e.OccasionDate - today).Days;
                        var shortDate = e.OccasionDate.ToString("MMM d", inv);
                        var iso = e.OccasionDate.ToString("yyyy-MM-dd", inv);
                        var payload = new BirthdayUpcomingPayload(e.EmployeeId, inDays, shortDate, iso);
                        var body = JsonSerializer.Serialize(payload, JsonOpts);
                        rows.Add(new UserNotification
                        {
                            UserId = userId,
                            Title = $"Upcoming birthday: {e.FullName}",
                            Body = body,
                            Category = CategoryBirthdayUpcoming,
                            DedupeKey =
                                $"BD-UP:{runKey}:{e.EmployeeId:N}:{e.OccasionDate:yyyyMMdd}:{userId:N}",
                        });
                    }
                }
            }

            _db.UserNotifications.AddRange(rows);
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation(
            "Employee birthday notifications for {RunKey}: {EntryCount} people × {Recipients} users = {RowCount} rows",
            runKey, entries.Count, recipientIds.Count, entries.Count * recipientIds.Count);

        return entries.Count * recipientIds.Count;
    }

    private sealed record BirthdayEntry(
        DateTime OccasionDate,
        string FullName,
        Guid EmployeeId,
        string? DepartmentName,
        bool IsToday);

    private sealed record BirthdayTodayPayload(Guid EmployeeId, string? Department, string IsoDate);

    private sealed record BirthdayUpcomingPayload(Guid EmployeeId, int InDays, string ShortDate, string IsoDate);

    /// <summary>True when <paramref name="calendarDate"/> matches month/day of birth (Feb 29 → Feb 28 on non-leap years).</summary>
    public static bool IsBirthdayAnniversary(DateTime calendarDate, DateTime dateOfBirth)
    {
        var month = dateOfBirth.Month;
        var day = dateOfBirth.Day;
        if (month == 2 && day == 29 && !DateTime.IsLeapYear(calendarDate.Year))
            day = 28;
        return calendarDate.Month == month && calendarDate.Day == day;
    }
}
