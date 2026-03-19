namespace OpenSkyHRM.Application.Interfaces;

public interface ILeaveEntitlementService
{
    Task<EntitlementResult> CalculateAndApplyAsync(Guid employeeId, int year);
    Task<RecalculateAllResult> RecalculateAllAsync(int year);
    Task<List<EntitlementRuleDto>> GetRulesAsync();
    Task<EntitlementRuleDto> CreateRuleAsync(Guid leaveTypeId, string ruleType, string ruleConfig);
    Task<EntitlementRuleDto?> UpdateRuleAsync(Guid id, string ruleConfig);
    Task<bool> DeleteRuleAsync(Guid id);
}

public record EntitlementResult(int BalancesCreated, int BalancesUpdated);
public record RecalculateAllResult(int EmployeesProcessed, int BalancesCreated, int BalancesUpdated);
public record EntitlementRuleDto(Guid Id, Guid LeaveTypeId, string LeaveTypeName, string RuleType, string RuleConfig, bool IsActive);
