using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Learning;
using OpenSkyHRM.Application.DTOs.Performance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class LearningService : ILearningService
{
    private readonly AppDbContext _db;

    public LearningService(AppDbContext db) => _db = db;

    public async Task<List<CourseDto>> GetCoursesAsync(CancellationToken cancellationToken = default)
    {
        return await _db.Courses.AsNoTracking().OrderBy(c => c.Title)
            .Select(c => new CourseDto
            {
                Id = c.Id,
                Title = c.Title,
                Code = c.Code,
                Description = c.Description,
                Provider = c.Provider,
                DurationHours = c.DurationHours,
                Category = c.Category,
                IsMandatory = c.IsMandatory,
                IsActive = c.IsActive,
            }).ToListAsync(cancellationToken);
    }

    public async Task<CourseDto> CreateCourseAsync(CreateCourseRequest request,
        CancellationToken cancellationToken = default)
    {
        var code = request.Code.Trim();
        if (await _db.Courses.AnyAsync(c => c.Code == code, cancellationToken))
            throw new InvalidOperationException($"A course with code '{code}' already exists.");

        var entity = new Course
        {
            Title = request.Title.Trim(),
            Code = code,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Provider = string.IsNullOrWhiteSpace(request.Provider) ? null : request.Provider.Trim(),
            DurationHours = request.DurationHours < 1 ? 1 : request.DurationHours,
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            IsMandatory = request.IsMandatory,
            IsActive = request.IsActive,
        };
        _db.Courses.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return MapCourse(entity);
    }

    public async Task<CourseDto?> UpdateCourseAsync(Guid id, UpdateCourseRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Courses.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null)
            return null;

        var code = request.Code.Trim();
        if (await _db.Courses.AnyAsync(c => c.Code == code && c.Id != id, cancellationToken))
            throw new InvalidOperationException($"A course with code '{code}' already exists.");

        entity.Title = request.Title.Trim();
        entity.Code = code;
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.Provider = string.IsNullOrWhiteSpace(request.Provider) ? null : request.Provider.Trim();
        entity.DurationHours = request.DurationHours < 1 ? 1 : request.DurationHours;
        entity.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        entity.IsMandatory = request.IsMandatory;
        entity.IsActive = request.IsActive;
        await _db.SaveChangesAsync(cancellationToken);
        return MapCourse(entity);
    }

    public async Task<bool> DeleteCourseAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Courses.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null)
            return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<SkillDto>> GetSkillsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.Skills.AsNoTracking().OrderBy(s => s.Name)
            .Select(s => new SkillDto { Id = s.Id, Name = s.Name, Category = s.Category })
            .ToListAsync(cancellationToken);
    }

    public async Task<SkillDto> CreateSkillAsync(CreateSkillRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = request.Name.Trim();
        var entity = new Skill
        {
            Name = name,
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive,
        };
        _db.Skills.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return new SkillDto { Id = entity.Id, Name = entity.Name, Category = entity.Category };
    }

    public async Task<List<SkillMatrixDto>> GetSkillMatrixAsync(IReadOnlyList<Guid>? allowedEmployeeIds,
        Guid? employeeId = null, CancellationToken cancellationToken = default)
    {
        var query = _db.SkillMatrices.AsNoTracking()
            .Include(sm => sm.Employee)
            .Include(sm => sm.Skill)
            .AsQueryable();

        if (employeeId.HasValue)
            query = query.Where(sm => sm.EmployeeId == employeeId.Value);

        if (allowedEmployeeIds is not null)
            query = query.Where(sm => allowedEmployeeIds.Contains(sm.EmployeeId));

        return await query
            .OrderBy(sm => sm.Employee.LastName)
            .ThenBy(sm => sm.Skill.Name)
            .Select(sm => new SkillMatrixDto
            {
                Id = sm.Id,
                EmployeeId = sm.EmployeeId,
                SkillId = sm.SkillId,
                EmployeeName = sm.Employee.FirstName + " " + sm.Employee.LastName,
                SkillName = sm.Skill.Name,
                ProficiencyLevel = sm.ProficiencyLevel,
                AssessedAt = sm.AssessedAt,
                Notes = sm.Notes,
            }).ToListAsync(cancellationToken);
    }

    public async Task<SkillMatrixDto> CreateSkillMatrixEntryAsync(CreateSkillMatrixRequest request,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default)
    {
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(request.EmployeeId))
            throw new UnauthorizedAccessException();

        var skillExists = await _db.Skills.AnyAsync(s => s.Id == request.SkillId, cancellationToken);
        if (!skillExists)
            throw new InvalidOperationException("Skill not found.");

        var empExists = await _db.Employees.AnyAsync(e => e.Id == request.EmployeeId, cancellationToken);
        if (!empExists)
            throw new InvalidOperationException("Employee not found.");

        var duplicate = await _db.SkillMatrices.AnyAsync(
            sm => sm.EmployeeId == request.EmployeeId && sm.SkillId == request.SkillId, cancellationToken);
        if (duplicate)
            throw new InvalidOperationException("This employee already has an entry for that skill.");

        var entity = new SkillMatrix
        {
            EmployeeId = request.EmployeeId,
            SkillId = request.SkillId,
            ProficiencyLevel = request.ProficiencyLevel,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            AssessedAt = request.AssessedAt,
        };
        _db.SkillMatrices.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        await _db.Entry(entity).Reference(sm => sm.Employee).LoadAsync(cancellationToken);
        await _db.Entry(entity).Reference(sm => sm.Skill).LoadAsync(cancellationToken);
        return MapSkillMatrix(entity);
    }

    public async Task<SkillMatrixDto?> UpdateSkillMatrixEntryAsync(Guid id, UpdateSkillMatrixRequest request,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default)
    {
        var entity = await _db.SkillMatrices
            .Include(sm => sm.Employee)
            .Include(sm => sm.Skill)
            .FirstOrDefaultAsync(sm => sm.Id == id, cancellationToken);
        if (entity is null)
            return null;

        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(entity.EmployeeId))
            throw new UnauthorizedAccessException();

        entity.ProficiencyLevel = request.ProficiencyLevel;
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.AssessedAt = request.AssessedAt;
        await _db.SaveChangesAsync(cancellationToken);
        return MapSkillMatrix(entity);
    }

    public async Task<bool> DeleteSkillMatrixEntryAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.SkillMatrices.FirstOrDefaultAsync(sm => sm.Id == id, cancellationToken);
        if (entity is null)
            return false;

        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(entity.EmployeeId))
            throw new UnauthorizedAccessException();

        entity.IsDeleted = true;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static CourseDto MapCourse(Course c) => new()
    {
        Id = c.Id,
        Title = c.Title,
        Code = c.Code,
        Description = c.Description,
        Provider = c.Provider,
        DurationHours = c.DurationHours,
        Category = c.Category,
        IsMandatory = c.IsMandatory,
        IsActive = c.IsActive,
    };

    private static SkillMatrixDto MapSkillMatrix(SkillMatrix sm) => new()
    {
        Id = sm.Id,
        EmployeeId = sm.EmployeeId,
        SkillId = sm.SkillId,
        EmployeeName = sm.Employee.FirstName + " " + sm.Employee.LastName,
        SkillName = sm.Skill.Name,
        ProficiencyLevel = sm.ProficiencyLevel,
        AssessedAt = sm.AssessedAt,
        Notes = sm.Notes,
    };
}
