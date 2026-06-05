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
[Route("api/employees/{employeeId:guid}/emergency-contacts")]
public class EmergencyContactsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmergencyContactsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.EmergencyContacts
            .Where(e => e.EmployeeId == employeeId)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new EmergencyContactDto
            {
                Id = e.Id,
                EmployeeId = e.EmployeeId,
                Name = e.Name,
                Relationship = e.Relationship,
                HomeTelephone = e.HomeTelephone,
                MobileTelephone = e.MobileTelephone,
                WorkTelephone = e.WorkTelephone,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] CreateEmergencyContactRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        try
        {
            InputValidators.ValidatePersonName(req.Name, "Name");
            InputValidators.ValidatePhone(req.HomeTelephone, "Home telephone", required: false);
            InputValidators.ValidatePhone(req.MobileTelephone, "Mobile telephone", required: false);
            InputValidators.ValidatePhone(req.WorkTelephone, "Work telephone", required: false);
            if (string.IsNullOrWhiteSpace(req.HomeTelephone)
                && string.IsNullOrWhiteSpace(req.MobileTelephone)
                && string.IsNullOrWhiteSpace(req.WorkTelephone))
            {
                throw new InvalidOperationException("At least one valid telephone number is required.");
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var contact = new EmergencyContact
        {
            EmployeeId = employeeId,
            Name = req.Name,
            Relationship = req.Relationship,
            HomeTelephone = req.HomeTelephone,
            MobileTelephone = req.MobileTelephone,
            WorkTelephone = req.WorkTelephone,
        };

        _db.EmergencyContacts.Add(contact);
        await _db.SaveChangesAsync();

        return Ok(new EmergencyContactDto
        {
            Id = contact.Id,
            EmployeeId = contact.EmployeeId,
            Name = contact.Name,
            Relationship = contact.Relationship,
            HomeTelephone = contact.HomeTelephone,
            MobileTelephone = contact.MobileTelephone,
            WorkTelephone = contact.WorkTelephone,
        });
    }

    [HttpPut("{contactId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid contactId, [FromBody] CreateEmergencyContactRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var contact = await _db.EmergencyContacts
            .FirstOrDefaultAsync(e => e.Id == contactId && e.EmployeeId == employeeId);

        if (contact is null) return NotFound();

        try
        {
            InputValidators.ValidatePersonName(req.Name, "Name");
            InputValidators.ValidatePhone(req.HomeTelephone, "Home telephone", required: false);
            InputValidators.ValidatePhone(req.MobileTelephone, "Mobile telephone", required: false);
            InputValidators.ValidatePhone(req.WorkTelephone, "Work telephone", required: false);
            if (string.IsNullOrWhiteSpace(req.HomeTelephone)
                && string.IsNullOrWhiteSpace(req.MobileTelephone)
                && string.IsNullOrWhiteSpace(req.WorkTelephone))
            {
                throw new InvalidOperationException("At least one valid telephone number is required.");
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        contact.Name = req.Name;
        contact.Relationship = req.Relationship;
        contact.HomeTelephone = req.HomeTelephone;
        contact.MobileTelephone = req.MobileTelephone;
        contact.WorkTelephone = req.WorkTelephone;
        await _db.SaveChangesAsync();

        return Ok(new EmergencyContactDto
        {
            Id = contact.Id,
            EmployeeId = contact.EmployeeId,
            Name = contact.Name,
            Relationship = contact.Relationship,
            HomeTelephone = contact.HomeTelephone,
            MobileTelephone = contact.MobileTelephone,
            WorkTelephone = contact.WorkTelephone,
        });
    }

    [HttpDelete("{contactId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid contactId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var contact = await _db.EmergencyContacts
            .FirstOrDefaultAsync(e => e.Id == contactId && e.EmployeeId == employeeId);

        if (contact is null) return NotFound();

        contact.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class EmergencyContactDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string? HomeTelephone { get; set; }
    public string? MobileTelephone { get; set; }
    public string? WorkTelephone { get; set; }
}

public class CreateEmergencyContactRequest
{
    public string Name { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string? HomeTelephone { get; set; }
    public string? MobileTelephone { get; set; }
    public string? WorkTelephone { get; set; }
}
