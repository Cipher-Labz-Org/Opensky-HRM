using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Maps biometric device PINs / user IDs to HRM employees.
/// Prefers <see cref="Employee.FingerprintId"/> when set; otherwise falls back to <see cref="Employee.EmployeeCode"/> aliases.
/// </summary>
public static class BiometricEmployeeResolver
{
    public static Dictionary<string, Employee> BuildLookup(IEnumerable<Employee> employees)
    {
        var dict = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
        foreach (var employee in employees)
        {
            // EmployeeCode first; FingerprintId aliases overwrite so Fingerprint ID wins on conflicts.
            foreach (var alias in GetAliases(employee.EmployeeCode))
                dict[alias] = employee;

            foreach (var alias in GetAliases(employee.FingerprintId))
                dict[alias] = employee;
        }
        return dict;
    }

    public static bool TryResolve(IReadOnlyDictionary<string, Employee> lookup, string deviceUserId, out Employee employee)
    {
        employee = null!;
        var key = deviceUserId?.Trim();
        if (string.IsNullOrEmpty(key))
            return false;

        if (lookup.TryGetValue(key, out employee!))
            return true;

        var trimmedZeros = key.TrimStart('0');
        if (!string.IsNullOrEmpty(trimmedZeros) && lookup.TryGetValue(trimmedZeros, out employee!))
            return true;

        return false;
    }

    /// <summary>Aliases for EmployeeCode and FingerprintId used when loading punches for an employee.</summary>
    public static IReadOnlyList<string> GetMatchAliases(Employee employee)
    {
        var aliases = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var a in GetAliases(employee.EmployeeCode))
            aliases.Add(a);
        foreach (var a in GetAliases(employee.FingerprintId))
            aliases.Add(a);
        return aliases.ToList();
    }

    public static IReadOnlyList<string> GetAliases(string? employeeCode)
    {
        var aliases = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var code = employeeCode?.Trim();
        if (string.IsNullOrEmpty(code))
            return Array.Empty<string>();

        aliases.Add(code);

        var dash = code.LastIndexOf('-');
        if (dash >= 0 && dash < code.Length - 1)
        {
            var suffix = code[(dash + 1)..].Trim();
            if (!string.IsNullOrEmpty(suffix))
            {
                aliases.Add(suffix);
                var noZeros = suffix.TrimStart('0');
                if (!string.IsNullOrEmpty(noZeros))
                    aliases.Add(noZeros);
            }
        }

        var digitsOnly = new string(code.Where(char.IsDigit).ToArray());
        if (!string.IsNullOrEmpty(digitsOnly))
        {
            aliases.Add(digitsOnly);
            var noZeros = digitsOnly.TrimStart('0');
            if (!string.IsNullOrEmpty(noZeros))
                aliases.Add(noZeros);
        }

        return aliases.ToList();
    }

    /// <summary>
    /// Spreadsheet "Employee Code" column: match employee codes first. Fingerprint PINs are used only when they
    /// do not collide with another employee's code or code suffix (e.g. 322 vs EMP-0322).
    /// </summary>
    public static void IndexSpreadsheetLookups<T>(
        IDictionary<string, T> byEmployeeCode,
        IDictionary<string, T> byFingerprint,
        string? employeeCode,
        string? fingerprintId,
        T value)
    {
        foreach (var alias in GetAliases(employeeCode))
            byEmployeeCode.TryAdd(alias, value);
        foreach (var alias in GetAliases(fingerprintId))
        {
            if (byEmployeeCode.ContainsKey(alias))
                continue;
            byFingerprint.TryAdd(alias, value);
        }
    }
}
