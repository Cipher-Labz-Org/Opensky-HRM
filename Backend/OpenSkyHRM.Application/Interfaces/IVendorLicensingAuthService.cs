using OpenSkyHRM.Application.DTOs.Licensing;

namespace OpenSkyHRM.Application.Interfaces;

public interface IVendorLicensingAuthService
{
    Task<VendorLicensingLoginResponseDto> LoginAsync(
        VendorLicensingLoginDto dto,
        string? clientKey,
        CancellationToken cancellationToken = default);
}
