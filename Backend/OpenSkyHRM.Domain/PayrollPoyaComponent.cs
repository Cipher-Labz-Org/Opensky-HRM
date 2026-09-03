namespace OpenSkyHRM.Domain;

/// <summary>
/// Stage Cafe / Sri Lanka Poya pay: Basic ÷ 30 × days worked on a Poya holiday.
/// Day counts of 0.5 (half day) through 15 are treated as days; larger values are lump-sum LKR.
/// </summary>
public static class PayrollPoyaComponent
{
    public const string FormulaExpression = "BASIC / 30 * POYA_DAYS";
    public const string DependsOnComponentCode = "BASIC";
    public const string DefaultCode = "POYA";
    public const decimal ManualDaysCap = 15m;

    public static bool IsMatch(string? code, string? name)
    {
        if (!string.IsNullOrWhiteSpace(code))
        {
            if (code.Equals(DefaultCode, StringComparison.OrdinalIgnoreCase)
                || code.Equals("PD002", StringComparison.OrdinalIgnoreCase)
                || code.StartsWith("POYA", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return !string.IsNullOrWhiteSpace(name)
            && name.Contains("Poya", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsLumpSumPay(decimal amount) => amount > ManualDaysCap;

    public static decimal ResolveDays(decimal? assignmentAmount, decimal attendanceDays)
    {
        if (assignmentAmount is > 0 and <= ManualDaysCap)
            return assignmentAmount.Value;
        return attendanceDays;
    }
}
