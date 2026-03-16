using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class OnboardingService : IOnboardingService
{
    private readonly AppDbContext _db;
    public OnboardingService(AppDbContext db) { _db = db; }

    public async Task<List<OnboardingTaskDto>> GetTasksByEmployeeAsync(Guid employeeId)
    {
        return await _db.OnboardingTasks
            .Include(t => t.Employee)
            .Where(t => t.EmployeeId == employeeId)
            .OrderBy(t => t.SortOrder)
            .Select(t => new OnboardingTaskDto
            {
                Id = t.Id, Title = t.Title, Category = t.Category, IsCompleted = t.IsCompleted,
                DueDate = t.DueDate, EmployeeName = t.Employee.FirstName + " " + t.Employee.LastName,
                EmployeeId = t.EmployeeId,
            }).ToListAsync();
    }

    public async Task<OnboardingTaskDto?> CompleteTaskAsync(Guid taskId)
    {
        var task = await _db.OnboardingTasks.Include(t => t.Employee).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return null;
        task.IsCompleted = true;
        task.CompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return new OnboardingTaskDto
        {
            Id = task.Id, Title = task.Title, Category = task.Category, IsCompleted = true,
            DueDate = task.DueDate, EmployeeName = task.Employee.FirstName + " " + task.Employee.LastName,
            EmployeeId = task.EmployeeId,
        };
    }
}
