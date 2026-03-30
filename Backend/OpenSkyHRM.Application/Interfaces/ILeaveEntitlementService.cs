namespace OpenSkyHRM.Application.Interfaces;

public interface ILeaveEntitlementService
{
    Task<EntitlementResult> CalculateAndApplyAsync(Guid employeeId, int year);
    Task<RecalculateAllResult> RecalculateAllAsync(int year);
    Task<List<EntitlementRuleDto>> GetRulesAsync();
    Task<EntitlementRuleDto> CreateRuleAsync(Guid leaveTypeId, string ruleType, string ruleConfig);
    Task<EntitlementRuleDto?> UpdateRuleAsync(Guid id, string ruleConfig);
    Task<bool> DeleteRuleAsync(Guid id);
    /// <summary>Shop Office-style annual/casual preview; annual leave respects probation/permanency and employment type.</summary>
    Task<ShopOfficeLeaveEntitlementDto?> GetShopOfficeActEntitlementAsync(Guid employeeId, int year);
}

public record EntitlementResult(int BalancesCreated, int BalancesUpdated);
public record RecalculateAllResult(int EmployeesProcessed, int BalancesCreated, int BalancesUpdated);
public record EntitlementRuleDto(Guid Id, Guid LeaveTypeId, string LeaveTypeName, string RuleType, string RuleConfig, bool IsActive);

public record ShopOfficeLeaveEntitlementDto(
    int Year,
    decimal AnnualLeaveEntitlement,
    decimal CasualLeaveEntitlement,
    string BasedOn = "continuous_service");
