using OpenSkyHRM.Application.DTOs.Auth;
using OpenSkyHRM.Application.DTOs.Licensing;

namespace OpenSkyHRM.Application.Interfaces;

public interface ILicensingService
{
    Task<IReadOnlyList<string>> GetEffectiveModuleCodesAsync(CancellationToken cancellationToken = default);

    Task<LicensingSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);

    Task<bool> IsModuleLicensedAsync(string moduleCode, CancellationToken cancellationToken = default);

    /// <summary>Modules that are both in the catalog and currently licensed (for role permission assignment).</summary>
    Task<List<AvailableModuleDto>> GetLicensedModulesForRoleAssignmentAsync(CancellationToken cancellationToken = default);

    Task<LicensingAdminDto> GetAdminStateAsync(CancellationToken cancellationToken = default);

    Task UpdateEntitlementsAsync(UpdateModuleEntitlementsDto dto, CancellationToken cancellationToken = default);

    Task<InstanceSubscriptionDto> UpdateSubscriptionAsync(UpdateInstanceSubscriptionDto dto, CancellationToken cancellationToken = default);

    void InvalidateCache();
}
