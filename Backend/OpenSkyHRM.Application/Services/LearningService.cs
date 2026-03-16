using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Performance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class LearningService : ILearningService
{
    private readonly AppDbContext _db;
    public LearningService(AppDbContext db) { _db = db; }

    public async Task<List<CourseDto>> GetCoursesAsync()
    {
        return await _db.Courses.OrderBy(c => c.Title)
            .Select(c => new CourseDto
            {
                Id = c.Id, Title = c.Title, Code = c.Code, Provider = c.Provider,
                DurationHours = c.DurationHours, Category = c.Category, IsMandatory = c.IsMandatory,
            }).ToListAsync();
    }

    public async Task<List<SkillDto>> GetSkillsAsync()
    {
        return await _db.Skills.OrderBy(s => s.Name)
            .Select(s => new SkillDto { Id = s.Id, Name = s.Name, Category = s.Category })
            .ToListAsync();
    }

    public async Task<List<SkillMatrixDto>> GetSkillMatrixAsync(Guid? employeeId = null)
    {
        var query = _db.SkillMatrices.Include(sm => sm.Employee).Include(sm => sm.Skill).AsQueryable();
        if (employeeId.HasValue) query = query.Where(sm => sm.EmployeeId == employeeId.Value);
        return await query.Select(sm => new SkillMatrixDto
        {
            Id = sm.Id, EmployeeName = sm.Employee.FirstName + " " + sm.Employee.LastName,
            SkillName = sm.Skill.Name, ProficiencyLevel = sm.ProficiencyLevel,
        }).ToListAsync();
    }
}
