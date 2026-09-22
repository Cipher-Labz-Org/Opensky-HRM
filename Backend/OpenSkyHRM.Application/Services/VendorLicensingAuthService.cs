using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Options;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class VendorLicensingAuthService : IVendorLicensingAuthService
{
    public const string TokenUseClaim = "token_use";
    public const string TokenUseValue = "vendor_licensing";
    public const string RoleCode = "VENDOR_SUPERADMIN";

    private readonly VendorLicensingOptions _options;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;
    private readonly AppDbContext _db;

    public VendorLicensingAuthService(
        IOptions<VendorLicensingOptions> options,
        IConfiguration config,
        IMemoryCache cache,
        AppDbContext db)
    {
        _options = options.Value;
        _config = config;
        _cache = cache;
        _db = db;
    }

    public async Task<VendorLicensingLoginResponseDto> LoginAsync(
        VendorLicensingLoginDto dto,
        string? clientKey,
        CancellationToken cancellationToken = default)
    {
        var failKey = $"vendor-licensing:fail:{NormalizeClientKey(clientKey)}";
        if (_cache.TryGetValue(failKey, out int failures) && failures >= Math.Max(1, _options.MaxFailedAttempts))
            throw new UnauthorizedAccessException("Too many failed attempts. Try again later.");

        var username = (dto.Username ?? string.Empty).Trim();
        var password = dto.Password ?? string.Empty;
        var expectedUser = (_options.Username ?? string.Empty).Trim();
        var expectedPass = _options.Password ?? string.Empty;

        var userOk = SecretEqualsIgnoreCase(username, expectedUser);
        var passOk = SecretEquals(password, expectedPass);
        if (!userOk || !passOk)
        {
            var next = failures + 1;
            _cache.Set(failKey, next, TimeSpan.FromMinutes(Math.Max(1, _options.LockoutMinutes)));
            throw new UnauthorizedAccessException("Invalid username or password.");
        }

        _cache.Remove(failKey);

        var expiresMinutes = _options.TokenExpiresInMinutes > 0 ? _options.TokenExpiresInMinutes : 240;
        var (token, expiresAt) = GenerateVendorJwt(expiresMinutes);
        var companyName = await _db.SystemSettings
            .AsNoTracking()
            .Where(s => s.Key == "CompanyName")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(cancellationToken);

        return new VendorLicensingLoginResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            CompanyName = (companyName ?? string.Empty).Trim()
        };
    }

    private (string token, DateTime expiresAt) GenerateVendorJwt(int expiresMinutes)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(expiresMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, "vendor-superadmin"),
            new(JwtRegisteredClaimNames.Email, (_options.Username ?? string.Empty).Trim()),
            new("username", (_options.Username ?? string.Empty).Trim()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(TokenUseClaim, TokenUseValue),
            new(ClaimTypes.Role, RoleCode),
            new("role", RoleCode),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "OpenSkyHRM",
            audience: _config["Jwt:Audience"] ?? "OpenSkyHRM",
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private static string NormalizeClientKey(string? clientKey)
    {
        var key = (clientKey ?? string.Empty).Trim();
        return string.IsNullOrEmpty(key) ? "unknown" : key;
    }

    private static bool SecretEquals(string a, string b)
    {
        var left = Encoding.UTF8.GetBytes(a);
        var right = Encoding.UTF8.GetBytes(b);
        if (left.Length != right.Length)
        {
            CryptographicOperations.FixedTimeEquals(left, left);
            return false;
        }
        return CryptographicOperations.FixedTimeEquals(left, right);
    }

    private static bool SecretEqualsIgnoreCase(string a, string b)
        => SecretEquals(a.ToUpperInvariant(), b.ToUpperInvariant());
}
