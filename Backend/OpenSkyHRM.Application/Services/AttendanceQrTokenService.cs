using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Issues and validates stable attendance QR payloads for business units and locations.
/// </summary>
public class AttendanceQrTokenService : IAttendanceQrTokenService
{
    public const string BusinessUnitPurpose = "attendance-bu";
    public const string BusinessUnitPayloadType = "opensky-hrm-attendance-bu";
    public const string LocationPurpose = "attendance-location";
    public const string LocationPayloadType = "opensky-hrm-attendance-location";

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
            Type = BusinessUnitPayloadType,
            V = 1,
            Purpose = BusinessUnitPurpose,
            BusinessUnitId = businessUnitId,
            Code = normalizedCode,
            Sig = ComputeSignature(businessUnitId, BusinessUnitPurpose),
        };

        return new BusinessUnitAttendanceQrDto
        {
            BusinessUnitId = businessUnitId,
            Name = name?.Trim() ?? string.Empty,
            Code = normalizedCode,
            Payload = JsonSerializer.Serialize(payloadObj, JsonOptions),
        };
    }

    public LocationAttendanceQrDto IssueLocationQr(Guid locationId, string name, string code)
    {
        var normalizedCode = (code ?? string.Empty).Trim();
        var payloadObj = new LocationQrPayload
        {
            Type = LocationPayloadType,
            V = 1,
            Purpose = LocationPurpose,
            LocationId = locationId,
            Code = normalizedCode,
            Sig = ComputeSignature(locationId, LocationPurpose),
        };

        return new LocationAttendanceQrDto
        {
            LocationId = locationId,
            Name = name?.Trim() ?? string.Empty,
            Code = normalizedCode,
            Payload = JsonSerializer.Serialize(payloadObj, JsonOptions),
        };
    }

    public ValidateBusinessUnitAttendanceQrResultDto Validate(string rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
            return Invalid("QR code is empty.");

        var trimmed = rawInput.Trim();
        var json = ExtractJson(trimmed);
        if (json is null)
            return Invalid("QR code is not a valid attendance code.");

        if (LooksLikeLocationPayload(json))
        {
            var locationPayload = JsonSerializer.Deserialize<LocationQrPayload>(json, JsonOptions);
            if (locationPayload is not null)
                return ValidateLocationPayload(locationPayload);
        }

        if (LooksLikeBusinessUnitPayload(json))
        {
            var buPayload = JsonSerializer.Deserialize<BusinessUnitQrPayload>(json, JsonOptions);
            if (buPayload is not null)
                return ValidateBusinessUnitPayload(buPayload);
        }

        return Invalid("QR code is not a valid attendance code.");
    }

    private static bool LooksLikeLocationPayload(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("locationId", out var locationId)
                && locationId.ValueKind == JsonValueKind.String
                && Guid.TryParse(locationId.GetString(), out var id)
                && id != Guid.Empty)
            {
                return true;
            }

            if (root.TryGetProperty("type", out var type)
                && string.Equals(type.GetString(), LocationPayloadType, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (root.TryGetProperty("purpose", out var purpose)
                && string.Equals(purpose.GetString(), LocationPurpose, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        catch
        {
            // fall through
        }

        return false;
    }

    private static bool LooksLikeBusinessUnitPayload(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("businessUnitId", out var businessUnitId)
                && businessUnitId.ValueKind == JsonValueKind.String
                && Guid.TryParse(businessUnitId.GetString(), out var id)
                && id != Guid.Empty)
            {
                return true;
            }

            if (root.TryGetProperty("type", out var type)
                && string.Equals(type.GetString(), BusinessUnitPayloadType, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (root.TryGetProperty("purpose", out var purpose)
                && string.Equals(purpose.GetString(), BusinessUnitPurpose, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        catch
        {
            // fall through
        }

        return false;
    }

    private ValidateBusinessUnitAttendanceQrResultDto ValidateBusinessUnitPayload(BusinessUnitQrPayload payload)
    {
        if (!string.Equals(payload.Type, BusinessUnitPayloadType, StringComparison.Ordinal)
            && !string.Equals(payload.Purpose, BusinessUnitPurpose, StringComparison.Ordinal))
            return Invalid("QR code is not a business unit attendance code.");

        if (payload.BusinessUnitId == Guid.Empty)
            return Invalid("QR code business unit is invalid.");

        if (!ValidateSignature(payload.BusinessUnitId, BusinessUnitPurpose, payload.Sig))
            return Invalid("QR code signature is invalid.");

        return new ValidateBusinessUnitAttendanceQrResultDto
        {
            Valid = true,
            Kind = "BusinessUnit",
            Message = "Business unit attendance QR accepted.",
            BusinessUnitId = payload.BusinessUnitId,
            BusinessUnitCode = payload.Code,
        };
    }

    private ValidateBusinessUnitAttendanceQrResultDto ValidateLocationPayload(LocationQrPayload payload)
    {
        if (!string.Equals(payload.Type, LocationPayloadType, StringComparison.Ordinal)
            && !string.Equals(payload.Purpose, LocationPurpose, StringComparison.Ordinal))
            return Invalid("QR code is not a location attendance code.");

        if (payload.LocationId == Guid.Empty)
            return Invalid("QR code location is invalid.");

        if (!ValidateSignature(payload.LocationId, LocationPurpose, payload.Sig))
            return Invalid("QR code signature is invalid.");

        return new ValidateBusinessUnitAttendanceQrResultDto
        {
            Valid = true,
            Kind = "Location",
            Message = "Location attendance QR accepted.",
            LocationId = payload.LocationId,
            LocationCode = payload.Code,
        };
    }

    private bool ValidateSignature(Guid entityId, string purpose, string? providedSig)
    {
        var expected = ComputeSignature(entityId, purpose);
        var provided = (providedSig ?? string.Empty).Trim().ToLowerInvariant();
        return !string.IsNullOrWhiteSpace(provided)
               && expected.Length == provided.Length
               && CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(expected),
                   Encoding.UTF8.GetBytes(provided));
    }

    private string ComputeSignature(Guid entityId, string purpose)
    {
        var key = Encoding.UTF8.GetBytes(ResolveSigningKey());
        var data = Encoding.UTF8.GetBytes($"{entityId:D}|{purpose}");
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private string ResolveSigningKey() =>
        _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!";

    private static ValidateBusinessUnitAttendanceQrResultDto Invalid(string message) =>
        new() { Valid = false, Message = message };

    private static BusinessUnitQrPayload? TryParseBusinessUnitPayload(string raw)
    {
        var json = ExtractJson(raw);
        if (json is null) return null;
        try
        {
            return JsonSerializer.Deserialize<BusinessUnitQrPayload>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static LocationQrPayload? TryParseLocationPayload(string raw)
    {
        var json = ExtractJson(raw);
        if (json is null) return null;
        try
        {
            return JsonSerializer.Deserialize<LocationQrPayload>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static string? ExtractJson(string raw)
    {
        if (raw.StartsWith("{", StringComparison.Ordinal))
            return raw;

        var match = System.Text.RegularExpressions.Regex.Match(
            raw,
            @"[?&]payload=([^&\s]+)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success) return null;

        try
        {
            return Uri.UnescapeDataString(match.Groups[1].Value);
        }
        catch
        {
            return null;
        }
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

    private sealed class LocationQrPayload
    {
        public string Type { get; set; } = string.Empty;
        public int V { get; set; }
        public string Purpose { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? Code { get; set; }
        public string? Sig { get; set; }
    }
}
