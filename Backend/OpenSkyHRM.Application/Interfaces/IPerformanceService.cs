using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Performance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IPerformanceService
{
    Task<PagedResult<GoalDto>> GetGoalsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<List<ReviewCycleDto>> GetReviewCyclesAsync();
    Task<PagedResult<PerformanceReviewDto>> GetReviewsAsync(int page = 1, int pageSize = 20, IReadOnlyList<Guid>? allowedEmployeeIds = null);
}
