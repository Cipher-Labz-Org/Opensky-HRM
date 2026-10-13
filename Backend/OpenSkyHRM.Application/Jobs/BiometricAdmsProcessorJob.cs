using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;

namespace OpenSkyHRM.Application.Jobs;

public class BiometricAdmsProcessorJob
{
    private readonly IBiometricService _biometricService;
    private readonly BiometricPunchTimeRepairService _punchTimeRepair;
    private readonly ILogger<BiometricAdmsProcessorJob> _logger;

    public BiometricAdmsProcessorJob(
        IBiometricService biometricService,
        BiometricPunchTimeRepairService punchTimeRepair,
        ILogger<BiometricAdmsProcessorJob> logger)
    {
        _biometricService = biometricService;
        _punchTimeRepair = punchTimeRepair;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var result = await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 100, cancellationToken);

        var repair = await _punchTimeRepair.RunOnceAsync(cancellationToken);
        if (repair is not null)
        {
            _logger.LogInformation(
                "Fingerprint punch time repair: {Scanned} raw events, {Corrected} corrected, {Duplicates} duplicates removed, {Inserted} inserted, {Days} attendance days rebuilt, {Manual} manual days skipped, {NoRaw} punches without raw event",
                repair.RawEventsScanned,
                repair.PunchesCorrected,
                repair.DuplicatesRemoved,
                repair.PunchesInserted,
                repair.AttendanceDaysRebuilt,
                repair.ManualDaysSkipped,
                repair.PunchesWithoutRawEvent);
        }

        var reconciled = await _biometricService.RepairStoredBiometricHoursAsync(cancellationToken);
        if (reconciled > 0)
        {
            _logger.LogInformation(
                "Recalculated biometric attendance hours for {Count} employee-days",
                reconciled);
        }

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
