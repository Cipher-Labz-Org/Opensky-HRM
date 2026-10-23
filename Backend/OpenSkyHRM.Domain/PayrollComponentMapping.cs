namespace OpenSkyHRM.Domain;

/// <summary>
/// Maps attendance/leave payroll parameters to compensation component codes.
/// Stored in SystemSettings; defaults match the seeded catalog.
/// </summary>
public static class PayrollComponentMapping
{
    public const string OtComponentKey = "Payroll_Map_OtComponent";
    public const string NopayComponentKey = "Payroll_Map_NopayComponent";
    public const string PoyaComponentKey = "Payroll_Map_PoyaComponent";
    public const string BaseComponentKey = "Payroll_Map_BaseComponent";
    public const string WorkingHoursComponentKey = "Payroll_Map_WorkingHoursComponent";

    public const string DefaultOtCode = "OT";
    public const string DefaultNopayCode = "NOPAY";
    public const string DefaultPoyaCode = PayrollPoyaComponent.DefaultCode;
    public const string DefaultBaseCode = "BASIC";
    /// <summary>Empty means use the OT Hourly Divisor setting instead of a component amount.</summary>
    public const string DefaultWorkingHoursCode = "";

    public static string NormalizeCode(string? code, string fallback)
    {
        if (string.IsNullOrWhiteSpace(code))
            return fallback;
        return code.Trim();
    }

    public static bool CodeEquals(string? left, string? right) =>
        !string.IsNullOrWhiteSpace(left)
        && !string.IsNullOrWhiteSpace(right)
        && left.Equals(right, StringComparison.OrdinalIgnoreCase);

    public static bool IsOtComponent(string? code, string mappedOtCode) =>
        CodeEquals(code, NormalizeCode(mappedOtCode, DefaultOtCode));

    public static bool IsNopayComponent(string? code, string mappedNopayCode) =>
        CodeEquals(code, NormalizeCode(mappedNopayCode, DefaultNopayCode));

    public static bool IsPoyaComponent(string? code, string? name, string mappedPoyaCode)
    {
        var mapped = NormalizeCode(mappedPoyaCode, DefaultPoyaCode);
        if (CodeEquals(code, mapped))
            return true;
        // Keep legacy name/code detection when the mapping still points at the default Poya component.
        return CodeEquals(mapped, DefaultPoyaCode) && PayrollPoyaComponent.IsMatch(code, name);
    }

    public static bool IsBaseComponent(string? code, string mappedBaseCode)
    {
        var mapped = NormalizeCode(mappedBaseCode, DefaultBaseCode);
        if (CodeEquals(code, mapped))
            return true;
        // Preserve BASIC* alias when the mapping is still the default basic code.
        return CodeEquals(mapped, DefaultBaseCode)
            && !string.IsNullOrWhiteSpace(code)
            && code.StartsWith("BASIC", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsWorkingHoursComponent(string? code, string? mappedWorkingHoursCode)
    {
        if (string.IsNullOrWhiteSpace(mappedWorkingHoursCode))
            return false;
        return CodeEquals(code, mappedWorkingHoursCode.Trim());
    }

    /// <summary>
    /// Quantity input for hours actually worked in the payroll period (not the OT divisor).
    /// </summary>
    public static bool IsWorkedHoursQuantity(string? code) =>
        !string.IsNullOrWhiteSpace(code)
        && (code.Equals("WORKED_HOURS", StringComparison.OrdinalIgnoreCase)
            || code.Equals("NO_OF_WORKED_HOURS", StringComparison.OrdinalIgnoreCase));
}
