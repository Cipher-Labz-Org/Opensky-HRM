using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.DTOs.Learning;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class TrainingAssignmentService : ITrainingAssignmentService
{
    private static readonly HashSet<string> OpenStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Assigned", "InProgress",
    };

    private readonly AppDbContext _db;
    private readonly IEmailService _email;
    private readonly ILogger<TrainingAssignmentService> _logger;

    public TrainingAssignmentService(
        AppDbContext db,
        IEmailService email,
        ILogger<TrainingAssignmentService> logger)
    {
        _db = db;
        _email = email;
        _logger = logger;
    }

    public async Task<List<TrainingAssignmentDto>> GetAssignmentsAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds,
        Guid? employeeId = null,
        Guid? courseId = null,
        string? status = null,
        bool? overdueOnly = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.TrainingAssignments.AsNoTracking()
            .Include(a => a.Employee)
            .Include(a => a.Course)
            .AsQueryable();

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);

        if (courseId.HasValue)
            query = query.Where(a => a.CourseId == courseId.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(a => a.Status == status);

        if (allowedEmployeeIds is not null)
            query = query.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        var today = DateTime.UtcNow.Date;
        if (overdueOnly == true)
            query = query.Where(a => a.DueDate != null && a.DueDate < today && OpenStatuses.Contains(a.Status));

        return await query
            .OrderByDescending(a => a.AssignedAt)
            .Select(a => Map(a))
            .ToListAsync(cancellationToken);
    }

    public async Task<TrainingAssignmentDto?> GetByIdAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        var a = await _db.TrainingAssignments.AsNoTracking()
            .Include(x => x.Employee)
            .Include(x => x.Course)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (a is null)
            return null;
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(a.EmployeeId))
            return null;
        return Map(a);
    }

    public async Task<TrainingAssignmentDto> CreateAsync(CreateTrainingAssignmentRequest request,
        Guid? assignedByEmployeeId, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(request.EmployeeId))
            throw new UnauthorizedAccessException();

        await EnsureCanAssignAsync(request.EmployeeId, request.CourseId, cancellationToken);

        var entity = new TrainingAssignment
        {
            EmployeeId = request.EmployeeId,
            CourseId = request.CourseId,
            AssignedByEmployeeId = assignedByEmployeeId,
            AssignedAt = DateTime.UtcNow,
            DueDate = request.DueDate.HasValue
                ? DateTime.SpecifyKind(request.DueDate.Value.Date, DateTimeKind.Utc)
                : null,
            Status = "Assigned",
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        };
        _db.TrainingAssignments.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        await _db.Entry(entity).Reference(e => e.Employee).LoadAsync(cancellationToken);
        await _db.Entry(entity).Reference(e => e.Course).LoadAsync(cancellationToken);

        try
        {
            if (await _email.IsConfiguredAsync())
            {
                var emp = entity.Employee;
                await _email.SendTrainingAssignedAsync(
                    emp.Email,
                    $"{emp.FirstName} {emp.LastName}".Trim(),
                    entity.Course.Title,
                    entity.DueDate);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Training assignment email failed for employee {EmployeeId}", request.EmployeeId);
        }

        return Map(entity);
    }

    public async Task<List<TrainingAssignmentDto>> BulkCreateAsync(BulkCreateTrainingAssignmentRequest request,
        Guid? assignedByEmployeeId, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        var results = new List<TrainingAssignmentDto>();
        foreach (var employeeId in request.EmployeeIds.Distinct())
        {
            var dto = await CreateAsync(
                new CreateTrainingAssignmentRequest
                {
                    EmployeeId = employeeId,
                    CourseId = request.CourseId,
                    DueDate = request.DueDate,
                    Notes = request.Notes,
                },
                assignedByEmployeeId,
                allowedEmployeeIds,
                cancellationToken);
            results.Add(dto);
        }

        return results;
    }

    public async Task<TrainingAssignmentDto?> UpdateAsync(Guid id, UpdateTrainingAssignmentRequest request,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default)
    {
        var entity = await _db.TrainingAssignments
            .Include(a => a.Employee)
            .Include(a => a.Course)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (entity is null)
            return null;

        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(entity.EmployeeId))
            throw new UnauthorizedAccessException();

        entity.Status = request.Status.Trim();
        entity.DueDate = request.DueDate.HasValue
            ? DateTime.SpecifyKind(request.DueDate.Value.Date, DateTimeKind.Utc)
            : null;
        entity.CompletedAt = request.CompletedAt;
        entity.ScorePercent = request.ScorePercent;
        entity.EvidenceUrl = string.IsNullOrWhiteSpace(request.EvidenceUrl) ? null : request.EvidenceUrl.Trim();
        entity.ExternalTranscriptId = string.IsNullOrWhiteSpace(request.ExternalTranscriptId)
            ? null
            : request.ExternalTranscriptId.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.WaiverReason = string.IsNullOrWhiteSpace(request.WaiverReason) ? null : request.WaiverReason.Trim();

        if (string.Equals(entity.Status, "Completed", StringComparison.OrdinalIgnoreCase) && entity.CompletedAt is null)
            entity.CompletedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.TrainingAssignments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (entity is null)
            return false;
        if (allowedEmployeeIds is not null && !allowedEmployeeIds.Contains(entity.EmployeeId))
            throw new UnauthorizedAccessException();
        entity.IsDeleted = true;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<int> SendOverdueRemindersAsync(CancellationToken cancellationToken = default)
    {
        if (!await _email.IsConfiguredAsync())
            return 0;

        var today = DateTime.UtcNow.Date;
        var assignments = await _db.TrainingAssignments
            .Include(a => a.Employee)
            .Include(a => a.Course)
            .Where(a => a.DueDate != null
                        && a.DueDate < today
                        && OpenStatuses.Contains(a.Status))
            .ToListAsync(cancellationToken);

        var sent = 0;
        foreach (var a in assignments)
        {
            if (a.LastDueReminderSentAt is DateTime last && last.Date == today)
                continue;

            try
            {
                await _email.SendTrainingOverdueReminderAsync(
                    a.Employee.Email,
                    $"{a.Employee.FirstName} {a.Employee.LastName}".Trim(),
                    a.Course.Title,
                    a.DueDate!.Value);
                a.LastDueReminderSentAt = DateTime.UtcNow;
                sent++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Overdue training reminder failed for assignment {Id}", a.Id);
            }
        }

        if (sent > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return sent;
    }

    private async Task EnsureCanAssignAsync(Guid employeeId, Guid courseId, CancellationToken cancellationToken)
    {
        var course = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId, cancellationToken);
        if (course is null || !course.IsActive)
            throw new InvalidOperationException("Course not found or inactive.");

        var empExists = await _db.Employees.AnyAsync(e => e.Id == employeeId, cancellationToken);
        if (!empExists)
            throw new InvalidOperationException("Employee not found.");

        var open = await _db.TrainingAssignments.AnyAsync(
            a => a.EmployeeId == employeeId
                 && a.CourseId == courseId
                 && OpenStatuses.Contains(a.Status),
            cancellationToken);
        if (open)
            throw new InvalidOperationException("Employee already has an open assignment for this course.");
    }

    private static TrainingAssignmentDto Map(TrainingAssignment a) => new()
    {
        Id = a.Id,
        EmployeeId = a.EmployeeId,
        EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
        CourseId = a.CourseId,
        CourseTitle = a.Course.Title,
        CourseCode = a.Course.Code,
        AssignedByEmployeeId = a.AssignedByEmployeeId,
        AssignedAt = a.AssignedAt,
        DueDate = a.DueDate,
        Status = a.Status,
        CompletedAt = a.CompletedAt,
        ScorePercent = a.ScorePercent,
        EvidenceUrl = a.EvidenceUrl,
        ExternalTranscriptId = a.ExternalTranscriptId,
        Notes = a.Notes,
        WaiverReason = a.WaiverReason,
    };
}
