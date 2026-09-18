using System.Text.RegularExpressions;

namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Leave-balance Excel/CSV import matching and stock mapping.
/// Comp-off / special-grant sheets often store the yearly grant in Carried Forward with Entitled blank,
/// and type names differ slightly from the catalog (Freelancer vs Freelances, trailing "Leave").
/// </summary>
public static class LeaveBalanceImportRules
{
    public static readonly IReadOnlyDictionary<string, string[]> HeaderAliases =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["Employee Code"] = ["Employee Code", "Emp Code", "EmpCode", "EmployeeCode", "Employee No", "Emp No", "Emp ID", "Employee ID"],
            ["Leave Type"] = ["Leave Type", "LeaveType", "Leave Name", "LeaveName", "Type Name"],
            ["Year"] = ["Year", "Leave Year", "Period Year"],
            ["Entitled"] = ["Entitled", "Entitlement", "Opening", "Opening Balance", "Entitled Days"],
            ["Used"] = ["Used", "Taken", "Availed", "Days Taken", "Used Days"],
            ["Carried Forward"] = ["Carried Forward", "Carry Forward", "CarryForward", "CF", "BF", "B/F", "Brought Forward", "BroughtForward"],
            ["Start Date"] = ["Start Date", "From Date", "Period Start"],
            ["End Date"] = ["End Date", "To Date", "Period End"],
            ["Reason"] = ["Reason", "Remarks", "Comment"],
            ["Remaining"] = ["Remaining", "Balance", "Closing", "Closing Balance", "Days Remaining"],
        };

    public static string NormalizeEmployeeCode(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var t = raw.Trim();
        var stripped = t.TrimStart('0');
        return stripped.Length == 0 ? "0" : stripped;
    }

    public static bool EmployeeCodesMatch(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) return false;
        var a = left.Trim();
        var b = right.Trim();
        if (a.Equals(b, StringComparison.OrdinalIgnoreCase)) return true;
        return NormalizeEmployeeCode(a).Equals(NormalizeEmployeeCode(b), StringComparison.OrdinalIgnoreCase);
    }

    public static string NormalizeLeaveTypeKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

        var s = raw.Trim().ToLowerInvariant()
            .Replace('\u00a0', ' ')
            .Replace('\u2007', ' ')
            .Replace('\u202f', ' ');
        s = Regex.Replace(s, @"[^a-z0-9]+", " ");
        s = Regex.Replace(s, @"\s+", " ").Trim();
        s = Regex.Replace(s, @"\bfreelances\b", "freelancer");
        s = Regex.Replace(s, @"\bfreelance\b", "freelancer");
        s = Regex.Replace(s, @"\bcomp\s*off\b", "compensatory off");
        s = Regex.Replace(s, @"\bc\s*off\b", "compensatory off");
        s = Regex.Replace(s, @"\bcto\b", "compensatory off");
        s = Regex.Replace(s, @"\bcoff\b", "compensatory off");
        if (s.EndsWith(" leave", StringComparison.Ordinal))
            s = s[..^6].Trim();
        return s;
    }

    /// <summary>
    /// Comp-off / freelancer special grant stock is not Shop &amp; Office carry-forward and must not expire after 3 months.
    /// </summary>
    public static bool IsNonExpiringGrantType(string? name, string? code = null)
    {
        var key = NormalizeLeaveTypeKey(name);
        var codeKey = NormalizeLeaveTypeKey(code);
        if (key.Contains("compensatory", StringComparison.Ordinal)
            || key.Contains("comp off", StringComparison.Ordinal)
            || key is "cto" or "coff")
            return true;
        if (key.Contains("special grant", StringComparison.Ordinal)
            || key.Contains("freelancer", StringComparison.Ordinal))
            return true;
        if (codeKey is "lt coff" or "lt fsg" or "coff" or "fsg" or "cto")
            return true;
        return codeKey.Contains("coff", StringComparison.Ordinal) || codeKey.Contains("fsg", StringComparison.Ordinal);
    }

    public static T? ResolveLeaveType<T>(
        IReadOnlyList<T> types,
        string? rawName,
        Func<T, string> nameSelector,
        Func<T, string?>? codeSelector = null,
        Func<T, bool>? isActiveSelector = null)
    {
        var key = NormalizeLeaveTypeKey(rawName);
        if (key.Length == 0 || types.Count == 0) return default;

        T? PreferActive(IEnumerable<T> matches)
        {
            var list = matches.ToList();
            if (list.Count == 0) return default;
            if (isActiveSelector is null) return list[0];
            return list.FirstOrDefault(isActiveSelector) ?? list[0];
        }

        var exact = types.Where(t =>
        {
            if (NormalizeLeaveTypeKey(nameSelector(t)) == key) return true;
            var code = codeSelector?.Invoke(t);
            return !string.IsNullOrWhiteSpace(code) && NormalizeLeaveTypeKey(code) == key;
        }).ToList();
        var exactHit = PreferActive(exact);
        if (exactHit is not null) return exactHit;

        if (key.Length < 3) return default;

        var contained = types.Where(t =>
        {
            var n = NormalizeLeaveTypeKey(nameSelector(t));
            if (n.Length < 3) return false;
            return n.Contains(key) || key.Contains(n);
        }).ToList();

        if (contained.Count == 1) return contained[0];
        if (isActiveSelector is not null)
        {
            var active = contained.Where(isActiveSelector).ToList();
            if (active.Count == 1) return active[0];
        }

        return default;
    }

    /// <summary>
    /// Grant/comp-off stock is often listed under Carried Forward with Entitled blank.
    /// Store it as Entitled so the 3-month carry-forward window does not forfeit it.
    /// Annual/Casual (and any type with an entitlement rule) keep CF as carry-forward,
    /// unless the type is a known non-expiring grant.
    /// </summary>
    public static (decimal Entitled, decimal CarriedForward, bool Converted) MapImportedStock(
        decimal entitled,
        decimal carriedForward,
        bool leaveTypeHasEntitlementRule,
        bool isNonExpiringGrant = false)
    {
        var cf = Math.Max(0, carriedForward);
        var treatAsGrant = isNonExpiringGrant || !leaveTypeHasEntitlementRule;
        if (treatAsGrant && entitled <= 0 && cf > 0)
            return (cf, 0, true);
        return (Math.Max(0, entitled), cf, false);
    }

    /// <summary>
    /// Display remaining for grant types whose Excel stock was stored as CF and later forfeited on read.
    /// </summary>
    public static (decimal Entitled, decimal CarriedForward, decimal Remaining) MapStoredGrantForDisplay(
        decimal entitled,
        decimal used,
        decimal carriedForward,
        decimal broughtForwardDays)
    {
        var grantStock = Math.Max(0, entitled);
        var grantCarry = Math.Max(0, carriedForward);
        if (grantStock <= 0)
        {
            grantStock = Math.Max(grantCarry, Math.Max(0, broughtForwardDays));
            grantCarry = 0;
        }

        return (grantStock, grantCarry, grantStock + grantCarry - used);
    }
}
