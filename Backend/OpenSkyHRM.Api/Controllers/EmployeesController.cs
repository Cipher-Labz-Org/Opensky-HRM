using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/[controller]")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeService _employeeService;
    private readonly AppDbContext _db;

    public EmployeesController(IEmployeeService employeeService, AppDbContext db)
    {
        _employeeService = employeeService;
        _db = db;
    }

    /// <summary>Paged People Hub audit entries (employee profile, related records, compensation). Respects People:Read scope.</summary>
    [HttpGet("audit-trail")]
    public async Task<IActionResult> GetPeopleAuditTrail(
        [FromQuery] Guid? employeeId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var result = await _employeeService.GetPeopleAuditTrailAsync(employeeId, allowedIds, page, pageSize);
        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] Guid? jobTitleId = null,
        [FromQuery] Guid? locationId = null,
        [FromQuery] Guid? managerId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? employmentType = null,
        [FromQuery] bool excludeTerminated = false,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var result = await _employeeService.GetAllAsync(page, pageSize, search, departmentId, jobTitleId, locationId, managerId, status, employmentType, allowedIds, excludeTerminated, sortBy, sortDir);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var employee = await _employeeService.GetByIdAsync(id, allowedIds);
        return employee is null ? NotFound() : Ok(employee);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeDto dto,
        [FromServices] IEmployeeTaskService employeeTaskService)
    {
        if (!await PeopleAccessHelper.MayAssignEmployeeLocationAsync(User, _db, dto.LocationId))
            return Forbid();

        var assignedLocs = await PeopleAccessHelper.GetAssignedLocationIdsAsync(User, _db);
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Create");
        if (assignedLocs == null && allowedIds != null && allowedIds.Count == 0)
            return Forbid();

        var licenseErr = LicenseDateValidationProblem(dto.LicenseIssueDate, dto.LicenseExpiryDate);
        if (licenseErr != null) return licenseErr;

        if (!string.IsNullOrWhiteSpace(dto.Email) &&
            await _db.Employees.AnyAsync(e => e.Email == dto.Email.Trim()))
            return BadRequest(new { message = $"Email '{dto.Email.Trim()}' already exists." });

        if (!string.IsNullOrWhiteSpace(dto.EmployeeCode) &&
            await _db.Employees.AnyAsync(e => e.EmployeeCode == dto.EmployeeCode))
            return BadRequest(new { message = $"Employee code '{dto.EmployeeCode}' already exists." });

        EmployeeDto created;
        try
        {
            created = await _employeeService.CreateAsync(dto);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "IX_Employees_Email"))
        {
            return BadRequest(new { message = $"Email '{dto.Email}' already exists." });
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "IX_Employees_EmployeeCode"))
        {
            return BadRequest(new { message = $"Employee code '{dto.EmployeeCode}' already exists." });
        }

        if (dto.CreateLogin != null)
        {
            var login = dto.CreateLogin;
            if (await _db.Users.AnyAsync(u => u.Username == login.Username && !u.IsDeleted))
                return BadRequest(new { message = $"Username '{login.Username}' already exists." });

            var user = new User
            {
                Username = login.Username,
                Email = created.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(login.Password),
                IsActive = login.IsActive,
                EmployeeId = created.Id
            };

            foreach (var roleId in login.RoleIds)
                user.UserRoles.Add(new UserRole { RoleId = roleId });

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        if (dto.WithOnboarding && dto.OnboardingTemplateId.HasValue)
        {
            await employeeTaskService.CreateTasksFromTemplateAsync(
                created.Id, dto.OnboardingTemplateId.Value, "Onboarding");
        }

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeDto dto)
    {
        if (!await PeopleAccessHelper.MayAssignEmployeeLocationAsync(User, _db, dto.LocationId))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && (allowedIds.Count == 0 || !allowedIds.Contains(id)))
            return Forbid();
        var licenseErr = LicenseDateValidationProblem(dto.LicenseIssueDate, dto.LicenseExpiryDate);
        if (licenseErr != null) return licenseErr;
        var updated = await _employeeService.UpdateAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPost("{id:guid}/terminate")]
    public async Task<IActionResult> Terminate(Guid id, [FromBody] TerminateRequest req,
        [FromServices] IOffboardingService offboardingService,
        [FromServices] IEmployeeTaskService employeeTaskService)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();

        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return NotFound();

        employee.Status = "Terminated";
        employee.TerminationDate = req.TerminationDate;
        employee.TerminationReason = req.TerminationReason;
        employee.TerminationNote = req.TerminationNote;
        await _db.SaveChangesAsync();

        if (req.WithOffboarding && req.TemplateId.HasValue)
        {
            await employeeTaskService.CreateTasksFromTemplateAsync(id, req.TemplateId.Value, "Offboarding");
        }
        else if (req.WithOffboarding)
        {
            await offboardingService.CreateDefaultTasksAsync(id);
        }
        else
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == id);
            if (user is not null)
            {
                user.IsActive = false;
                await _db.SaveChangesAsync();
            }
        }

        var result = await _employeeService.GetByIdAsync(id);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(Guid id, [FromBody] ReactivateRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();

        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return NotFound();

        employee.Status = "Active";
        employee.EmploymentType = "FullTimePermanent";
        employee.TerminationDate = null;
        employee.TerminationReason = null;
        employee.TerminationNote = null;
        if (req.UpdateJoinDate && req.JoinDate.HasValue)
            employee.JoinDate = req.JoinDate.Value;

        // Clean up any remaining offboarding tasks
        var offTasks = _db.OffboardingTasks.Where(t => t.EmployeeId == id);
        _db.OffboardingTasks.RemoveRange(offTasks);

        await _db.SaveChangesAsync();

        // Re-activate user account
        var user = await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == id);
        if (user is not null)
        {
            user.IsActive = true;
            await _db.SaveChangesAsync();
        }

        var result = await _employeeService.GetByIdAsync(id);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Delete");
        if (allowedIds != null && (allowedIds.Count == 0 || !allowedIds.Contains(id)))
            return Forbid();
        var deleted = await _employeeService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/photo")]
    public async Task<IActionResult> UploadPhoto(Guid id, IFormFile file, [FromServices] IWebHostEnvironment env)
    {
        var canUpdate = await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update");
        var isOwnProfile =
            Guid.TryParse(User.FindFirst("employeeId")?.Value, out var ownEmployeeId) &&
            ownEmployeeId == id;
        if (!canUpdate && !isOwnProfile)
            return Forbid();
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, WebP and GIF images are allowed." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { error = "File size must be less than 5 MB." });

        var uploadsDir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "photos");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var fileName = $"{id}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{ext}";

        var filePath = Path.Combine(uploadsDir, fileName);
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var imageUrl = $"/uploads/photos/{fileName}";
        var result = await _employeeService.UpdateProfileImageAsync(id, imageUrl);
        if (result is null) return NotFound();

        return Ok(new { profileImageUrl = imageUrl });
    }

    [HttpGet("{id:guid}/supervisors")]
    public async Task<IActionResult> GetSupervisors(Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Read"))
            return Forbid();
        var rows = await _db.EmployeeSupervisors
            .Where(x => x.EmployeeId == id)
            .Include(x => x.Supervisor)
            .Select(x => new
            {
                x.Id,
                SupervisorId = x.SupervisorId,
                EmployeeCode = x.Supervisor.EmployeeCode,
                FullName = x.Supervisor.FirstName + (x.Supervisor.MiddleName != null ? " " + x.Supervisor.MiddleName : "") + " " + x.Supervisor.LastName,
                x.ReportingMethod,
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpGet("{id:guid}/subordinates")]
    public async Task<IActionResult> GetSubordinates(Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Read"))
            return Forbid();
        var rows = await _db.EmployeeSupervisors
            .Where(x => x.SupervisorId == id)
            .Include(x => x.Employee)
            .Select(x => new
            {
                x.Id,
                EmployeeId = x.EmployeeId,
                EmployeeCode = x.Employee.EmployeeCode,
                FullName = x.Employee.FirstName + (x.Employee.MiddleName != null ? " " + x.Employee.MiddleName : "") + " " + x.Employee.LastName,
                x.ReportingMethod,
            })
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>Employees who may be assigned as supervisors: active non-terminated others in People read scope (same idea as reporting lines elsewhere).</summary>
    [HttpGet("{id:guid}/reporting/supervisor-candidates")]
    public async Task<IActionResult> GetSupervisorCandidates(Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");

        var q = _db.Employees
            .AsNoTracking()
            .Where(e => !e.IsDeleted && e.Status != "Terminated" && e.Id != id);

        if (allowedIds != null)
            q = q.Where(e => allowedIds.Contains(e.Id));

        var items = await q
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .Select(e => new
            {
                id = e.Id,
                fullName = e.FirstName + (e.MiddleName != null ? " " + e.MiddleName : "") + " " + e.LastName,
            })
            .ToListAsync();

        return Ok(new { items });
    }

    [HttpPost("{id:guid}/supervisors")]
    public async Task<IActionResult> AddSupervisor(Guid id, [FromBody] AddSupervisorRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, req.SupervisorId, "Read"))
            return Forbid();

        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return NotFound();
        var supervisor = await _db.Employees.FindAsync(req.SupervisorId);
        if (supervisor is null) return BadRequest(new { error = "Supervisor not found." });
        if (supervisor.IsDeleted || supervisor.Status == "Terminated")
            return BadRequest(new { error = "That employee cannot be assigned as a supervisor." });
        if (id == req.SupervisorId)
            return BadRequest(new { error = "An employee cannot be their own supervisor." });

        var exists = await _db.EmployeeSupervisors.AnyAsync(x => x.EmployeeId == id && x.SupervisorId == req.SupervisorId);
        if (exists) return BadRequest(new { error = "This supervisor is already assigned." });

        var entry = new Domain.Entities.EmployeeSupervisor
        {
            EmployeeId = id,
            SupervisorId = req.SupervisorId,
            ReportingMethod = req.ReportingMethod ?? "Direct",
        };
        _db.EmployeeSupervisors.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            entry.Id,
            entry.SupervisorId,
            supervisor.EmployeeCode,
            FullName = supervisor.FirstName + (supervisor.MiddleName != null ? " " + supervisor.MiddleName : "") + " " + supervisor.LastName,
            entry.ReportingMethod,
        });
    }

    [HttpPost("{id:guid}/subordinates")]
    public async Task<IActionResult> AddSubordinate(Guid id, [FromBody] AddSubordinateRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();
        var supervisor = await _db.Employees.FindAsync(id);
        if (supervisor is null) return NotFound();
        var employee = await _db.Employees.FindAsync(req.EmployeeId);
        if (employee is null) return BadRequest(new { error = "Employee not found." });

        var exists = await _db.EmployeeSupervisors.AnyAsync(x => x.EmployeeId == req.EmployeeId && x.SupervisorId == id);
        if (exists) return BadRequest(new { error = "This subordinate is already assigned." });

        var theyAreMySupervisor = await _db.EmployeeSupervisors
            .AnyAsync(x => x.EmployeeId == id && x.SupervisorId == req.EmployeeId);
        if (theyAreMySupervisor)
            return BadRequest(new { error = "An employee who is assigned as your supervisor cannot be added as your subordinate." });

        var entry = new Domain.Entities.EmployeeSupervisor
        {
            EmployeeId = req.EmployeeId,
            SupervisorId = id,
            ReportingMethod = req.ReportingMethod ?? "Direct",
        };
        _db.EmployeeSupervisors.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            entry.Id,
            entry.EmployeeId,
            employee.EmployeeCode,
            FullName = employee.FirstName + (employee.MiddleName != null ? " " + employee.MiddleName : "") + " " + employee.LastName,
            entry.ReportingMethod,
        });
    }

    [HttpDelete("{id:guid}/supervisors/{entryId:guid}")]
    public async Task<IActionResult> RemoveSupervisor(Guid id, Guid entryId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();
        var entry = await _db.EmployeeSupervisors.FirstOrDefaultAsync(x => x.Id == entryId && x.EmployeeId == id);
        if (entry is null) return NotFound();
        entry.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}/subordinates/{entryId:guid}")]
    public async Task<IActionResult> RemoveSubordinate(Guid id, Guid entryId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();
        var entry = await _db.EmployeeSupervisors.FirstOrDefaultAsync(x => x.Id == entryId && x.SupervisorId == id);
        if (entry is null) return NotFound();
        entry.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static IActionResult? LicenseDateValidationProblem(DateTime? issue, DateTime? expiry)
    {
        if (issue.HasValue && issue.Value.Date > DateTime.UtcNow.Date)
            return new BadRequestObjectResult(new { message = "License issue date cannot be in the future." });
        if (issue.HasValue && expiry.HasValue && expiry.Value.Date < issue.Value.Date)
            return new BadRequestObjectResult(new { message = "License expiry date must be on or after the issue date." });
        return null;
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex, string constraintName)
    {
        return ex.InnerException is PostgresException pg &&
               pg.SqlState == PostgresErrorCodes.UniqueViolation &&
               string.Equals(pg.ConstraintName, constraintName, StringComparison.Ordinal);
    }
}

public class AddSupervisorRequest
{
    public Guid SupervisorId { get; set; }
    public string? ReportingMethod { get; set; }
}

public class AddSubordinateRequest
{
    public Guid EmployeeId { get; set; }
    public string? ReportingMethod { get; set; }
}

public class TerminateRequest
{
    public DateTime TerminationDate { get; set; }
    public string TerminationReason { get; set; } = string.Empty;
    public string? TerminationNote { get; set; }
    public bool WithOffboarding { get; set; }
    public Guid? TemplateId { get; set; }
}

public class ReactivateRequest
{
    public bool UpdateJoinDate { get; set; }
    public DateTime? JoinDate { get; set; }
    public bool WithOnboarding { get; set; }
}
