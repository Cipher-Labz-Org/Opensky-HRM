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
[Route("api/employees/{employeeId:guid}/immigrations")]
public class ImmigrationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ImmigrationsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.Immigrations
            .Where(i => i.EmployeeId == employeeId)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new ImmigrationDto
            {
                Id = i.Id,
                EmployeeId = i.EmployeeId,
                DocumentType = i.DocumentType,
                Number = i.Number,
                IssuedBy = i.IssuedBy,
                IssuedDate = i.IssuedDate,
                ExpiryDate = i.ExpiryDate,
                EligibleReviewDate = i.EligibleReviewDate,
                EligibleStatus = i.EligibleStatus,
                Comments = i.Comments,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] ImmigrationRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var imm = new Immigration
        {
            EmployeeId = employeeId,
            DocumentType = req.DocumentType,
            Number = req.Number,
            IssuedBy = req.IssuedBy,
            IssuedDate = req.IssuedDate,
            ExpiryDate = req.ExpiryDate,
            EligibleReviewDate = req.EligibleReviewDate,
            EligibleStatus = req.EligibleStatus,
            Comments = req.Comments,
        };

        _db.Immigrations.Add(imm);
        await _db.SaveChangesAsync();

        return Ok(MapToDto(imm));
    }

    [HttpPut("{immId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid immId, [FromBody] ImmigrationRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var imm = await _db.Immigrations
            .FirstOrDefaultAsync(i => i.Id == immId && i.EmployeeId == employeeId);

        if (imm is null) return NotFound();

        imm.DocumentType = req.DocumentType;
        imm.Number = req.Number;
        imm.IssuedBy = req.IssuedBy;
        imm.IssuedDate = req.IssuedDate;
        imm.ExpiryDate = req.ExpiryDate;
        imm.EligibleReviewDate = req.EligibleReviewDate;
        imm.EligibleStatus = req.EligibleStatus;
        imm.Comments = req.Comments;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(imm));
    }

    [HttpDelete("{immId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid immId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var imm = await _db.Immigrations
            .FirstOrDefaultAsync(i => i.Id == immId && i.EmployeeId == employeeId);

        if (imm is null) return NotFound();

        imm.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static ImmigrationDto MapToDto(Immigration i) => new()
    {
        Id = i.Id,
        EmployeeId = i.EmployeeId,
        DocumentType = i.DocumentType,
        Number = i.Number,
        IssuedBy = i.IssuedBy,
        IssuedDate = i.IssuedDate,
        ExpiryDate = i.ExpiryDate,
        EligibleReviewDate = i.EligibleReviewDate,
        EligibleStatus = i.EligibleStatus,
        Comments = i.Comments,
    };
}

public class ImmigrationDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string? IssuedBy { get; set; }
    public DateTime? IssuedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? EligibleReviewDate { get; set; }
    public string? EligibleStatus { get; set; }
    public string? Comments { get; set; }
}

public class ImmigrationRequest
{
    public string DocumentType { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string? IssuedBy { get; set; }
    public DateTime? IssuedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? EligibleReviewDate { get; set; }
    public string? EligibleStatus { get; set; }
    public string? Comments { get; set; }
}
