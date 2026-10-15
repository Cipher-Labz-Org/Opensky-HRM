using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Common;

public static class EmploymentTypeRules
{
    /// <summary>Freelance / freelancer staff: no EPF, ETF, or APIT on payroll.</summary>
    public static bool SkipsProvidentFund(string? employmentType)
        => IsFreelanceEmploymentType(employmentType);

    /// <summary>
    /// Same as <see cref="SkipsProvidentFund"/> but also matches active catalog codes flagged as freelance.
    /// </summary>
    public static bool SkipsProvidentFund(string? employmentType, IReadOnlySet<string> freelanceCatalogCodes)
        => SkipsProvidentFund(employmentType, freelanceCatalogCodes, null);

    /// <summary>
    /// Freelancers skip EPF, ETF, and APIT. Matches enum codes, catalog freelance codes,
    /// or when the stored value equals a freelance catalog row's code or display name.
    /// </summary>
    public static bool SkipsProvidentFund(
        string? employmentType,
        IReadOnlySet<string> freelanceCatalogCodes,
        IEnumerable<(string Code, string Name)>? fullCatalog)
    {
        if (IsFreelanceEmploymentType(employmentType))
            return true;

        var stored = employmentType?.Trim();
        if (string.IsNullOrEmpty(stored))
            return false;

        if (freelanceCatalogCodes.Contains(stored))
            return true;

        if (fullCatalog is null)
            return false;

        foreach (var (code, name) in fullCatalog)
        {
            if (!IsFreelanceCatalogEntry(code, name))
                continue;
            if (stored.Equals(code, StringComparison.OrdinalIgnoreCase)
                || stored.Equals(name, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    public static bool IsFreelanceEmploymentType(string? employmentType)
    {
        var key = NormalizeEmploymentTypeKey(employmentType);
        return key is "freelance" or "freelancer";
    }

    public static bool IsFreelanceCatalogEntry(string? code, string? name)
        => IsFreelanceEmploymentType(code) || IsFreelanceEmploymentType(name);

    public static HashSet<string> CollectFreelanceEmploymentCodes(IEnumerable<(string Code, string Name)> catalog)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (code, name) in catalog)
        {
            if (!IsFreelanceCatalogEntry(code, name) || string.IsNullOrWhiteSpace(code))
                continue;
            set.Add(code.Trim());
        }

        set.Add(nameof(EmploymentType.Freelance));
        return set;
    }

    /// <summary>EPF, ETF, and APIT lines omitted on freelancer payslips.</summary>
    public static bool IsFreelanceExcludedStatutoryLine(string? componentCode, string? componentName)
    {
        if (string.IsNullOrWhiteSpace(componentCode) && string.IsNullOrWhiteSpace(componentName))
            return false;
        if (string.Equals(componentCode, "APIT", StringComparison.OrdinalIgnoreCase)
            || string.Equals(componentName, "APIT", StringComparison.OrdinalIgnoreCase))
            return true;
        var code = componentCode?.ToUpperInvariant() ?? "";
        return code is "EPF_EE" or "EPF_ER" or "ETF_ER";
    }

    public static string NormalizeEmploymentTypeKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        Span<char> buffer = stackalloc char[value.Length];
        var len = 0;
        foreach (var ch in value)
        {
            if (!char.IsLetterOrDigit(ch))
                continue;
            buffer[len++] = char.ToLowerInvariant(ch);
        }

        return len == 0 ? string.Empty : new string(buffer[..len]);
    }
}
