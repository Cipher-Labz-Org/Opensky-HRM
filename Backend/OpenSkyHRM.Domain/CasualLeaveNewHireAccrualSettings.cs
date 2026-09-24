namespace OpenSkyHRM.Domain;

/// <summary>
/// Company setting for pre-permanency casual leave accrual (0.5 day per completed month from join through Date of Permanency).
/// After <see cref="Entities.Employee.DateOfPermanency"/>, Shop &amp; Office casual applies as usual.
/// </summary>
public static class CasualLeaveNewHireAccrualSettings
{
    public const string EnabledKey = "CasualLeaveNewHireHalfDayAccrualEnabled";

    public static readonly CasualLeaveNewHireAccrualOptions Disabled = new(Enabled: false);

    public static bool IsEnabled(string? value) =>
        string.Equals(value?.Trim(), "true", StringComparison.OrdinalIgnoreCase);

    public static CasualLeaveNewHireAccrualOptions Parse(IReadOnlyDictionary<string, string> settings)
    {
        settings.TryGetValue(EnabledKey, out var enabledRaw);
        return Parse(enabledRaw);
    }

    public static CasualLeaveNewHireAccrualOptions Parse(string? enabledRaw) =>
        new(IsEnabled(enabledRaw));
}

public readonly record struct CasualLeaveNewHireAccrualOptions(bool Enabled);
