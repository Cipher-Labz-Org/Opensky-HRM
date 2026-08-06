using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Services;
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
    private readonly IUserNotificationService _notifications;

    public EmployeesController(IEmployeeService employeeService, AppDbContext db, IUserNotificationService notifications)
    {
        _employeeService = employeeService;
        _db = db;
        _notifications = notifications;
    }

    /// <summary>Paged People Hub audit entries (employee profile, related records, compensation). Respects People:Read scope.</summary>
    [HttpGet("audit-trail")]
    public async Task<IActionResult> GetPeopleAuditTrail(
        [FromQuery] Guid? employeeId = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var result = await _employeeService.GetPeopleAuditTrailAsync(employeeId, search, allowedIds, page, pageSize);
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

    [HttpGet("{id:guid}/lifecycle-timeline")]
    public async Task<IActionResult> GetLifecycleTimeline(
        Guid id,
        [FromServices] IEmployeeLifecycleService lifecycleService)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Read"))
            return Forbid();

        return Ok(await lifecycleService.GetTimelineAsync(id));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        // Own profile is always readable for linked accounts (mobile ESS / all roles).
        var ownId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(User, _db);
        IReadOnlyList<Guid>? allowedIds = null;
        if (ownId != id)
            allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");

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

        EmployeeDto created;
        try
        {
            created = await _employeeService.CreateAsync(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return BadRequest(new { message = EmployeeSaveExceptionMapper.Map(ex) });
        }

        if (dto.CreateLogin != null)
        {
            var login = dto.CreateLogin;
            try
            {
                InputValidators.ValidateUsername(login.Username, "Username");
                login.Username = login.Username.Trim();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            if (await _db.Users.AnyAsync(u => u.Username == login.Username))
                return BadRequest(new { message = $"Username '{login.Username}' is already in use (including archived accounts). Choose a different username." });

            var user = new User
            {
                Username = login.Username,
                Email = !string.IsNullOrWhiteSpace(created.Email)
                    ? created.Email
                    : !string.IsNullOrWhiteSpace(created.OtherEmail)
                        ? created.OtherEmail
                        : $"{created.EmployeeCode.Trim().ToLowerInvariant()}@noemail.opensky.hrm",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(login.Password),
                IsActive = login.IsActive,
                EmployeeId = created.Id,
                MustChangePassword = true,
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

        var ownId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(User, _db);
        if (ownId != id)
        {
            var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
            if (allowedIds != null && (allowedIds.Count == 0 || !allowedIds.Contains(id)))
                return Forbid();
        }
        var licenseErr = LicenseDateValidationProblem(dto.LicenseIssueDate, dto.LicenseExpiryDate);
        if (licenseErr != null) return licenseErr;
        try
        {
            var updated = await _employeeService.UpdateAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/terminate")]
    public async Task<IActionResult> Terminate(Guid id, [FromBody] TerminateRequest req,
        [FromServices] IOffboardingService offboardingService,
        [FromServices] IEmployeeTaskService employeeTaskService,
        [FromServices] IEmployeeLifecycleService lifecycleService)
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

        await lifecycleService.RecordSeparationAsync(employee);

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
    public async Task<IActionResult> Reactivate(
        Guid id,
        [FromBody] ReactivateRequest req,
        [FromServices] IEmployeeLifecycleService lifecycleService)
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

        await lifecycleService.RecordReactivatedAsync(employee);

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
        try
        {
            var deleted = await _employeeService.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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

    /// <summary>Atomically replace all supervisor and subordinate reporting lines for an employee.</summary>
    [HttpPost("{id:guid}/reporting-lines")]
    public async Task<IActionResult> SaveReportingLines(Guid id, [FromBody] SaveReportingLinesRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();

        var employee = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

        var supervisors = req.Supervisors ?? new List<ReportingLineSupervisorItem>();
        var subordinates = req.Subordinates ?? new List<ReportingLineSubordinateItem>();

        if (supervisors.GroupBy(s => s.SupervisorId).Any(g => g.Count() > 1))
            return BadRequest(new { error = "Duplicate supervisor in the list." });
        if (subordinates.GroupBy(s => s.EmployeeId).Any(g => g.Count() > 1))
            return BadRequest(new { error = "Duplicate subordinate in the list." });

        var supervisorIds = supervisors.Select(s => s.SupervisorId).ToHashSet();
        foreach (var sub in subordinates)
        {
            if (sub.EmployeeId == id)
                return BadRequest(new { error = "An employee cannot be their own subordinate." });
            if (supervisorIds.Contains(sub.EmployeeId))
                return BadRequest(new { error = "An employee who is assigned as your supervisor cannot be added as your subordinate." });
        }

        foreach (var sup in supervisors)
        {
            if (sup.SupervisorId == id)
                return BadRequest(new { error = "An employee cannot be their own supervisor." });
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, sup.SupervisorId, "Read"))
                return Forbid();

            var supervisor = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == sup.SupervisorId);
            if (supervisor is null)
                return BadRequest(new { error = "Supervisor not found." });
            if (supervisor.IsDeleted || supervisor.Status == "Terminated")
                return BadRequest(new { error = "That employee cannot be assigned as a supervisor." });
            if (string.IsNullOrWhiteSpace(sup.ReportingMethod))
                return BadRequest(new { error = "Reporting method is required for each supervisor." });
        }

        foreach (var sub in subordinates)
        {
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, sub.EmployeeId, "Read"))
                return Forbid();

            var subordinate = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == sub.EmployeeId);
            if (subordinate is null)
                return BadRequest(new { error = "Subordinate employee not found." });
            if (string.IsNullOrWhiteSpace(sub.ReportingMethod))
                return BadRequest(new { error = "Reporting method is required for each subordinate." });
        }

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var existingSupervisorLinks = await _db.EmployeeSupervisors
                .IgnoreQueryFilters()
                .Where(x => x.EmployeeId == id)
                .ToListAsync();

            foreach (var link in existingSupervisorLinks.Where(l => !l.IsDeleted))
            {
                if (!supervisorIds.Contains(link.SupervisorId))
                    link.IsDeleted = true;
            }

            foreach (var item in supervisors)
            {
                var method = item.ReportingMethod.Trim();
                var matches = existingSupervisorLinks.Where(l => l.SupervisorId == item.SupervisorId).ToList();
                var keeper = matches.FirstOrDefault(l => !l.IsDeleted) ?? matches.FirstOrDefault();
                if (keeper is not null)
                {
                    keeper.IsDeleted = false;
                    keeper.ReportingMethod = method;
                    foreach (var extra in matches.Where(l => l.Id != keeper.Id))
                        extra.IsDeleted = true;
                }
                else
                {
                    _db.EmployeeSupervisors.Add(new EmployeeSupervisor
                    {
                        EmployeeId = id,
                        SupervisorId = item.SupervisorId,
                        ReportingMethod = method,
                    });
                }
            }

            var desiredSubordinateIds = subordinates.Select(s => s.EmployeeId).ToHashSet();
            var existingSubordinateLinks = await _db.EmployeeSupervisors
                .IgnoreQueryFilters()
                .Where(x => x.SupervisorId == id)
                .ToListAsync();

            foreach (var link in existingSubordinateLinks.Where(l => !l.IsDeleted))
            {
                if (!desiredSubordinateIds.Contains(link.EmployeeId))
                    link.IsDeleted = true;
            }

            foreach (var item in subordinates)
            {
                var method = item.ReportingMethod.Trim();
                var matches = existingSubordinateLinks.Where(l => l.EmployeeId == item.EmployeeId).ToList();
                var keeper = matches.FirstOrDefault(l => !l.IsDeleted) ?? matches.FirstOrDefault();
                if (keeper is not null)
                {
                    keeper.IsDeleted = false;
                    keeper.ReportingMethod = method;
                    foreach (var extra in matches.Where(l => l.Id != keeper.Id))
                        extra.IsDeleted = true;
                }
                else
                {
                    _db.EmployeeSupervisors.Add(new EmployeeSupervisor
                    {
                        EmployeeId = item.EmployeeId,
                        SupervisorId = id,
                        ReportingMethod = method,
                    });
                }
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        var supervisorRows = await _db.EmployeeSupervisors
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

        var subordinateRows = await _db.EmployeeSupervisors
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

        return Ok(new { supervisors = supervisorRows, subordinates = subordinateRows });
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

    [HttpPut("{id:guid}/supervisors/{entryId:guid}")]
    public async Task<IActionResult> UpdateSupervisor(Guid id, Guid entryId, [FromBody] UpdateReportingMethodRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();
        if (string.IsNullOrWhiteSpace(req.ReportingMethod))
            return BadRequest(new { error = "Reporting method is required." });

        var entry = await _db.EmployeeSupervisors
            .Include(x => x.Supervisor)
            .FirstOrDefaultAsync(x => x.Id == entryId && x.EmployeeId == id);
        if (entry is null) return NotFound();

        entry.ReportingMethod = req.ReportingMethod.Trim();
        await _db.SaveChangesAsync();

        var supervisor = entry.Supervisor;
        return Ok(new
        {
            entry.Id,
            entry.SupervisorId,
            supervisor.EmployeeCode,
            FullName = supervisor.FirstName + (supervisor.MiddleName != null ? " " + supervisor.MiddleName : "") + " " + supervisor.LastName,
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

    [HttpPut("{id:guid}/subordinates/{entryId:guid}")]
    public async Task<IActionResult> UpdateSubordinate(Guid id, Guid entryId, [FromBody] UpdateReportingMethodRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, id, "Update"))
            return Forbid();
        if (string.IsNullOrWhiteSpace(req.ReportingMethod))
            return BadRequest(new { error = "Reporting method is required." });

        var entry = await _db.EmployeeSupervisors
            .Include(x => x.Employee)
            .FirstOrDefaultAsync(x => x.Id == entryId && x.SupervisorId == id);
        if (entry is null) return NotFound();

        entry.ReportingMethod = req.ReportingMethod.Trim();
        await _db.SaveChangesAsync();

        var employee = entry.Employee;
        return Ok(new
        {
            entry.Id,
            entry.EmployeeId,
            employee.EmployeeCode,
            FullName = employee.FirstName + (employee.MiddleName != null ? " " + employee.MiddleName : "") + " " + employee.LastName,
            entry.ReportingMethod,
        });
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

    /// <summary>
    /// Today's birthdays follow People:Read scope. Upcoming lists all active employees company-wide whose
    /// birthday falls in the next 7 calendar days after today (exclusive of today).
    /// </summary>
    [HttpGet("birthdays/summary")]
    public async Task<IActionResult> GetBirthdaySummary(CancellationToken cancellationToken = default)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        if (allowedIds is { Count: 0 })
            return Ok(new BirthdaySummaryResponse([], []));

        var today = DateTime.UtcNow.Date;
        const int upcomingBirthdayHorizonDays = 7;
        var upcomingEnd = today.AddDays(upcomingBirthdayHorizonDays);
        var fromUserId = GetCurrentUserAccountId();
        var wishedTodayIds = await GetWishedTodayEmployeeIdsAsync(fromUserId, cancellationToken);

        var baseQuery = _db.Employees.AsNoTracking()
            .Where(e =>
                e.DateOfBirth.Year > 1900
                && (e.TerminationDate == null || e.TerminationDate.Value.Date >= today));

        var companyEmployees = await baseQuery
            .Select(e => new BirthdaySummaryEmployeeRow(
                e.Id,
                e.FirstName,
                e.MiddleName,
                e.LastName,
                e.Department != null ? e.Department.Name : null,
                e.ProfileImageUrl,
                e.DateOfBirth))
            .ToListAsync(cancellationToken);

        var todayEmployees = allowedIds is null
            ? companyEmployees
            : companyEmployees.Where(e => allowedIds.Contains(e.Id)).ToList();

        var todayList = new List<BirthdayPersonDto>();
        var upcomingList = new List<BirthdayPersonDto>();

        foreach (var emp in todayEmployees)
        {
            if (!EmployeeBirthdayDigestReminderService.IsBirthdayAnniversary(today, emp.DateOfBirth))
                continue;
            todayList.Add(new BirthdayPersonDto(
                emp.Id,
                FormatEmployeeDisplayName(emp),
                emp.DepartmentName,
                emp.ProfileImageUrl,
                DateOnly.FromDateTime(today).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                true,
                0,
                wishedTodayIds.Contains(emp.Id)));
        }

        for (var d = today.AddDays(1); d <= upcomingEnd; d = d.AddDays(1))
        {
            foreach (var emp in companyEmployees)
            {
                if (!EmployeeBirthdayDigestReminderService.IsBirthdayAnniversary(d, emp.DateOfBirth))
                    continue;
                upcomingList.Add(new BirthdayPersonDto(
                    emp.Id,
                    FormatEmployeeDisplayName(emp),
                    emp.DepartmentName,
                    emp.ProfileImageUrl,
                    DateOnly.FromDateTime(d).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    false,
                    (int)(d - today).TotalDays));
            }
        }

        todayList.Sort((a, b) => string.Compare(a.FullName, b.FullName, StringComparison.OrdinalIgnoreCase));
        upcomingList.Sort((a, b) =>
        {
            var c = string.Compare(a.OccasionDate, b.OccasionDate, StringComparison.Ordinal);
            return c != 0 ? c : string.Compare(a.FullName, b.FullName, StringComparison.OrdinalIgnoreCase);
        });

        return Ok(new BirthdaySummaryResponse(todayList, upcomingList));
    }

    /// <summary>Sends an in-app birthday wish to other active user accounts linked to the target employee (never the sender).</summary>
    [HttpPost("birthdays/wish")]
    public async Task<IActionResult> PostBirthdayWish([FromBody] BirthdayWishRequest dto,
        CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, dto.ToEmployeeId))
            return Forbid();

        var fromUserId = GetCurrentUserAccountId();
        if (fromUserId is null)
            return Unauthorized();

        var senderName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == fromUserId.Value)
            .Select(u => u.Employee != null
                ? (string.IsNullOrWhiteSpace(u.Employee.MiddleName)
                    ? (u.Employee.FirstName + " " + u.Employee.LastName).Trim()
                    : (u.Employee.FirstName + " " + u.Employee.MiddleName + " " + u.Employee.LastName).Trim())
                : (u.Username.Trim().Length > 0 ? u.Username.Trim() : "Someone"))
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(senderName))
            return Unauthorized();

        var targetEmployee = await _db.Employees.AsNoTracking()
            .Where(e => e.Id == dto.ToEmployeeId)
            .Select(e => new { e.Email, e.OtherEmail })
            .FirstOrDefaultAsync(cancellationToken);

        var employeeEmails = new List<string>();
        if (!string.IsNullOrWhiteSpace(targetEmployee?.Email))
            employeeEmails.Add(targetEmployee.Email.Trim().ToLowerInvariant());
        if (!string.IsNullOrWhiteSpace(targetEmployee?.OtherEmail))
            employeeEmails.Add(targetEmployee.OtherEmail.Trim().ToLowerInvariant());

        var linkedUserIds = await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && !u.IsDeleted && u.EmployeeId == dto.ToEmployeeId)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        if (employeeEmails.Count > 0)
        {
            var byEmail = await _db.Users.AsNoTracking()
                .Where(u => u.IsActive && !u.IsDeleted && employeeEmails.Contains(u.Email.ToLower()))
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);
            linkedUserIds = linkedUserIds.Concat(byEmail).Distinct().ToList();
        }

        if (linkedUserIds.Count == 0)
            return Ok(new { sent = false, reason = "noLinkedUser", notificationsCreated = 0 });

        var toUserIds = linkedUserIds.Where(id => id != fromUserId.Value).ToList();
        if (toUserIds.Count == 0)
            return Ok(new { sent = false, reason = "noOtherRecipients", notificationsCreated = 0 });

        var msg = (dto.Message ?? "").Trim();
        if (msg.Length == 0)
            return BadRequest(new { message = "Message is required." });
        if (msg.Length > 500)
            msg = msg.Substring(0, 500);

        const string title = "Birthday wishes!";
        var body = $"{senderName} wished you a happy birthday. 🎉{Environment.NewLine}{Environment.NewLine}{msg}";
        const string category = "BirthdayWish";
        var runDate = DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var inserted = 0;

        foreach (var uid in toUserIds)
        {
            var dedupe = $"BD-WISH:{runDate}:{fromUserId.Value:D}:{dto.ToEmployeeId:D}:{uid:D}";
            var dedupeLegacy = $"BD-WISH:{runDate}:{fromUserId.Value}:{dto.ToEmployeeId}:{uid}";
            var existing = await _db.UserNotifications
                .FirstOrDefaultAsync(
                    n => n.UserId == uid && (n.DedupeKey == dedupe || n.DedupeKey == dedupeLegacy),
                    cancellationToken);

            if (existing != null)
            {
                if (existing.ReadAt == null)
                {
                    existing.Title = title;
                    existing.Body = body;
                    existing.SourceUserId = fromUserId.Value;
                    existing.Category = category;
                    await _db.SaveChangesAsync(cancellationToken);
                    inserted++;
                    continue;
                }

                dedupe = $"BD-WISH:{runDate}:{fromUserId.Value:D}:{dto.ToEmployeeId:D}:{uid:D}:{Guid.NewGuid():N}";
            }

            if (await _notifications.TryCreateDedupedAsync(uid, dedupe, title, body, category, null, fromUserId.Value,
                    cancellationToken))
                inserted++;
        }

        if (inserted > 0)
        {
            var toName = await _db.Employees.AsNoTracking()
                .Where(e => e.Id == dto.ToEmployeeId)
                .Select(e => string.IsNullOrWhiteSpace(e.MiddleName)
                    ? (e.FirstName + " " + e.LastName).Trim()
                    : (e.FirstName + " " + e.MiddleName + " " + e.LastName).Trim())
                .FirstOrDefaultAsync(cancellationToken) ?? "your colleague";
            var sentDedupe = $"BD-WISH-SENT:{runDate}:{fromUserId.Value:D}:{dto.ToEmployeeId:D}";
            var existingSent = await _db.UserNotifications
                .FirstOrDefaultAsync(
                    n => n.UserId == fromUserId.Value && n.DedupeKey == sentDedupe,
                    cancellationToken);
            if (existingSent != null)
            {
                if (existingSent.ReadAt == null)
                {
                    existingSent.Title = "Birthday wish sent";
                    existingSent.Body = $"Your birthday wish was delivered to {toName}.";
                    await _db.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    sentDedupe = $"BD-WISH-SENT:{runDate}:{fromUserId.Value:D}:{dto.ToEmployeeId:D}:{Guid.NewGuid():N}";
                    await _notifications.TryCreateDedupedAsync(
                        fromUserId.Value,
                        sentDedupe,
                        "Birthday wish sent",
                        $"Your birthday wish was delivered to {toName}.",
                        "BirthdayWishSent",
                        null,
                        null,
                        cancellationToken);
                }
            }
            else
            {
                await _notifications.TryCreateDedupedAsync(
                    fromUserId.Value,
                    sentDedupe,
                    "Birthday wish sent",
                    $"Your birthday wish was delivered to {toName}.",
                    "BirthdayWishSent",
                    null,
                    null,
                    cancellationToken);
            }
        }

        return Ok(new { sent = inserted > 0, notificationsCreated = inserted });
    }

    private static string FormatEmployeeDisplayName(Employee emp) =>
        string.IsNullOrWhiteSpace(emp.MiddleName)
            ? $"{emp.FirstName} {emp.LastName}".Trim()
            : $"{emp.FirstName} {emp.MiddleName} {emp.LastName}".Trim();

    private static string FormatEmployeeDisplayName(BirthdaySummaryEmployeeRow emp) =>
        string.IsNullOrWhiteSpace(emp.MiddleName)
            ? $"{emp.FirstName} {emp.LastName}".Trim()
            : $"{emp.FirstName} {emp.MiddleName} {emp.LastName}".Trim();

    private sealed record BirthdaySummaryEmployeeRow(
        Guid Id,
        string FirstName,
        string? MiddleName,
        string LastName,
        string? DepartmentName,
        string? ProfileImageUrl,
        DateTime DateOfBirth);

    private Guid? GetCurrentUserAccountId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    private async Task<HashSet<Guid>> GetWishedTodayEmployeeIdsAsync(Guid? fromUserId, CancellationToken cancellationToken)
    {
        var result = new HashSet<Guid>();
        if (!fromUserId.HasValue) return result;

        var runDate = DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var prefix = $"BD-WISH-SENT:{runDate}:{fromUserId.Value:D}:";
        var dedupeKeys = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.UserId == fromUserId.Value
                        && n.Category == "BirthdayWishSent"
                        && n.DedupeKey.StartsWith(prefix))
            .Select(n => n.DedupeKey)
            .ToListAsync(cancellationToken);

        foreach (var key in dedupeKeys)
        {
            // BD-WISH-SENT:{yyyyMMdd}:{senderUserId}:{toEmployeeId}
            var parts = key.Split(':');
            if (parts.Length >= 4 && Guid.TryParse(parts[3], out var toEmployeeId))
                result.Add(toEmployeeId);
        }

        return result;
    }

    private static IActionResult? LicenseDateValidationProblem(DateTime? issue, DateTime? expiry)
    {
        if (issue.HasValue && issue.Value.Date > DateTime.UtcNow.Date)
            return new BadRequestObjectResult(new { message = "License issue date cannot be in the future." });
        if (issue.HasValue && expiry.HasValue && expiry.Value.Date < issue.Value.Date)
            return new BadRequestObjectResult(new { message = "License expiry date must be on or after the issue date." });
        return null;
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

public class UpdateReportingMethodRequest
{
    public string? ReportingMethod { get; set; }
}

public class SaveReportingLinesRequest
{
    public List<ReportingLineSupervisorItem> Supervisors { get; set; } = new();
    public List<ReportingLineSubordinateItem> Subordinates { get; set; } = new();
}

public class ReportingLineSupervisorItem
{
    public Guid SupervisorId { get; set; }
    public string ReportingMethod { get; set; } = "Direct";
}

public class ReportingLineSubordinateItem
{
    public Guid EmployeeId { get; set; }
    public string ReportingMethod { get; set; } = "Direct";
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

public sealed record BirthdayPersonDto(
    Guid EmployeeId,
    string FullName,
    string? DepartmentName,
    string? ProfileImageUrl,
    string OccasionDate,
    bool IsToday,
    int DaysUntil,
    bool AlreadyWished = false);

public sealed record BirthdaySummaryResponse(
    IReadOnlyList<BirthdayPersonDto> Today,
    IReadOnlyList<BirthdayPersonDto> Upcoming);

public sealed class BirthdayWishRequest
{
    public Guid ToEmployeeId { get; set; }
    /// <summary>Personal note appended to the wish notification (required, max 500 characters).</summary>
    public string? Message { get; set; }
}
