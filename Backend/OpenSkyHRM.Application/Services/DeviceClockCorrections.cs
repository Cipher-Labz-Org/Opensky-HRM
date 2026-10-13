using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Saved device clock corrections. They are applied whenever a stored ADMS payload is read,
/// so re-reading the raw data never brings the wrong device time back.
/// </summary>
internal static class DeviceClockCorrections
{
    public const string SettingKey = "biometric.deviceClockCorrections";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<List<DeviceClockCorrectionDto>> LoadAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var value = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(value))
            return new List<DeviceClockCorrectionDto>();

        return JsonSerializer.Deserialize<List<DeviceClockCorrectionDto>>(value, Json) ?? new List<DeviceClockCorrectionDto>();
    }

    public static async Task AddAsync(AppDbContext db, DeviceClockCorrectionDto rule, CancellationToken cancellationToken)
    {
        var rules = await LoadAsync(db, cancellationToken);
        rules.Add(rule);
        var value = JsonSerializer.Serialize(rules, Json);

        var setting = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKey, cancellationToken);
        if (setting is null)
        {
            db.SystemSettings.Add(new SystemSetting
            {
                Key = SettingKey,
                Value = value,
                Description = "Fingerprint device clock corrections applied to stored ADMS punches.",
            });
        }
        else
        {
            setting.Value = value;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public static DateTime Apply(
        IReadOnlyList<DeviceClockCorrectionDto> rules,
        Guid deviceId,
        DateTime receivedAtUtc,
        DateTime punchAt)
    {
        foreach (var rule in rules)
        {
            if (rule.DeviceId == deviceId
                && receivedAtUtc >= rule.ReceivedFromUtc
                && receivedAtUtc < rule.ReceivedToUtc)
                return punchAt.AddMinutes(rule.OffsetMinutes);
        }

        return punchAt;
    }
}
