using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Settings")]
[Route("api/[controller]")]
public class DocumentTemplatesController : ControllerBase
{
    private readonly AppDbContext _db;

    public DocumentTemplatesController(AppDbContext db) => _db = db;

    public record TemplateDto(Guid Id, string Name, string TemplateKey, string HtmlContent, bool IsActive);
    public record TemplateListDto(Guid Id, string Name, string TemplateKey, bool IsActive);
    public record UpdateTemplateRequest(string Name, string HtmlContent, bool IsActive);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var templates = await _db.DocumentTemplates
            .OrderBy(t => t.Name)
            .Select(t => new TemplateListDto(t.Id, t.Name, t.TemplateKey, t.IsActive))
            .ToListAsync();
        return Ok(templates);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var t = await _db.DocumentTemplates.FindAsync(id);
        if (t is null) return NotFound();
        return Ok(new TemplateDto(t.Id, t.Name, t.TemplateKey, t.HtmlContent, t.IsActive));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTemplateRequest req)
    {
        var t = await _db.DocumentTemplates.FindAsync(id);
        if (t is null) return NotFound();
        t.Name = req.Name;
        t.HtmlContent = req.HtmlContent;
        t.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new TemplateDto(t.Id, t.Name, t.TemplateKey, t.HtmlContent, t.IsActive));
    }

    [HttpGet("render/{templateKey}/{employeeId:guid}")]
    public async Task<IActionResult> Render(string templateKey, Guid employeeId)
    {
        var template = await _db.DocumentTemplates
            .FirstOrDefaultAsync(t => t.TemplateKey == templateKey && t.IsActive);
        if (template is null) return NotFound("Template not found or inactive.");

        var emp = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.BusinessUnit)
            .Include(e => e.Position)
            .Include(e => e.Location)
            .Include(e => e.Grade)
            .Include(e => e.JobTitle)
            .Include(e => e.Manager)
            .FirstOrDefaultAsync(e => e.Id == employeeId);
        if (emp is null) return NotFound("Employee not found.");

        var today = DateTime.UtcNow;
        var html = template.HtmlContent
            .Replace("{{EmployeeName}}", emp.FullName)
            .Replace("{{FirstName}}", emp.FirstName)
            .Replace("{{MiddleName}}", emp.MiddleName ?? "")
            .Replace("{{LastName}}", emp.LastName)
            .Replace("{{EmployeeCode}}", emp.EmployeeCode)
            .Replace("{{Email}}", emp.Email)
            .Replace("{{Phone}}", emp.Phone ?? "")
            .Replace("{{Department}}", emp.Department?.Name ?? "")
            .Replace("{{JobTitle}}", emp.JobTitle?.Title ?? "")
            .Replace("{{BusinessUnit}}", emp.BusinessUnit?.Name ?? "")
            .Replace("{{Location}}", emp.Location?.Name ?? "")
            .Replace("{{Grade}}", emp.Grade?.Name ?? "")
            .Replace("{{Position}}", emp.Position?.Title ?? "")
            .Replace("{{ManagerName}}", emp.Manager != null ? emp.Manager.FullName : "")
            .Replace("{{JoinDate}}", emp.JoinDate.ToString("MMMM dd, yyyy"))
            .Replace("{{ProbationEndDate}}", emp.ProbationEndDate?.ToString("MMMM dd, yyyy") ?? "N/A")
            .Replace("{{DateOfPermanency}}", emp.DateOfPermanency?.ToString("MMMM dd, yyyy") ?? "N/A")
            .Replace("{{TerminationDate}}", emp.TerminationDate?.ToString("MMMM dd, yyyy") ?? "N/A")
            .Replace("{{Status}}", emp.Status.ToString())
            .Replace("{{DateOfBirth}}", emp.DateOfBirth.ToString("MMMM dd, yyyy"))
            .Replace("{{Gender}}", emp.Gender.ToString())
            .Replace("{{Nationality}}", emp.Nationality ?? "")
            .Replace("{{NationalId}}", emp.NationalId ?? "")
            .Replace("{{Address}}", FormatAddress(emp.AddressStreet1, emp.AddressStreet2, emp.City, emp.StateProvince, emp.Country, emp.ZipPostalCode))
            .Replace("{{CurrentDate}}", today.ToString("MMMM dd, yyyy"))
            .Replace("{{CurrentYear}}", today.Year.ToString())
            .Replace("{{CompanyName}}", "OpenSky HRM");

        return Ok(new { html });
    }

    private static string FormatAddress(params string?[] parts)
    {
        return string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
    }
}
