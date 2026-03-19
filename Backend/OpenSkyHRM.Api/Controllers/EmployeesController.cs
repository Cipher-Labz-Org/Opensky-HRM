using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Api.Services;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
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

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] Guid? jobTitleId = null,
        [FromQuery] Guid? locationId = null,
        [FromQuery] Guid? managerId = null,
        [FromQuery] string? status = null)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var result = await _employeeService.GetAllAsync(page, pageSize, search, departmentId, jobTitleId, locationId, managerId, status, allowedIds);
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
    public async Task<IActionResult> Create([FromBody] CreateEmployeeDto dto)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Create");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();

        var created = await _employeeService.CreateAsync(dto);

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

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeDto dto)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && (allowedIds.Count == 0 || !allowedIds.Contains(id)))
            return Forbid();
        var updated = await _employeeService.UpdateAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
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
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
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

    [HttpPost("{id:guid}/supervisors")]
    public async Task<IActionResult> AddSupervisor(Guid id, [FromBody] AddSupervisorRequest req)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return NotFound();
        var supervisor = await _db.Employees.FindAsync(req.SupervisorId);
        if (supervisor is null) return BadRequest(new { error = "Supervisor not found." });

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
