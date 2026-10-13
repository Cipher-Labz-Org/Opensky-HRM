using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using OpenSkyHRM.Domain;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Reads fingerprint punches out of an ADMS webhook body. Used by live ingest and by
/// the history repair, so both always agree on the stored punch time and dedupe hash.
/// </summary>
internal sealed class AdmsPayloadParser
{
    private readonly IBusinessClock _clock;

    public AdmsPayloadParser(IBusinessClock clock)
    {
        _clock = clock;
    }

    public IEnumerable<ParsedPunch> ParsePunches(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            yield break;

        var trimmed = payload.Trim();
        if (trimmed.Equals("ATTLOG", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("OPERLOG", StringComparison.OrdinalIgnoreCase))
            yield break;

        if (trimmed.StartsWith('{') || trimmed.StartsWith('['))
        {
            foreach (var p in ParseJson(trimmed))
                yield return p;
            yield break;
        }

        foreach (var line in trimmed.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (line.Contains('=') && TryParseKeyValueLine(line, out var kvPunch))
            {
                yield return kvPunch;
                continue;
            }

            var parts = line.Split('\t');
            if (parts.Length < 2) continue;

            var userId = parts[0].Trim();
            if (string.IsNullOrWhiteSpace(userId) || userId.Equals("PIN", StringComparison.OrdinalIgnoreCase))
                continue;
            if (!_clock.TryParseDeviceTimestamp(parts[1].Trim(), out var punchAt))
                continue;

            yield return new ParsedPunch(
                userId,
                punchAt,
                parts.ElementAtOrDefault(2)?.Trim(),
                parts.ElementAtOrDefault(3)?.Trim(),
                parts.ElementAtOrDefault(4)?.Trim());
        }
    }

    public static string ComputeDedupe(Guid deviceId, string userId, DateTime punchAtUtc, string? punchState, string? verifyMode, string? externalLogId)
    {
        var source = $"{deviceId:N}|{userId}|{punchAtUtc:O}|{punchState}|{verifyMode}|{externalLogId}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(source));
        return Convert.ToHexString(bytes);
    }

    public static string? ExtractSerialFromPayload(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return null;

        var trimmed = payload.Trim();
        if (!trimmed.StartsWith('{') && !trimmed.StartsWith('['))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(payload);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    var serial = ReadJson(item, "DeviceID", "deviceId", "device_id", "sn", "SN", "serial", "serialNumber");
                    if (!string.IsNullOrWhiteSpace(serial))
                        return serial;
                }
                return null;
            }

            return ReadJson(doc.RootElement, "DeviceID", "deviceId", "device_id", "sn", "SN", "serial", "serialNumber");
        }
        catch
        {
            return null;
        }
    }

    private bool TryParseKeyValueLine(string line, out ParsedPunch mapped)
    {
        mapped = default;
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var segment in line.Split(new[] { '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = segment.IndexOf('=');
            if (eq <= 0) continue;
            fields[segment[..eq].Trim()] = segment[(eq + 1)..].Trim();
        }

        if (fields.Count == 0) return false;

        var userId = FirstField(fields, "PIN", "UserId", "userid", "user_id", "employeeCode");
        var punchAtText = FirstField(fields, "DateTime", "timestamp", "time", "checkTime", "punchTime");
        if (string.IsNullOrWhiteSpace(userId) || !_clock.TryParseDeviceTimestamp(punchAtText, out var punchAt))
            return false;

        mapped = new ParsedPunch(
            userId,
            punchAt,
            FirstField(fields, "Status", "status", "state", "punchState"),
            FirstField(fields, "Verified", "verify", "verifyMode"),
            FirstField(fields, "WorkCode", "workcode", "id", "logId"));
        return true;
    }

    private static string? FirstField(IReadOnlyDictionary<string, string> fields, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (fields.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val))
                return val;
        }
        return null;
    }

    private IEnumerable<ParsedPunch> ParseJson(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in doc.RootElement.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
            yield break;
        }

        if (TryMapJsonItem(doc.RootElement, out var single))
            yield return single;

        if (doc.RootElement.TryGetProperty("logs", out var logs) && logs.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in logs.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
        }

        if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in data.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
        }
    }

    private bool TryMapJsonItem(JsonElement item, out ParsedPunch mapped)
    {
        mapped = default;
        var userId = ReadJson(item, "EmpId", "empId", "userId", "userid", "user_id", "pin", "PIN", "employeeCode");
        var punchAtText = ReadJson(item, "AttTime", "attTime", "timestamp", "time", "checkTime", "punchTime", "DateTime", "datetime");
        if (string.IsNullOrWhiteSpace(userId) || !_clock.TryParseDeviceTimestamp(punchAtText, out var punchAt))
            return false;

        mapped = new ParsedPunch(
            userId.Trim(),
            punchAt,
            ReadJson(item, "CheckingStatus", "checkingStatus", "punchState", "status", "state"),
            ReadJson(item, "VerifyType", "verifyType", "verifyMode", "verify"),
            ReadJson(item, "id", "logId"));
        return true;
    }

    private static string? ReadJson(JsonElement item, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (item.TryGetProperty(key, out var val))
                return GetJsonScalar(val);

            foreach (var prop in item.EnumerateObject())
            {
                if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                    continue;
                return GetJsonScalar(prop.Value);
            }
        }
        return null;
    }

    private static string? GetJsonScalar(JsonElement val) =>
        val.ValueKind switch
        {
            JsonValueKind.String => val.GetString(),
            JsonValueKind.Number => val.GetRawText(),
            _ => null,
        };

    internal readonly record struct ParsedPunch(
        string UserId,
        DateTime PunchAtUtc,
        string? PunchState,
        string? VerifyMode,
        string? ExternalLogId);
}
