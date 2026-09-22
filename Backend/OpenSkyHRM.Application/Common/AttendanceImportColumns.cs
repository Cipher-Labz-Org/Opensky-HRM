namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Maps a manually filled attendance sheet onto the same fields as Log Attendance:
/// employee, date, type, punch in, punch out, remarks.
/// Short headers such as Code / Type / In / Out match only exactly so they cannot steal Date or Name columns.
/// </summary>
public static class AttendanceImportColumns
{
    public const string EmployeeCode = "Employee Code";
    public const string EmployeeName = "Employee Name";
    public const string Date = "Date";
    public const string PunchIn = "Punch In";
    public const string PunchOut = "Punch Out";
    public const string Status = "Type";
    public const string Remarks = "Remarks";

    public static readonly string[] AllowedStatuses =
        ["Present", "Absent", "Late", "Half Day", "On Leave"];

    public static readonly IReadOnlyDictionary<string, string[]> Aliases =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            [EmployeeCode] =
            [
                "Employee Code", "Emp Code", "EmployeeCode", "Employee ID", "Employee No", "Emp No",
                "Employee Number", "Emp Number", "EmpCode", "PIN", "Enroll Number", "Enroll No",
                "User ID", "AC-No", "AC No", "Badge", "Badge ID", "Code",
            ],
            [EmployeeName] =
            [
                "Employee Name", "Emp Name", "Full Name", "Name", "Employee",
            ],
            [Date] =
            [
                "Date", "Attendance Date", "Work Date", "Att Date", "Punch Date", "Workday", "Day",
            ],
            [PunchIn] =
            [
                "Punch In", "PunchIn", "In Time", "Time In", "Check In", "CheckIn",
                "Punch In Time", "Start Time", "Clock In", "ClockIn", "First In", "In",
            ],
            [PunchOut] =
            [
                "Punch Out", "PunchOut", "Out Time", "Time Out", "Check Out", "CheckOut",
                "Punch Out Time", "End Time", "Clock Out", "ClockOut", "Last Out", "Out",
            ],
            [Status] =
            [
                "Type", "Status", "Attendance Status", "Attendance Type", "Att Status",
            ],
            [Remarks] =
            [
                "Remarks", "Notes", "Comment", "Comments", "Note",
            ],
        };

    public static IReadOnlyDictionary<string, int> Resolve(IReadOnlyDictionary<string, int> headerMap)
    {
        var assigned = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var used = new HashSet<int>();
        foreach (var field in new[] { Date, EmployeeCode, PunchIn, PunchOut, Status, EmployeeName, Remarks })
        {
            if (!Aliases.TryGetValue(field, out var aliases))
                continue;
            var match = BestHeader(headerMap, aliases, used);
            if (match is null)
                continue;
            assigned[field] = match.Value;
            used.Add(match.Value);
        }

        return assigned;
    }

    public static int? Column(IReadOnlyDictionary<string, int> resolved, string field) =>
        resolved.TryGetValue(field, out var col) ? col : null;

    public static string? NormalizeStatus(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "Present";

        var compact = new string(raw.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        return compact switch
        {
            "present" or "p" => "Present",
            "absent" or "a" or "abs" => "Absent",
            "late" or "l" => "Late",
            "halfday" or "hd" or "half" => "Half Day",
            "onleave" or "leave" => "On Leave",
            _ => null,
        };
    }

    public static string NormalizeHeader(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "";
        var s = raw.Trim();
        s = s.Replace("\uFEFF", "", StringComparison.Ordinal);
        s = s.Replace("\u00A0", " ", StringComparison.Ordinal);
        s = s.Replace("\u200B", "", StringComparison.Ordinal);
        var chars = s.Select(ch => char.IsLetterOrDigit(ch) ? char.ToLowerInvariant(ch) : ' ').ToArray();
        return string.Join(' ', new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static int? BestHeader(
        IReadOnlyDictionary<string, int> headerMap,
        string[] aliases,
        HashSet<int> used)
    {
        var bestCol = (int?)null;
        var bestScore = 0;
        foreach (var pair in headerMap)
        {
            if (used.Contains(pair.Value))
                continue;
            var score = Score(pair.Key, aliases);
            if (score > bestScore)
            {
                bestScore = score;
                bestCol = pair.Value;
            }
        }

        return bestScore > 0 ? bestCol : null;
    }

    internal static int Score(string header, string[] aliases)
    {
        var headerKey = NormalizeHeader(header);
        if (string.IsNullOrEmpty(headerKey))
            return 0;
        var headerTokens = headerKey.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var best = 0;
        foreach (var alias in aliases)
        {
            var aliasKey = NormalizeHeader(alias);
            if (string.IsNullOrEmpty(aliasKey))
                continue;
            var aliasTokens = aliasKey.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (headerKey == aliasKey)
                return 1000 + aliasKey.Length;

            // One-word short labels (Code, Type, In, Out, Day) must match exactly.
            if (aliasTokens.Length == 1 && aliasKey.Length < 6)
                continue;

            if (aliasTokens.Length > 0 && aliasTokens.All(headerTokens.Contains))
            {
                var extra = headerTokens.Length - aliasTokens.Length;
                var score = 200 + aliasKey.Length - extra * 50;
                if (score > best)
                    best = score;
            }
        }

        return best;
    }
}
