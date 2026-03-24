using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/{employeeId:guid}/attachments")]
public class EmployeeAttachmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public EmployeeAttachmentsController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.EmployeeAttachments
            .Where(a => a.EmployeeId == employeeId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new EmployeeAttachmentDto
            {
                Id = a.Id,
                EmployeeId = a.EmployeeId,
                FileName = a.FileName,
                Description = a.Description,
                Size = a.Size,
                ContentType = a.ContentType,
                DateAdded = a.CreatedAt,
                AddedBy = a.AddedBy,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Upload(Guid employeeId, IFormFile file, [FromForm] string? description)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "File size must be less than 10 MB." });

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "attachments");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storedName = $"{employeeId}_{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsDir, storedName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var attachment = new EmployeeAttachment
        {
            EmployeeId = employeeId,
            FileName = file.FileName,
            StoredFileName = storedName,
            Description = description,
            Size = file.Length,
            ContentType = file.ContentType,
            AddedBy = "System",
        };

        _db.EmployeeAttachments.Add(attachment);
        await _db.SaveChangesAsync();

        return Ok(new EmployeeAttachmentDto
        {
            Id = attachment.Id,
            EmployeeId = attachment.EmployeeId,
            FileName = attachment.FileName,
            Description = attachment.Description,
            Size = attachment.Size,
            ContentType = attachment.ContentType,
            DateAdded = attachment.CreatedAt,
            AddedBy = attachment.AddedBy,
        });
    }

    [HttpGet("{attachmentId:guid}/download")]
    public async Task<IActionResult> Download(Guid employeeId, Guid attachmentId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var attachment = await _db.EmployeeAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.EmployeeId == employeeId);

        if (attachment is null) return NotFound();

        var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "attachments", attachment.StoredFileName);
        if (!System.IO.File.Exists(filePath)) return NotFound(new { error = "File not found on disk." });

        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(bytes, attachment.ContentType, attachment.FileName);
    }

    [HttpPut("{attachmentId:guid}")]
    public async Task<IActionResult> UpdateDescription(Guid employeeId, Guid attachmentId, [FromBody] UpdateAttachmentRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var attachment = await _db.EmployeeAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.EmployeeId == employeeId);

        if (attachment is null) return NotFound();

        attachment.Description = req.Description;
        await _db.SaveChangesAsync();

        return Ok(new EmployeeAttachmentDto
        {
            Id = attachment.Id,
            EmployeeId = attachment.EmployeeId,
            FileName = attachment.FileName,
            Description = attachment.Description,
            Size = attachment.Size,
            ContentType = attachment.ContentType,
            DateAdded = attachment.CreatedAt,
            AddedBy = attachment.AddedBy,
        });
    }

    [HttpDelete("{attachmentId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid attachmentId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var attachment = await _db.EmployeeAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.EmployeeId == employeeId);

        if (attachment is null) return NotFound();

        attachment.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class UpdateAttachmentRequest
{
    public string? Description { get; set; }
}
