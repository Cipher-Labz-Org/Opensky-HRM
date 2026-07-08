using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModuleAny("People", "Employee360")]
[Route("api/employees/{employeeId:guid}/attachments")]
public class EmployeeAttachmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IFileStorageService _files;

    public EmployeeAttachmentsController(AppDbContext db, IFileStorageService files)
    {
        _db = db;
        _files = files;
    }

    private static EmployeeAttachmentDto MapToDto(EmployeeAttachment a) => new()
    {
        Id = a.Id,
        EmployeeId = a.EmployeeId,
        FileName = a.FileName,
        Description = a.Description,
        Size = a.Size,
        ContentType = a.ContentType,
        DateAdded = a.CreatedAt,
        AddedBy = a.AddedBy,
        AttachmentTypeId = a.AttachmentTypeId,
        AttachmentTypeName = a.AttachmentType?.Name,
        ExpiryDate = a.ExpiryDate,
    };

    private static DateTime? ParseExpiryDate(string? expiryDate)
    {
        if (string.IsNullOrWhiteSpace(expiryDate))
            return null;
        return DateOnly.TryParse(expiryDate.Trim(), out var d)
            ? DateTime.SpecifyKind(d.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc)
            : null;
    }

    private static string? FirstFormValue(IFormCollection form, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (form.TryGetValue(key, out var v) && v.Count > 0)
                return v[0];
        }

        return null;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.EmployeeAttachments
            .Include(a => a.AttachmentType)
            .Where(a => a.EmployeeId == employeeId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return Ok(items.Select(MapToDto).ToList());
    }

    [HttpPost]
    [RequestSizeLimit(11 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 11 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid employeeId, CancellationToken cancellationToken)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        IFormCollection form;
        try
        {
            form = await Request.ReadFormAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Invalid multipart upload: {ex.Message}" });
        }

        var file = form.Files.GetFile("file")
            ?? form.Files.GetFile("File");

        if (file is null || file.Length == 0)
        {
            foreach (var f in form.Files)
            {
                if (f.Length > 0)
                {
                    file = f;
                    break;
                }
            }
        }

        var description = FirstFormValue(form, "description", "Description");
        var attachmentTypeIdRaw = FirstFormValue(form, "attachmentTypeId", "AttachmentTypeId");
        var attachmentTypeCodeRaw = FirstFormValue(form, "attachmentTypeCode", "AttachmentTypeCode");
        var attachmentTypeNameRaw = FirstFormValue(form, "attachmentTypeName", "AttachmentTypeName");
        var expiryDate = FirstFormValue(form, "expiryDate", "ExpiryDate");

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "File size must be less than 10 MB." });

        if (string.IsNullOrWhiteSpace(attachmentTypeIdRaw)
            && string.IsNullOrWhiteSpace(attachmentTypeCodeRaw)
            && string.IsNullOrWhiteSpace(attachmentTypeNameRaw))
            return BadRequest(new { error = "Attachment type is required." });

        Guid? resolvedTypeId = null;
        bool? resolvedActive = null;

        if (!string.IsNullOrWhiteSpace(attachmentTypeIdRaw) && Guid.TryParse(attachmentTypeIdRaw.Trim(), out var parsedTypeId))
        {
            var rowById = await _db.EmployeeAttachmentTypes
                .AsNoTracking()
                .Where(t => t.Id == parsedTypeId)
                .Select(t => new { t.Id, t.IsActive })
                .FirstOrDefaultAsync();
            if (rowById is not null)
            {
                resolvedTypeId = rowById.Id;
                resolvedActive = rowById.IsActive;
            }
        }

        if (resolvedTypeId is null && !string.IsNullOrWhiteSpace(attachmentTypeCodeRaw))
        {
            var code = attachmentTypeCodeRaw.Trim();
            var rowByCode = await _db.EmployeeAttachmentTypes
                .AsNoTracking()
                .Where(t => t.Code == code)
                .Select(t => new { t.Id, t.IsActive })
                .FirstOrDefaultAsync();
            if (rowByCode is not null)
            {
                resolvedTypeId = rowByCode.Id;
                resolvedActive = rowByCode.IsActive;
            }
        }

        if (resolvedTypeId is null && !string.IsNullOrWhiteSpace(attachmentTypeNameRaw))
        {
            var name = attachmentTypeNameRaw.Trim();
            var rowByName = await _db.EmployeeAttachmentTypes
                .AsNoTracking()
                .Where(t => t.Name.ToLower() == name.ToLower())
                .Select(t => new { t.Id, t.IsActive })
                .FirstOrDefaultAsync();
            if (rowByName is not null)
            {
                resolvedTypeId = rowByName.Id;
                resolvedActive = rowByName.IsActive;
            }
        }

        if (resolvedTypeId is null)
            return BadRequest(new { error = "Unknown attachment type. Enter a type from the list or type a new one and try again." });

        if (resolvedActive != true)
            return BadRequest(new { error = "This attachment type is inactive. Choose another type or ask an admin to activate it." });

        var typeId = resolvedTypeId.Value;

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storedName = $"{employeeId}_{Guid.NewGuid():N}{ext}";
        var logicalPath = _files.BuildLogicalPath("attachments", storedName);

        await using (var stream = file.OpenReadStream())
        {
            await _files.SaveAsync(logicalPath, stream, file.ContentType ?? "application/octet-stream");
        }

        var attachment = new EmployeeAttachment
        {
            EmployeeId = employeeId,
            FileName = file.FileName,
            StoredFileName = storedName,
            Description = description,
            Size = file.Length,
            ContentType = file.ContentType ?? "application/octet-stream",
            AddedBy = User.Identity?.Name ?? "System",
            AttachmentTypeId = typeId,
            ExpiryDate = ParseExpiryDate(expiryDate)
        };

        _db.EmployeeAttachments.Add(attachment);
        await _db.SaveChangesAsync();

        await _db.Entry(attachment).Reference(a => a.AttachmentType).LoadAsync();

        return Ok(MapToDto(attachment));
    }

    [HttpGet("{attachmentId:guid}/download")]
    public async Task<IActionResult> Download(Guid employeeId, Guid attachmentId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var attachment = await _db.EmployeeAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.EmployeeId == employeeId);

        if (attachment is null) return NotFound();

        var logicalPath = _files.BuildLogicalPath("attachments", attachment.StoredFileName);
        var stored = await _files.OpenReadAsync(logicalPath);
        if (stored is null) return NotFound(new { error = "File not found." });

        return File(stored.Stream, stored.ContentType ?? attachment.ContentType, attachment.FileName);
    }

    [HttpPut("{attachmentId:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid attachmentId, [FromBody] UpdateEmployeeAttachmentRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var attachment = await _db.EmployeeAttachments
            .Include(a => a.AttachmentType)
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.EmployeeId == employeeId);

        if (attachment is null) return NotFound();

        if (req.AttachmentTypeId == Guid.Empty)
            return BadRequest(new { error = "Attachment type is required." });

        var typeOk = await _db.EmployeeAttachmentTypes
            .AsNoTracking()
            .AnyAsync(t => t.Id == req.AttachmentTypeId && t.IsActive);
        if (!typeOk)
            return BadRequest(new { error = "Invalid or inactive attachment type." });

        attachment.Description = req.Description;
        attachment.AttachmentTypeId = req.AttachmentTypeId;
        attachment.ExpiryDate = ParseExpiryDate(req.ExpiryDate);
        await _db.SaveChangesAsync();

        await _db.Entry(attachment).Reference(a => a.AttachmentType).LoadAsync();

        return Ok(MapToDto(attachment));
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
