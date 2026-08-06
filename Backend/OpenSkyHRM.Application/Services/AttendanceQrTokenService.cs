using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Issues and validates stable business-unit attendance QR payloads (printable location codes).
/// </summary>
public class AttendanceQrTokenService : IAttendanceQrTokenService
{
    public const string Purpose = "attendance-bu";
    public const string PayloadType = "opensky-hrm-attendance-bu";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly IConfiguration _config;

    public AttendanceQrTokenService(IConfiguration config)
    {
        _config = config;
    }

    public BusinessUnitAttendanceQrDto IssueBusinessUnitQr(Guid businessUnitId, string name, string code)
    {
        var normalizedCode = (code ?? string.Empty).Trim();
        var payloadObj = new BusinessUnitQrPayload
        {
            Type = PayloadType,
            V = 1,
            Purpose = Purpose,
            BusinessUnitId = businessUnitId,
            Code = normalizedCode,
            Sig = ComputeSignature(businessUnitId),
        };

        return new BusinessUnitAttendanceQrDto
        {
            BusinessUnitId = businessUnitId,
            Name = name?.Trim() ?? string.Empty,
            Code = normalizedCode,
            Payload = JsonSerializer.Serialize(payloadObj, JsonOptions),
        };
    }

    public ValidateBusinessUnitAttendanceQrResultDto Validate(string rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
            return Invalid("QR code is empty.");

        var payload = TryParsePayload(rawInput.Trim());
        if (payload is null)
            return Invalid("QR code is not a business unit attendance code.");

        if (!string.Equals(payload.Type, PayloadType, StringComparison.Ordinal)
            && !string.Equals(payload.Purpose, Purpose, StringComparison.Ordinal))
            return Invalid("QR code is not a business unit attendance code.");

        if (payload.BusinessUnitId == Guid.Empty)
            return Invalid("QR code business unit is invalid.");

        var expected = ComputeSignature(payload.BusinessUnitId);
        var provided = (payload.Sig ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(provided)
            || expected.Length != provided.Length
            || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expected),
                Encoding.UTF8.GetBytes(provided)))
        {
            return Invalid("QR code signature is invalid.");
        }

        return new ValidateBusinessUnitAttendanceQrResultDto
        {
            Valid = true,
            Message = "Business unit attendance QR accepted.",
            BusinessUnitId = payload.BusinessUnitId,
            BusinessUnitCode = payload.Code,
        };
    }

    private string ComputeSignature(Guid businessUnitId)
    {
        var key = Encoding.UTF8.GetBytes(ResolveSigningKey());
        var data = Encoding.UTF8.GetBytes($"{businessUnitId:D}|{Purpose}");
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private string ResolveSigningKey() =>
        _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!";

    private static ValidateBusinessUnitAttendanceQrResultDto Invalid(string message) =>
        new() { Valid = false, Message = message };

    private static BusinessUnitQrPayload? TryParsePayload(string raw)
    {
        if (raw.StartsWith("{", StringComparison.Ordinal))
        {
            try
            {
                return JsonSerializer.Deserialize<BusinessUnitQrPayload>(raw, JsonOptions);
            }
            catch
            {
                return null;
            }
        }

        // Deep-link style: openskyhrm://attendance-bu?payload=<urlencoded-json>
        var match = System.Text.RegularExpressions.Regex.Match(
            raw,
            @"[?&]payload=([^&\s]+)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (match.Success)
        {
            try
            {
                var decoded = Uri.UnescapeDataString(match.Groups[1].Value);
                return JsonSerializer.Deserialize<BusinessUnitQrPayload>(decoded, JsonOptions);
            }
            catch
            {
                return null;
            }
        }

        return null;
    }

    private sealed class BusinessUnitQrPayload
    {
        public string Type { get; set; } = string.Empty;
        public int V { get; set; }
        public string Purpose { get; set; } = string.Empty;
        public Guid BusinessUnitId { get; set; }
        public string? Code { get; set; }
        public string? Sig { get; set; }
    }
}
