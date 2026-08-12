using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

/// <summary>
/// Runs daily at 1:00 AM UTC. Refreshes leave balances from active entitlement rules
/// (including Shop &amp; Office Annual / Casual / Sick) — same path as Recalculate balances.
/// Legacy first-year monthly accrual remains in <see cref="LeaveAccrualJob"/>.
/// </summary>
public class LeaveEntitlementRecalculateJob
{
    private readonly ILeaveEntitlementService _entitlementService;
    private readonly ILogger<LeaveEntitlementRecalculateJob> _logger;

    public LeaveEntitlementRecalculateJob(
        ILeaveEntitlementService entitlementService,
        ILogger<LeaveEntitlementRecalculateJob> logger)
    {
        _entitlementService = entitlementService;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var year = DateTime.UtcNow.Year;
        _logger.LogInformation("Running leave entitlement recalculation for year {Year}", year);

        var result = await _entitlementService.RecalculateAllAsync(year);

        _logger.LogInformation(
            "Leave entitlement recalculation complete: {Employees} employees, {Created} balances created, {Updated} balances updated",
            result.EmployeesProcessed,
            result.BalancesCreated,
            result.BalancesUpdated);
    }
}
