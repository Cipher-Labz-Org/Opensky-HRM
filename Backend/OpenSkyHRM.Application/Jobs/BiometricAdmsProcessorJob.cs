using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

public class BiometricAdmsProcessorJob
{
    private readonly IBiometricService _biometricService;
    private readonly ILogger<BiometricAdmsProcessorJob> _logger;

    public BiometricAdmsProcessorJob(IBiometricService biometricService, ILogger<BiometricAdmsProcessorJob> logger)
    {
        _biometricService = biometricService;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var result = await _biometricService.ProcessAdmsPunchesToAttendanceAsync(cancellationToken);
        if (result.Processed > 0 || result.SkippedUnmapped > 0 || result.Failed > 0)
        {
            _logger.LogInformation(
                "ADMS punch processing: {Processed} attendance rows, {Skipped} unmapped device users, {Failed} failed",
                result.Processed,
                result.SkippedUnmapped,
                result.Failed);
        }
    }
}
