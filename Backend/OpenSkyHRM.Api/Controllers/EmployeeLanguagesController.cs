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
[RequireLicensedModuleAny("People", "Employee360")]
[Route("api/employees/{employeeId:guid}/languages")]
public class EmployeeLanguagesController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmployeeLanguagesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.EmployeeLanguages
            .Where(l => l.EmployeeId == employeeId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LanguageDto
            {
                Id = l.Id,
                EmployeeId = l.EmployeeId,
                Language = l.Language,
                Skill = l.Skill,
                FluencyLevel = l.FluencyLevel,
                Comments = l.Comments,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] LanguageRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var lang = new EmployeeLanguage
        {
            EmployeeId = employeeId,
            Language = req.Language,
            Skill = req.Skill,
            FluencyLevel = req.FluencyLevel,
            Comments = req.Comments,
        };

        _db.EmployeeLanguages.Add(lang);
        await _db.SaveChangesAsync();

        return Ok(MapToDto(lang));
    }

    [HttpPut("{langId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid langId, [FromBody] LanguageRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var lang = await _db.EmployeeLanguages
            .FirstOrDefaultAsync(l => l.Id == langId && l.EmployeeId == employeeId);

        if (lang is null) return NotFound();

        lang.Language = req.Language;
        lang.Skill = req.Skill;
        lang.FluencyLevel = req.FluencyLevel;
        lang.Comments = req.Comments;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(lang));
    }

    [HttpDelete("{langId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid langId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var lang = await _db.EmployeeLanguages
            .FirstOrDefaultAsync(l => l.Id == langId && l.EmployeeId == employeeId);

        if (lang is null) return NotFound();

        lang.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static LanguageDto MapToDto(EmployeeLanguage l) => new()
    {
        Id = l.Id,
        EmployeeId = l.EmployeeId,
        Language = l.Language,
        Skill = l.Skill,
        FluencyLevel = l.FluencyLevel,
        Comments = l.Comments,
    };
}

public class LanguageDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string Language { get; set; } = string.Empty;
    public string Skill { get; set; } = string.Empty;
    public string FluencyLevel { get; set; } = string.Empty;
    public string? Comments { get; set; }
}

public class LanguageRequest
{
    public string Language { get; set; } = string.Empty;
    public string Skill { get; set; } = string.Empty;
    public string FluencyLevel { get; set; } = string.Empty;
    public string? Comments { get; set; }
}
