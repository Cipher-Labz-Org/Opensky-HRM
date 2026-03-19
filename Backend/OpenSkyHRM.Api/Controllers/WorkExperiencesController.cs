using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/employees/{employeeId:guid}/work-experiences")]
public class WorkExperiencesController : ControllerBase
{
    private readonly AppDbContext _db;

    public WorkExperiencesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.WorkExperiences
            .Where(w => w.EmployeeId == employeeId)
            .OrderByDescending(w => w.FromDate)
            .Select(w => new WorkExperienceDto
            {
                Id = w.Id,
                EmployeeId = w.EmployeeId,
                Company = w.Company,
                JobTitle = w.JobTitle,
                FromDate = w.FromDate,
                ToDate = w.ToDate,
                Creditable = w.Creditable,
                Comment = w.Comment,
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] WorkExperienceRequest req)
    {
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var item = new WorkExperience
        {
            EmployeeId = employeeId,
            Company = req.Company,
            JobTitle = req.JobTitle,
            FromDate = req.FromDate,
            ToDate = req.ToDate,
            Creditable = req.Creditable,
            Comment = req.Comment,
        };

        _db.WorkExperiences.Add(item);
        await _db.SaveChangesAsync();
        return Ok(MapToDto(item));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid id, [FromBody] WorkExperienceRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var item = await _db.WorkExperiences
            .FirstOrDefaultAsync(w => w.Id == id && w.EmployeeId == employeeId);
        if (item is null) return NotFound();

        item.Company = req.Company;
        item.JobTitle = req.JobTitle;
        item.FromDate = req.FromDate;
        item.ToDate = req.ToDate;
        item.Creditable = req.Creditable;
        item.Comment = req.Comment;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var item = await _db.WorkExperiences
            .FirstOrDefaultAsync(w => w.Id == id && w.EmployeeId == employeeId);
        if (item is null) return NotFound();

        item.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static WorkExperienceDto MapToDto(WorkExperience w) => new()
    {
        Id = w.Id,
        EmployeeId = w.EmployeeId,
        Company = w.Company,
        JobTitle = w.JobTitle,
        FromDate = w.FromDate,
        ToDate = w.ToDate,
        Creditable = w.Creditable,
        Comment = w.Comment,
    };
}

public class WorkExperienceDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool Creditable { get; set; }
    public string? Comment { get; set; }
}

public class WorkExperienceRequest
{
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool Creditable { get; set; }
    public string? Comment { get; set; }
}
