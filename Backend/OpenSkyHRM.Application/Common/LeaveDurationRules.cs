namespace OpenSkyHRM.Application.Common;

public static class LeaveDurationKinds
{
    public const string FullDay = "FullDay";
    public const string HalfDay = "HalfDay";
    public const string ShortLeave = "ShortLeave";
}

public static class LeaveTypeCodes
{
    public const string ShortLeave = "LT-SHL";
}

public static class HalfDayPeriods
{
    public const string Morning = "Morning";
    public const string Afternoon = "Afternoon";
}

public static class LeaveDurationRules
{
    public const int WorkdayHours = 8;
    public const int MinShortLeaveHours = 1;
    public const int MaxShortLeaveHours = 4;
    public const int DefaultShortLeaveHours = 3;
    public const decimal HalfDayDays = 0.5m;

    public static string NormalizeKind(string? kind)
    {
        if (string.IsNullOrWhiteSpace(kind)
            || string.Equals(kind, LeaveDurationKinds.FullDay, StringComparison.OrdinalIgnoreCase))
            return LeaveDurationKinds.FullDay;
        if (string.Equals(kind, LeaveDurationKinds.HalfDay, StringComparison.OrdinalIgnoreCase))
            return LeaveDurationKinds.HalfDay;
        if (string.Equals(kind, LeaveDurationKinds.ShortLeave, StringComparison.OrdinalIgnoreCase))
            return LeaveDurationKinds.ShortLeave;
        throw new InvalidOperationException("Invalid leave duration. Use Full day, Half day, or Short leave.");
    }

    public static string? NormalizeHalfDayPeriod(string? period)
    {
        if (string.IsNullOrWhiteSpace(period))
            return null;
        if (string.Equals(period, HalfDayPeriods.Morning, StringComparison.OrdinalIgnoreCase)
            || string.Equals(period, "AM", StringComparison.OrdinalIgnoreCase))
            return HalfDayPeriods.Morning;
        if (string.Equals(period, HalfDayPeriods.Afternoon, StringComparison.OrdinalIgnoreCase)
            || string.Equals(period, "PM", StringComparison.OrdinalIgnoreCase))
            return HalfDayPeriods.Afternoon;
        throw new InvalidOperationException("Select morning or afternoon for half-day leave.");
    }

    public static int ClampShortLeaveHours(int hours)
    {
        if (hours < MinShortLeaveHours) return MinShortLeaveHours;
        if (hours > MaxShortLeaveHours) return MaxShortLeaveHours;
        return hours;
    }

    public static bool IsShortLeaveType(string? code, bool allowShortLeave = false) =>
        allowShortLeave
        || string.Equals(code, LeaveTypeCodes.ShortLeave, StringComparison.OrdinalIgnoreCase);

    public static void ResolveTypeDurationFlags(
        string? code,
        bool requestedHalfDay,
        int requestedHours,
        out bool allowHalfDay,
        out bool allowShortLeave,
        out int shortLeaveHours)
    {
        allowShortLeave = IsShortLeaveType(code);
        allowHalfDay = allowShortLeave ? false : requestedHalfDay;
        shortLeaveHours = ClampShortLeaveHours(requestedHours);
    }

    public static int? NormalizeOptionalHours(int? hours)
    {
        if (!hours.HasValue || hours.Value <= 0) return null;
        return ClampShortLeaveHours(hours.Value);
    }

    public static void NormalizeMinMaxHours(ref int? minHours, ref int? maxHours)
    {
        minHours = NormalizeOptionalHours(minHours);
        maxHours = NormalizeOptionalHours(maxHours);
        if (minHours.HasValue && maxHours.HasValue && minHours.Value > maxHours.Value)
            throw new InvalidOperationException("Minimum hours cannot be greater than maximum hours.");
    }

    public static int ClampHoursWithinBounds(int hours, int? minHours, int? maxHours)
    {
        hours = ClampShortLeaveHours(hours);
        if (minHours.HasValue && hours < minHours.Value) hours = minHours.Value;
        if (maxHours.HasValue && hours > maxHours.Value) hours = maxHours.Value;
        return hours;
    }

    public static void EnsureWithinMinMaxHours(int hours, int? minHours, int? maxHours)
    {
        if (minHours.HasValue && hours < minHours.Value)
            throw new InvalidOperationException($"This leave type requires at least {minHours.Value} hour(s). Requested: {hours}.");
        if (maxHours.HasValue && hours > maxHours.Value)
            throw new InvalidOperationException($"This leave type allows at most {maxHours.Value} hour(s) per request. Requested: {hours}.");
    }

    public static decimal FullDayDays(DateTime start, DateTime end)
    {
        var days = (end.Date - start.Date).TotalDays + 1;
        return (decimal)Math.Max(1, Math.Ceiling(days));
    }

    public static decimal ShortLeaveDays(int hours) =>
        ClampShortLeaveHours(hours) / (decimal)WorkdayHours;

    public static decimal ResolveTotalDays(
        string durationKind,
        DateTime start,
        DateTime end,
        bool allowHalfDay,
        bool allowShortLeave,
        int typeShortLeaveHours,
        string? halfDayPeriod,
        int? requestedShortLeaveHours,
        out string? storedHalfDayPeriod,
        out int? storedShortLeaveHours)
    {
        storedHalfDayPeriod = null;
        storedShortLeaveHours = null;

        if (durationKind == LeaveDurationKinds.HalfDay)
        {
            if (!allowHalfDay)
                throw new InvalidOperationException("This leave type does not allow half-day requests.");
            if (start.Date != end.Date)
                throw new InvalidOperationException("Half-day leave must be for a single date.");
            storedHalfDayPeriod = NormalizeHalfDayPeriod(halfDayPeriod)
                ?? throw new InvalidOperationException("Select morning or afternoon for half-day leave.");
            return HalfDayDays;
        }

        if (durationKind == LeaveDurationKinds.ShortLeave)
        {
            if (!allowShortLeave)
                throw new InvalidOperationException("This leave type does not allow short leave.");
            if (start.Date != end.Date)
                throw new InvalidOperationException("Short leave must be for a single date.");
            var hours = requestedShortLeaveHours ?? typeShortLeaveHours;
            hours = ClampShortLeaveHours(hours);
            storedShortLeaveHours = hours;
            return ShortLeaveDays(hours);
        }

        return FullDayDays(start, end);
    }

    public static decimal? NormalizeBound(decimal? days)
    {
        if (!days.HasValue || days.Value <= 0) return null;
        return days.Value;
    }

    public static void NormalizeMinMax(ref decimal? minDays, ref decimal? maxDays)
    {
        minDays = NormalizeBound(minDays);
        maxDays = NormalizeBound(maxDays);
        if (minDays.HasValue && maxDays.HasValue && minDays.Value > maxDays.Value)
            throw new InvalidOperationException("Minimum days cannot be greater than maximum days.");
    }

    public static void EnsureWithinMinMax(decimal totalDays, decimal? minDays, decimal? maxDays)
    {
        if (minDays.HasValue && totalDays < minDays.Value)
            throw new InvalidOperationException($"This leave type requires at least {minDays.Value:0.##} day(s). Requested: {totalDays:0.##}.");
        if (maxDays.HasValue && totalDays > maxDays.Value)
            throw new InvalidOperationException($"This leave type allows at most {maxDays.Value:0.##} day(s) per request. Requested: {totalDays:0.##}.");
    }
}
