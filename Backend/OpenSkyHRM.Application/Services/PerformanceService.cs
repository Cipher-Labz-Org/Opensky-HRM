using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Performance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class PerformanceService : IPerformanceService
{
    private readonly AppDbContext _db;
    public PerformanceService(AppDbContext db) { _db = db; }

    public async Task<PagedResult<GoalDto>> GetGoalsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var query = _db.Goals.Include(g => g.Employee).AsQueryable();
        if (employeeId.HasValue) query = query.Where(g => g.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null) query = query.Where(g => allowedEmployeeIds.Contains(g.EmployeeId));
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(g => g.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(g => new GoalDto
            {
                Id = g.Id, Title = g.Title, Weight = g.Weight, Progress = g.Progress, Status = g.Status,
                DueDate = g.DueDate, EmployeeName = g.Employee.FirstName + " " + g.Employee.LastName, EmployeeId = g.EmployeeId,
            }).ToListAsync();
        return new PagedResult<GoalDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<List<ReviewCycleDto>> GetReviewCyclesAsync()
    {
        return await _db.ReviewCycles.OrderByDescending(r => r.StartDate)
            .Select(r => new ReviewCycleDto
            {
                Id = r.Id, Name = r.Name, CycleType = r.CycleType, StartDate = r.StartDate, EndDate = r.EndDate, Status = r.Status,
            }).ToListAsync();
    }

    public async Task<PagedResult<PerformanceReviewDto>> GetReviewsAsync(int page = 1, int pageSize = 20, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var query = _db.PerformanceReviews.Include(r => r.Employee).Include(r => r.ReviewCycle).AsQueryable();
        if (allowedEmployeeIds != null) query = query.Where(r => allowedEmployeeIds.Contains(r.EmployeeId));
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(r => r.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(r => new PerformanceReviewDto
            {
                Id = r.Id, EmployeeName = r.Employee.FirstName + " " + r.Employee.LastName,
                CycleName = r.ReviewCycle.Name, OverallRating = r.OverallRating, Status = r.Status.ToString(),
            }).ToListAsync();
        return new PagedResult<PerformanceReviewDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }
}
