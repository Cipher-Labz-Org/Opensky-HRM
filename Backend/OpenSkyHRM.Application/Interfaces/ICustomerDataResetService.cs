using OpenSkyHRM.Application.Resetting;

namespace OpenSkyHRM.Application.Interfaces;

public record CustomerResetDryRunTableCount(string Table, long Count);

public record CustomerResetDryRunResult(
    IReadOnlyList<CustomerResetDryRunTableCount> Tables,
    bool IncludeHangfire);

public record CustomerResetExecuteResult(
    CustomerResetDryRunResult DryRun,
    bool PurgedHangfire);

public interface ICustomerDataResetService
{
    Task<CustomerResetDryRunResult> DryRunAsync(bool includeHangfire, CancellationToken cancellationToken);

    Task<CustomerResetExecuteResult> ExecuteAsync(
        string providedConfirmPhrase,
        bool allowInProduction,
        bool includeHangfire,
        CancellationToken cancellationToken);
}

