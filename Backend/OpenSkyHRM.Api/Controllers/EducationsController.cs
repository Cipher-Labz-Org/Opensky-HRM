using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/employees/{employeeId:guid}/educations")]
public class EducationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EducationsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.Educations
            .Where(e => e.EmployeeId == employeeId)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new EducationDto
            {
                Id = e.Id,
                EmployeeId = e.EmployeeId,
                Level = e.Level,
                Institute = e.Institute,
                Major = e.Major,
                Year = e.Year,
                GpaScore = e.GpaScore,
                StartDate = e.StartDate,
                EndDate = e.EndDate,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] EducationRequest req)
    {
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var education = new Education
        {
            EmployeeId = employeeId,
            Level = req.Level,
            Institute = req.Institute,
            Major = req.Major,
            Year = req.Year,
            GpaScore = req.GpaScore,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
        };

        _db.Educations.Add(education);
        await _db.SaveChangesAsync();

        return Ok(MapToDto(education));
    }

    [HttpPut("{educationId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid educationId, [FromBody] EducationRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var education = await _db.Educations
            .FirstOrDefaultAsync(e => e.Id == educationId && e.EmployeeId == employeeId);

        if (education is null) return NotFound();

        education.Level = req.Level;
        education.Institute = req.Institute;
        education.Major = req.Major;
        education.Year = req.Year;
        education.GpaScore = req.GpaScore;
        education.StartDate = req.StartDate;
        education.EndDate = req.EndDate;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(education));
    }

    [HttpDelete("{educationId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid educationId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var education = await _db.Educations
            .FirstOrDefaultAsync(e => e.Id == educationId && e.EmployeeId == employeeId);

        if (education is null) return NotFound();

        education.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static EducationDto MapToDto(Education e) => new()
    {
        Id = e.Id,
        EmployeeId = e.EmployeeId,
        Level = e.Level,
        Institute = e.Institute,
        Major = e.Major,
        Year = e.Year,
        GpaScore = e.GpaScore,
        StartDate = e.StartDate,
        EndDate = e.EndDate,
    };
}

public class EducationDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string Level { get; set; } = string.Empty;
    public string? Institute { get; set; }
    public string? Major { get; set; }
    public string? Year { get; set; }
    public string? GpaScore { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class EducationRequest
{
    public string Level { get; set; } = string.Empty;
    public string? Institute { get; set; }
    public string? Major { get; set; }
    public string? Year { get; set; }
    public string? GpaScore { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
