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
[Route("api/employees/{employeeId:guid}/immigration-documents")]
public class ImmigrationDocumentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public ImmigrationDocumentsController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.ImmigrationDocuments
            .Where(d => d.EmployeeId == employeeId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new ImmDocDto
            {
                Id = d.Id,
                EmployeeId = d.EmployeeId,
                FileName = d.FileName,
                Description = d.Description,
                Size = d.Size,
                ContentType = d.ContentType,
                DateAdded = d.CreatedAt,
                AddedBy = d.AddedBy,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Upload(Guid employeeId, IFormFile file, [FromForm] string? description)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { error = "File size must be less than 5 MB." });

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "immigration");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storedName = $"{employeeId}_{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsDir, storedName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var doc = new ImmigrationDocument
        {
            EmployeeId = employeeId,
            FileName = file.FileName,
            StoredFileName = storedName,
            Description = description,
            Size = file.Length,
            ContentType = file.ContentType,
            AddedBy = "System",
        };

        _db.ImmigrationDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return Ok(new ImmDocDto
        {
            Id = doc.Id,
            EmployeeId = doc.EmployeeId,
            FileName = doc.FileName,
            Description = doc.Description,
            Size = doc.Size,
            ContentType = doc.ContentType,
            DateAdded = doc.CreatedAt,
            AddedBy = doc.AddedBy,
        });
    }

    [HttpGet("{docId:guid}/download")]
    public async Task<IActionResult> Download(Guid employeeId, Guid docId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var doc = await _db.ImmigrationDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.EmployeeId == employeeId);

        if (doc is null) return NotFound();

        var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "immigration", doc.StoredFileName);
        if (!System.IO.File.Exists(filePath)) return NotFound(new { error = "File not found on disk." });

        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(bytes, doc.ContentType, doc.FileName);
    }

    [HttpDelete("{docId:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid docId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var doc = await _db.ImmigrationDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.EmployeeId == employeeId);

        if (doc is null) return NotFound();

        doc.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class ImmDocDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long Size { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public DateTime DateAdded { get; set; }
    public string? AddedBy { get; set; }
}
