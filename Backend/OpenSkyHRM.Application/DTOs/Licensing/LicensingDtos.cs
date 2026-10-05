namespace OpenSkyHRM.Application.DTOs.Licensing;

public class EffectiveModulesDto
{
    public List<string> Modules { get; set; } = new();
}

/// <summary>Plan snapshot for any authenticated user (billing overview).</summary>
public class LicensingSummaryDto
{
    public string PlanName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public List<string> LicensedModules { get; set; } = new();
    public int? MaxEmployees { get; set; }
}

public class InstanceSubscriptionDto
{
    public Guid Id { get; set; }
    public string InstanceKey { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public DateTime ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public string? Notes { get; set; }
    public int? MaxEmployees { get; set; }
}

public class LicensedModuleAdminDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; }
    /// <summary>Effective enabled flag (required modules are always true).</summary>
    public bool IsEnabled { get; set; }
}

public class LicensingAdminDto
{
    public string CompanyName { get; set; } = string.Empty;
    public InstanceSubscriptionDto Subscription { get; set; } = null!;
    public List<LicensedModuleAdminDto> Modules { get; set; } = new();
}

public class VendorLicensingLoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class VendorLicensingLoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string CompanyName { get; set; } = string.Empty;
}

public class UpdateModuleEntitlementsDto
{
    /// <summary>Module codes for optional modules that should be enabled. Omitted optional modules are turned off.</summary>
    public List<string> EnabledOptionalModuleCodes { get; set; } = new();
}

public class UpdateInstanceSubscriptionDto
{
    public string? Status { get; set; }
    public string? PlanName { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public string? Notes { get; set; }
    public int? MaxEmployees { get; set; }
}

public class SetMultiCompanyFeatureDto
{
    public bool Active { get; set; }
}
