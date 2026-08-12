using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Maps biometric device PINs / user IDs to HRM employees (EmployeeCode and common variants).
/// </summary>
internal static class BiometricEmployeeResolver
{
    public static Dictionary<string, Employee> BuildLookup(IEnumerable<Employee> employees)
    {
        var dict = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
        foreach (var employee in employees)
        {
            foreach (var alias in GetAliases(employee.EmployeeCode))
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
}
