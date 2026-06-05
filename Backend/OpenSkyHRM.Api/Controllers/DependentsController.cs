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
[Route("api/employees/{employeeId:guid}/dependents")]
public class DependentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DependentsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        var items = await _db.Dependents
            .Where(d => d.EmployeeId == employeeId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new DependentDto
            {
                Id = d.Id,
                EmployeeId = d.EmployeeId,
                FirstName = d.FirstName,
                LastName = d.LastName,
                Relationship = d.Relationship,
                DateOfBirth = d.DateOfBirth,
                MaritalStatus = d.MaritalStatus,
                Occupation = d.Occupation,
                Organization = d.Organization,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] CreateDependentRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        try
        {
            InputValidators.ValidatePersonName(req.FirstName, "First name");
            InputValidators.ValidatePersonName(req.LastName, "Last name");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var dependent = new Dependent
        {
            EmployeeId = employeeId,
            FirstName = req.FirstName,
            LastName = req.LastName,
            Relationship = req.Relationship,
            DateOfBirth = req.DateOfBirth,
            MaritalStatus = req.MaritalStatus,
            Occupation = req.Occupation,
            Organization = req.Organization,
        };

        _db.Dependents.Add(dependent);
        await _db.SaveChangesAsync();

        return Ok(MapToDto(dependent));
    }

    [HttpPut("{dependentId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid dependentId, [FromBody] CreateDependentRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var dependent = await _db.Dependents
            .FirstOrDefaultAsync(d => d.Id == dependentId && d.EmployeeId == employeeId);

        if (dependent is null) return NotFound();

        try
        {
            InputValidators.ValidatePersonName(req.FirstName, "First name");
            InputValidators.ValidatePersonName(req.LastName, "Last name");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        dependent.FirstName = req.FirstName;
        dependent.LastName = req.LastName;
        dependent.Relationship = req.Relationship;
        dependent.DateOfBirth = req.DateOfBirth;
        dependent.MaritalStatus = req.MaritalStatus;
        dependent.Occupation = req.Occupation;
        dependent.Organization = req.Organization;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(dependent));
    }

    [HttpDelete("{dependentId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid dependentId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var dependent = await _db.Dependents
            .FirstOrDefaultAsync(d => d.Id == dependentId && d.EmployeeId == employeeId);

        if (dependent is null) return NotFound();

        dependent.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static DependentDto MapToDto(Dependent d) => new()
    {
        Id = d.Id,
        EmployeeId = d.EmployeeId,
        FirstName = d.FirstName,
        LastName = d.LastName,
        Relationship = d.Relationship,
        DateOfBirth = d.DateOfBirth,
        MaritalStatus = d.MaritalStatus,
        Occupation = d.Occupation,
        Organization = d.Organization,
    };
}

public class DependentDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    public string? MaritalStatus { get; set; }
    public string? Occupation { get; set; }
    public string? Organization { get; set; }
}

public class CreateDependentRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    public string? MaritalStatus { get; set; }
    public string? Occupation { get; set; }
    public string? Organization { get; set; }
}
