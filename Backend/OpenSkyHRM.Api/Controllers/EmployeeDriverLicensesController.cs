using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/{employeeId:guid}/driver-licenses")]
public class EmployeeDriverLicensesController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmployeeDriverLicensesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();

        var items = await _db.EmployeeDriverLicenses
            .Where(d => d.EmployeeId == employeeId)
            .OrderByDescending(d => d.ExpiryDate)
            .ThenByDescending(d => d.CreatedAt)
            .Select(d => new DriverLicenseDto
            {
                Id = d.Id,
                EmployeeId = d.EmployeeId,
                Number = d.Number,
                LicenseType = d.LicenseType,
                IssueDate = d.IssueDate,
                ExpiryDate = d.ExpiryDate,
                IssuingCountry = d.IssuingCountry,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] DriverLicenseRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var validationError = ValidateRequest(req);
        if (validationError is not null) return BadRequest(new { message = validationError });

        var item = new EmployeeDriverLicense
        {
            EmployeeId = employeeId,
            Number = req.Number,
            LicenseType = req.LicenseType,
            IssueDate = req.IssueDate,
            ExpiryDate = req.ExpiryDate,
            IssuingCountry = req.IssuingCountry,
        };

        _db.EmployeeDriverLicenses.Add(item);
        await _db.SaveChangesAsync();
        await SyncEmployeeDriverLicenseFieldsAsync(employeeId);

        return Ok(MapToDto(item));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid id, [FromBody] DriverLicenseRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var item = await _db.EmployeeDriverLicenses
            .FirstOrDefaultAsync(d => d.Id == id && d.EmployeeId == employeeId);
        if (item is null) return NotFound();

        var validationError = ValidateRequest(req);
        if (validationError is not null) return BadRequest(new { message = validationError });

        item.Number = req.Number;
        item.LicenseType = req.LicenseType;
        item.IssueDate = req.IssueDate;
        item.ExpiryDate = req.ExpiryDate;
        item.IssuingCountry = req.IssuingCountry;
        await _db.SaveChangesAsync();
        await SyncEmployeeDriverLicenseFieldsAsync(employeeId);

        return Ok(MapToDto(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var item = await _db.EmployeeDriverLicenses
            .FirstOrDefaultAsync(d => d.Id == id && d.EmployeeId == employeeId);
        if (item is null) return NotFound();

        item.IsDeleted = true;
        await _db.SaveChangesAsync();
        await SyncEmployeeDriverLicenseFieldsAsync(employeeId);

        return NoContent();
    }

    private async Task SyncEmployeeDriverLicenseFieldsAsync(Guid employeeId)
    {
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return;

        var primary = await _db.EmployeeDriverLicenses
            .Where(d => d.EmployeeId == employeeId)
            .OrderByDescending(d => d.ExpiryDate)
            .ThenByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync();

        if (primary is null)
        {
            employee.DriversLicenseNumber = null;
            employee.DriversLicenseType = null;
            employee.LicenseIssueDate = null;
            employee.LicenseExpiryDate = null;
            employee.DriversLicenseIssuingCountry = null;
        }
        else
        {
            employee.DriversLicenseNumber = primary.Number;
            employee.DriversLicenseType = primary.LicenseType;
            employee.LicenseIssueDate = primary.IssueDate;
            employee.LicenseExpiryDate = primary.ExpiryDate;
            employee.DriversLicenseIssuingCountry = primary.IssuingCountry;
        }

        await _db.SaveChangesAsync();
    }

    private static string? ValidateRequest(DriverLicenseRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Number))
            return "Driver's license number is required.";
        if (string.IsNullOrWhiteSpace(req.LicenseType))
            return "License type is required.";
        if (req.IssueDate is null)
            return "Issue date is required.";
        if (req.ExpiryDate is null)
            return "Expiry date is required.";
        if (string.IsNullOrWhiteSpace(req.IssuingCountry))
            return "Issuing country is required.";
        if (req.ExpiryDate < req.IssueDate)
            return "Expiry date cannot be before issue date.";
        return null;
    }

    private static DriverLicenseDto MapToDto(EmployeeDriverLicense d) => new()
    {
        Id = d.Id,
        EmployeeId = d.EmployeeId,
        Number = d.Number,
        LicenseType = d.LicenseType,
        IssueDate = d.IssueDate,
        ExpiryDate = d.ExpiryDate,
        IssuingCountry = d.IssuingCountry,
    };
}

public class DriverLicenseDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string? Number { get; set; }
    public string? LicenseType { get; set; }
    public DateTime? IssueDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? IssuingCountry { get; set; }
}

public class DriverLicenseRequest
{
    public string? Number { get; set; }
    public string? LicenseType { get; set; }
    public DateTime? IssueDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? IssuingCountry { get; set; }
}
