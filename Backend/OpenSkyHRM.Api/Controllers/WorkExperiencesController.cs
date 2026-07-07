using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
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
                EmploymentType = w.EmploymentType,
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
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        try
        {
            ValidateWorkExperienceRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var item = new WorkExperience
        {
            EmployeeId = employeeId,
            Company = req.Company.Trim(),
            JobTitle = req.JobTitle.Trim(),
            EmploymentType = req.EmploymentType!.Trim(),
            FromDate = req.FromDate,
            ToDate = req.ToDate,
            Creditable = req.Creditable,
            Comment = string.IsNullOrWhiteSpace(req.Comment) ? null : req.Comment.Trim(),
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

        try
        {
            ValidateWorkExperienceRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        item.Company = req.Company.Trim();
        item.JobTitle = req.JobTitle.Trim();
        item.EmploymentType = req.EmploymentType!.Trim();
        item.FromDate = req.FromDate;
        item.ToDate = req.ToDate;
        item.Creditable = req.Creditable;
        item.Comment = string.IsNullOrWhiteSpace(req.Comment) ? null : req.Comment.Trim();
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
        EmploymentType = w.EmploymentType,
        FromDate = w.FromDate,
        ToDate = w.ToDate,
        Creditable = w.Creditable,
        Comment = w.Comment,
    };

    private static void ValidateWorkExperienceRequest(WorkExperienceRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Company))
            throw new InvalidOperationException("Company is required.");
        InputValidators.ValidateAddressText(req.Company, "Company", required: true);

        if (string.IsNullOrWhiteSpace(req.JobTitle))
            throw new InvalidOperationException("Job title is required.");
        InputValidators.ValidateAddressText(req.JobTitle, "Job title", required: true);

        if (string.IsNullOrWhiteSpace(req.EmploymentType))
            throw new InvalidOperationException("Employment type is required.");

        var today = DateTime.UtcNow.Date;
        if (req.FromDate.HasValue && req.FromDate.Value.Date > today)
            throw new InvalidOperationException("Work experience start date cannot be in the future.");
        if (req.ToDate.HasValue && req.ToDate.Value.Date > today)
            throw new InvalidOperationException("Work experience end date cannot be in the future.");
        if (req.FromDate.HasValue && req.ToDate.HasValue && req.ToDate.Value.Date < req.FromDate.Value.Date)
            throw new InvalidOperationException("End date must be on or after the start date.");

        if (!string.IsNullOrWhiteSpace(req.Comment))
            InputValidators.ValidateAddressText(req.Comment, "Comment");
    }
}

public class WorkExperienceDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string? EmploymentType { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool Creditable { get; set; }
    public string? Comment { get; set; }
}

public class WorkExperienceRequest
{
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string? EmploymentType { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool Creditable { get; set; }
    public string? Comment { get; set; }
}
