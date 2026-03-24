using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/{employeeId:guid}/skills")]
public class EmployeeSkillsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmployeeSkillsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.EmployeeSkills
            .Where(s => s.EmployeeId == employeeId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SkillDto
            {
                Id = s.Id,
                EmployeeId = s.EmployeeId,
                Skill = s.Skill,
                YearsOfExperience = s.YearsOfExperience,
                Comments = s.Comments,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] SkillRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var skill = new EmployeeSkill
        {
            EmployeeId = employeeId,
            Skill = req.Skill,
            YearsOfExperience = req.YearsOfExperience,
            Comments = req.Comments,
        };

        _db.EmployeeSkills.Add(skill);
        await _db.SaveChangesAsync();

        return Ok(MapToDto(skill));
    }

    [HttpPut("{skillId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid skillId, [FromBody] SkillRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var skill = await _db.EmployeeSkills
            .FirstOrDefaultAsync(s => s.Id == skillId && s.EmployeeId == employeeId);

        if (skill is null) return NotFound();

        skill.Skill = req.Skill;
        skill.YearsOfExperience = req.YearsOfExperience;
        skill.Comments = req.Comments;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(skill));
    }

    [HttpDelete("{skillId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid skillId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var skill = await _db.EmployeeSkills
            .FirstOrDefaultAsync(s => s.Id == skillId && s.EmployeeId == employeeId);

        if (skill is null) return NotFound();

        skill.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static SkillDto MapToDto(EmployeeSkill s) => new()
    {
        Id = s.Id,
        EmployeeId = s.EmployeeId,
        Skill = s.Skill,
        YearsOfExperience = s.YearsOfExperience,
        Comments = s.Comments,
    };
}

public class SkillDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string Skill { get; set; } = string.Empty;
    public string? YearsOfExperience { get; set; }
    public string? Comments { get; set; }
}

public class SkillRequest
{
    public string Skill { get; set; } = string.Empty;
    public string? YearsOfExperience { get; set; }
    public string? Comments { get; set; }
}
