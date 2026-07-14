using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;
using System.Text.RegularExpressions;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Settings")]
[Route("api/[controller]")]
public class DocumentTemplatesController : ControllerBase
{
    private readonly AppDbContext _db;

    public DocumentTemplatesController(AppDbContext db) => _db = db;

    public record TemplateDto(Guid Id, string Name, string TemplateKey, string? Subject, string HtmlContent, bool IsActive);
    public record TemplateListDto(Guid Id, string Name, string TemplateKey, bool IsActive);
    public record UpdateTemplateRequest(string Name, string? Subject, string HtmlContent, bool IsActive);
    public record CreateTemplateRequest(string Name, string TemplateKey, string? Subject, string HtmlContent, bool IsActive = true);

    [HttpPost("seed-defaults")]
    public async Task<IActionResult> SeedDefaults()
    {
        await TransactionalEmailTemplateSeeder.EnsureAsync(_db);
        await DocumentTemplateSeeder.EnsureLetterPackAsync(_db);
        await DocumentTemplateSeeder.RefreshLetterPackHtmlAsync(_db);
        var templates = await _db.DocumentTemplates
            .OrderBy(t => t.Name)
            .Select(t => new TemplateListDto(t.Id, t.Name, t.TemplateKey, t.IsActive))
            .ToListAsync();
        return Ok(new { message = "Default templates loaded.", templates });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTemplateRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (string.IsNullOrEmpty(name))
            return BadRequest(new { message = "Template name is required." });

        var key = NormalizeEmailTemplateKey(req.TemplateKey);
        if (string.IsNullOrEmpty(key))
            return BadRequest(new { message = "Template key is required and must start with Email_." });

        if (await _db.DocumentTemplates.AnyAsync(t => t.TemplateKey == key))
            return Conflict(new { message = $"A template with key \"{key}\" already exists." });

        var html = (req.HtmlContent ?? "").Trim();
        if (string.IsNullOrEmpty(html))
            return BadRequest(new { message = "HTML content is required." });

        var template = new DocumentTemplate
        {
            Name = name,
            TemplateKey = key,
            Subject = string.IsNullOrWhiteSpace(req.Subject) ? null : req.Subject.Trim(),
            HtmlContent = html,
            IsActive = req.IsActive,
        };
        _db.DocumentTemplates.Add(template);
        await _db.SaveChangesAsync();
        return Ok(new TemplateDto(template.Id, template.Name, template.TemplateKey, template.Subject, template.HtmlContent, template.IsActive));
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var templates = await _db.DocumentTemplates
            .OrderBy(t => t.Name)
            .Select(t => new TemplateListDto(t.Id, t.Name, t.TemplateKey, t.IsActive))
            .ToListAsync();
        return Ok(templates);
    }

    /// <summary>Literal route segment must stay ahead of {id:guid} so &quot;render&quot; is never parsed as a template id.</summary>
    [HttpGet("render/{templateKey}/{employeeId:guid}")]
    public async Task<IActionResult> Render(string templateKey, Guid employeeId)
    {
        if (templateKey.StartsWith("Email_", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Transactional email templates are not used with employee letter render.");

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

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var t = await _db.DocumentTemplates.FindAsync(id);
        if (t is null) return NotFound();
        return Ok(new TemplateDto(t.Id, t.Name, t.TemplateKey, t.Subject, t.HtmlContent, t.IsActive));
    }

    [HttpPut("{id:guid}")]
    public Task<IActionResult> Put(Guid id, [FromBody] UpdateTemplateRequest req) => UpdateTemplateAsync(id, req);

    /// <summary>Some hosts/proxies block PUT; POST is an alternate save path for the same body.</summary>
    [HttpPost("{id:guid}")]
    public Task<IActionResult> PostUpdate(Guid id, [FromBody] UpdateTemplateRequest req) => UpdateTemplateAsync(id, req);

    private async Task<IActionResult> UpdateTemplateAsync(Guid id, UpdateTemplateRequest req)
    {
        var t = await _db.DocumentTemplates.FindAsync(id);
        if (t is null) return NotFound();
        t.Name = req.Name;
        t.Subject = req.Subject;
        t.HtmlContent = req.HtmlContent;
        t.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new TemplateDto(t.Id, t.Name, t.TemplateKey, t.Subject, t.HtmlContent, t.IsActive));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var t = await _db.DocumentTemplates.FindAsync(id);
        if (t is null || t.IsDeleted) return NotFound();
        t.IsDeleted = true;
        t.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static string FormatAddress(params string?[] parts)
    {
        return string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
    }

    private static string NormalizeEmailTemplateKey(string raw)
    {
        var key = (raw ?? "").Trim();
        if (string.IsNullOrEmpty(key))
            return string.Empty;

        if (!key.StartsWith("Email_", StringComparison.OrdinalIgnoreCase))
            key = "Email_" + key;

        key = Regex.Replace(key, @"[^A-Za-z0-9_]", "_");
        key = Regex.Replace(key, @"_+", "_").Trim('_');
        return key.StartsWith("Email_", StringComparison.OrdinalIgnoreCase) ? key : $"Email_{key}";
    }
}
