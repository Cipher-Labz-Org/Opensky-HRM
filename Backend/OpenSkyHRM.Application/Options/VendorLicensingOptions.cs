namespace OpenSkyHRM.Application.Options;

/// <summary>
/// OpenSky vendor credentials for the hidden module-access panel (Ctrl+Shift+A).
/// Override with env vars VendorLicensing__Username / VendorLicensing__Password per environment.
/// </summary>
public class VendorLicensingOptions
{
    public const string SectionName = "VendorLicensing";

    public string Username { get; set; } = "Superadmin@gmail.com";

    public string Password { get; set; } = "HRADMIN123@";

    /// <summary>Vendor session length. Default 4 hours.</summary>
    public int TokenExpiresInMinutes { get; set; } = 240;

    public int MaxFailedAttempts { get; set; } = 8;

    public int LockoutMinutes { get; set; } = 10;
}
