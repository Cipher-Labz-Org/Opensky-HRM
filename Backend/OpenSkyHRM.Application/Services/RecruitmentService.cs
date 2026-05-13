using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class RecruitmentService : IRecruitmentService
{
    private readonly AppDbContext _db;
    private readonly ISystemSettingService _settings;
    private readonly IEmailService _email;
    private readonly ILogger<RecruitmentService> _logger;
    private readonly IHostEnvironment _hostEnv;
    private readonly IConfiguration _configuration;

    public RecruitmentService(
        AppDbContext db,
        ISystemSettingService settings,
        IEmailService email,
        ILogger<RecruitmentService> logger,
        IHostEnvironment hostEnv,
        IConfiguration configuration)
    {
        _db = db;
        _settings = settings;
        _email = email;
        _logger = logger;
        _hostEnv = hostEnv;
        _configuration = configuration;
    }

    private bool ResumeFileExists(Guid candidateId)
    {
        var path = Path.Combine(_hostEnv.ContentRootPath, "wwwroot", "uploads", "candidates", candidateId.ToString(), "resume.pdf");
        return File.Exists(path);
    }

    // ── Requisitions ─────────────────────────────────────────────

    public async Task<PagedResult<RequisitionDto>> GetRequisitionsAsync(
        int page = 1, int pageSize = 20, string? status = null, Guid? departmentId = null, string? priority = null)
    {
        var query = _db.Requisitions
            .Include(r => r.Department)
            .Include(r => r.JobTitle)
            .Include(r => r.HiringManager)
            .Include(r => r.Location)
            .Include(r => r.Position)
            .Include(r => r.Candidates)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ApprovalStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);
        if (departmentId.HasValue)
            query = query.Where(r => r.DepartmentId == departmentId.Value);
        if (!string.IsNullOrWhiteSpace(priority))
            query = query.Where(r => r.Priority == priority);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(r => MapRequisition(r))
            .ToListAsync();

        return new PagedResult<RequisitionDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<RequisitionDto?> GetRequisitionByIdAsync(Guid id)
    {
        var r = await _db.Requisitions
            .Include(x => x.Department).Include(x => x.JobTitle)
            .Include(x => x.HiringManager).Include(x => x.Location)
            .Include(x => x.Position).Include(x => x.Candidates)
            .FirstOrDefaultAsync(x => x.Id == id);
        return r == null ? null : MapRequisition(r);
    }

    public async Task<bool> RequisitionAcceptsPublicApplicationsAsync(Guid id)
    {
        var row = await _db.Requisitions.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new { x.ClosedAt, x.Status })
            .FirstOrDefaultAsync();
        if (row == null) return false;
        if (row.ClosedAt.HasValue) return false;
        return row.Status == ApprovalStatus.Approved || row.Status == ApprovalStatus.PendingLevel2;
    }

    public async Task<(PublicRequisitionDto? dto, string? denyCode)> TryGetPublicJobPostingAsync(Guid id)
    {
        var r = await _db.Requisitions
            .Include(x => x.Department).Include(x => x.JobTitle)
            .Include(x => x.HiringManager).Include(x => x.Location)
            .Include(x => x.Position)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return (null, "not_found");
        if (r.ClosedAt.HasValue) return (null, "closed");
        if (r.Status != ApprovalStatus.Approved && r.Status != ApprovalStatus.PendingLevel2)
            return (null, "not_published");
        return (MapPublicRequisition(r), null);
    }

    public async Task<RequisitionDto> CreateRequisitionAsync(CreateRequisitionDto dto)
    {
        var req = new Requisition
        {
            Title = dto.Title, Code = dto.Code, Description = dto.Description, Vacancies = dto.Vacancies,
            Status = ApprovalStatus.Pending,
            TargetDate = dto.TargetDate, Priority = dto.Priority, EmploymentType = dto.EmploymentType,
            ExperienceMin = dto.ExperienceMin, ExperienceMax = dto.ExperienceMax,
            SalaryMin = dto.SalaryMin, SalaryMax = dto.SalaryMax, Skills = dto.Skills,
            DepartmentId = dto.DepartmentId, JobTitleId = dto.JobTitleId,
            HiringManagerId = dto.HiringManagerId, LocationId = dto.LocationId, PositionId = dto.PositionId,
            ApplicationNotificationEmail = string.IsNullOrWhiteSpace(dto.ApplicationNotificationEmail)
                ? null
                : dto.ApplicationNotificationEmail.Trim(),
        };
        _db.Requisitions.Add(req);
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(req.Id))!;
    }

    public async Task<RequisitionDto> UpdateRequisitionAsync(UpdateRequisitionDto dto)
    {
        var req = await _db.Requisitions.FindAsync(dto.Id)
            ?? throw new InvalidOperationException("Requisition not found");
        req.Title = dto.Title; req.Code = dto.Code; req.Description = dto.Description;
        req.Vacancies = dto.Vacancies; req.TargetDate = dto.TargetDate; req.Priority = dto.Priority;
        req.EmploymentType = dto.EmploymentType; req.ExperienceMin = dto.ExperienceMin;
        req.ExperienceMax = dto.ExperienceMax; req.SalaryMin = dto.SalaryMin; req.SalaryMax = dto.SalaryMax;
        req.Skills = dto.Skills; req.DepartmentId = dto.DepartmentId; req.JobTitleId = dto.JobTitleId;
        req.HiringManagerId = dto.HiringManagerId; req.LocationId = dto.LocationId; req.PositionId = dto.PositionId;
        req.ApplicationNotificationEmail = string.IsNullOrWhiteSpace(dto.ApplicationNotificationEmail)
            ? null
            : dto.ApplicationNotificationEmail.Trim();
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(req.Id))!;
    }

    public async Task DeleteRequisitionAsync(Guid id)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        req.IsDeleted = true;
        await _db.SaveChangesAsync();
    }

    public async Task<RequisitionDto> ApproveRequisitionAsync(Guid id)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        if (req.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending requisitions can be approved.");
        req.Status = ApprovalStatus.Approved;
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    public async Task<RequisitionDto> RejectRequisitionAsync(Guid id, string? remarks = null)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        if (req.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending requisitions can be rejected.");
        _ = remarks;
        req.Status = ApprovalStatus.Rejected;
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    public async Task<RequisitionDto> CloseRequisitionAsync(Guid id)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        if (req.Status != ApprovalStatus.Approved)
            throw new InvalidOperationException("Only approved requisitions can be closed.");
        if (req.ClosedAt.HasValue)
            throw new InvalidOperationException("Requisition is already closed.");
        req.ClosedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    public async Task<RequisitionDto> SaveRequisitionProfileAsync(Guid id, SaveRequisitionProfileDto dto)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        req.RoleTimelineJson = JsonSerializer.Serialize(dto.Timeline ?? new List<RequisitionTimelineEntryDto>());
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    public async Task<RequisitionDto> SetSupportingPdfAsync(Guid id, string storedFileName, string originalFileName)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        req.SupportingPdfStoredFileName = storedFileName;
        req.SupportingPdfOriginalFileName = originalFileName;
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    public async Task<RequisitionDto> DeleteSupportingPdfAsync(Guid id)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        req.SupportingPdfStoredFileName = null;
        req.SupportingPdfOriginalFileName = null;
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    // ── Candidates ───────────────────────────────────────────────

    public async Task<PagedResult<CandidateDto>> GetCandidatesAsync(
        int page = 1, int pageSize = 50, Guid? requisitionId = null, string? stage = null, string? search = null)
    {
        var query = _db.Candidates.Include(c => c.Requisition).AsQueryable();

        if (requisitionId.HasValue)
            query = query.Where(c => c.RequisitionId == requisitionId.Value);
        if (!string.IsNullOrWhiteSpace(stage))
            query = query.Where(c => c.Stage == stage);
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c =>
                c.FirstName.Contains(search) || c.LastName.Contains(search) || c.Email.Contains(search));

        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        var items = rows.Select(MapCandidate).ToList();

        return new PagedResult<CandidateDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<CandidateDetailDto?> GetCandidateByIdAsync(Guid id)
    {
        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .Include(x => x.Interviews).ThenInclude(i => i.Interviewer)
            .Include(x => x.Interviews).ThenInclude(i => i.Scorecards)
            .Include(x => x.Offer)
            .Include(x => x.Activities)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (c == null) return null;

        var m = MapCandidate(c);
        return new CandidateDetailDto
        {
            Id = m.Id, FirstName = m.FirstName, LastName = m.LastName, FullName = m.FullName,
            Email = m.Email, Phone = m.Phone, ResumeUrl = m.ResumeUrl, Source = m.Source, Stage = m.Stage,
            AppliedAt = m.AppliedAt, CurrentTitle = m.CurrentTitle, CurrentCompany = m.CurrentCompany,
            ExpectedSalary = m.ExpectedSalary, NoticePeriod = m.NoticePeriod, Notes = m.Notes,
            Rating = m.Rating, RejectionReason = m.RejectionReason, Tags = m.Tags,
            RequisitionId = m.RequisitionId, RequisitionTitle = m.RequisitionTitle,
            EmployeeId = m.EmployeeId,
            HasUploadedResume = m.HasUploadedResume,
            Interviews = c.Interviews.OrderByDescending(i => i.ScheduledAt).Select(i => MapInterview(i)).ToList(),
            Offer = c.Offer != null ? MapOffer(c.Offer) : null,
            Activities = c.Activities.OrderByDescending(a => a.PerformedAt)
                .Select(a => new CandidateActivityDto
                {
                    Id = a.Id, ActivityType = a.ActivityType, Description = a.Description,
                    PerformedBy = a.PerformedBy, PerformedAt = a.PerformedAt,
                }).ToList(),
        };
    }

    public async Task<CandidateDto> CreateCandidateAsync(CreateCandidateDto dto)
    {
        var candidate = new Candidate
        {
            FirstName = dto.FirstName, LastName = dto.LastName, Email = dto.Email,
            Phone = dto.Phone, ResumeUrl = dto.ResumeUrl, Source = dto.Source,
            RequisitionId = dto.RequisitionId, CurrentTitle = dto.CurrentTitle,
            CurrentCompany = dto.CurrentCompany, ExpectedSalary = dto.ExpectedSalary,
            NoticePeriod = dto.NoticePeriod, Notes = dto.Notes, Tags = dto.Tags,
            AppliedAt = DateTime.UtcNow,
        };
        _db.Candidates.Add(candidate);

        LogActivity(candidate.Id, "StageChange", $"Candidate created in Sourced stage");

        await _db.SaveChangesAsync();
        return (await GetCandidatesAsync(1, 1, dto.RequisitionId)).Items.First();
    }

    public async Task<JobApplicationEmailNotificationResultDto> NotifyJobApplicationSubmittedAsync(Guid candidateId)
    {
        if (!await _email.IsConfiguredAsync())
        {
            const string msg =
                "Email provider is not configured. Set SendGrid:ApiKey (recommended) or Smtp:Host in appsettings, user secrets, or environment variables (e.g. SendGrid__ApiKey).";
            _logger.LogWarning(
                "New application (candidate {CandidateId}) saved but {Msg}",
                candidateId, msg);
            return new JobApplicationEmailNotificationResultDto
            {
                Status = "skipped_no_email_provider",
                Message = msg,
            };
        }

        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == candidateId);
        if (c is null)
            return new JobApplicationEmailNotificationResultDto { Status = "failed", Message = "Candidate not found." };

        var notifyEmail = c.Requisition?.ApplicationNotificationEmail?.Trim();
        if (string.IsNullOrWhiteSpace(notifyEmail))
            notifyEmail = _configuration["Recruitment:ApplicationNotificationEmail"]?.Trim();
        if (string.IsNullOrWhiteSpace(notifyEmail))
            notifyEmail = (await _settings.GetAsync("Recruitment_ApplicationNotificationEmail"))?.Trim();

        if (string.IsNullOrWhiteSpace(notifyEmail))
        {
            const string msg =
                "No recruitment inbox address. Set \"Application notification email\" on the requisition (edit requisition), or set Recruitment:ApplicationNotificationEmail / system setting Recruitment_ApplicationNotificationEmail.";
            _logger.LogWarning(
                "New application (candidate {CandidateId}) saved but {Msg}",
                candidateId, msg);
            return new JobApplicationEmailNotificationResultDto { Status = "skipped_no_inbox", Message = msg };
        }

        var reqTitle = c.Requisition?.Title?.Trim() ?? "Position";
        var reqCode = c.Requisition?.Code?.Trim() ?? "—";
        var resumeUploaded = ResumeFileExists(candidateId);

        try
        {
            var name = $"{c.FirstName} {c.LastName}".Trim();
            if (string.IsNullOrWhiteSpace(name)) name = c.Email;

            await _email.SendJobApplicationNotificationToInboxAsync(
                notifyEmail,
                name,
                c.Email,
                c.Phone,
                reqTitle,
                reqCode,
                candidateId,
                resumeUploaded);

            _logger.LogInformation("Application notification email sent for candidate {CandidateId} to {Inbox}", candidateId, notifyEmail);
            return new JobApplicationEmailNotificationResultDto
            {
                Status = "sent",
                Message = $"Notification sent to {notifyEmail}.",
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send application notification email for candidate {CandidateId}", candidateId);
            return new JobApplicationEmailNotificationResultDto
            {
                Status = "failed",
                Message = ex.Message,
            };
        }
    }

    public async Task<CandidateDto> UpdateCandidateAsync(UpdateCandidateDto dto)
    {
        var c = await _db.Candidates.FindAsync(dto.Id)
            ?? throw new InvalidOperationException("Candidate not found");
        c.FirstName = dto.FirstName; c.LastName = dto.LastName; c.Email = dto.Email;
        c.Phone = dto.Phone; c.ResumeUrl = dto.ResumeUrl; c.Source = dto.Source;
        c.RequisitionId = dto.RequisitionId; c.CurrentTitle = dto.CurrentTitle;
        c.CurrentCompany = dto.CurrentCompany; c.ExpectedSalary = dto.ExpectedSalary;
        c.NoticePeriod = dto.NoticePeriod; c.Notes = dto.Notes; c.Tags = dto.Tags;
        c.Rating = dto.Rating;
        await _db.SaveChangesAsync();
        return MapCandidate(c);
    }

    public async Task DeleteCandidateAsync(Guid id)
    {
        var c = await _db.Candidates.FindAsync(id)
            ?? throw new InvalidOperationException("Candidate not found");
        c.IsDeleted = true;
        await _db.SaveChangesAsync();
    }

    public async Task<CandidateDto> ChangeCandidateStageAsync(Guid id, string stage)
    {
        var c = await _db.Candidates.Include(x => x.Requisition).FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Candidate not found");
        var oldStage = c.Stage;
        c.Stage = stage;
        LogActivity(c.Id, "StageChange", $"Stage changed from {oldStage} to {stage}");
        await _db.SaveChangesAsync();
        return MapCandidate(c);
    }

    public async Task<CandidateDto> RejectCandidateAsync(Guid id, string reason)
    {
        var c = await _db.Candidates.Include(x => x.Requisition).FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Candidate not found");
        c.Stage = "Rejected";
        c.RejectionReason = reason;
        LogActivity(c.Id, "StageChange", $"Candidate rejected: {reason}");
        await _db.SaveChangesAsync();
        return MapCandidate(c);
    }

    public async Task<HireCandidateResult> HireCandidateAsync(Guid id)
    {
        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .Include(x => x.Offer)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Candidate not found");

        if (c.Stage != "Hired" && c.Stage != "Offer")
            throw new InvalidOperationException("Candidate must be in Offer or Hired stage to convert");

        // Idempotent: already linked to an employee (double submit, or refresh after success).
        // Use IgnoreQueryFilters so a soft-deleted linked employee is detected; clear stale FK below.
        if (c.EmployeeId is { } existingEmpId)
        {
            var linked = await _db.Employees.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(e => e.Id == existingEmpId);
            if (linked != null && !linked.IsDeleted)
            {
                c.Stage = "Hired";
                await _db.SaveChangesAsync();
                return new HireCandidateResult(linked.Id, CreatedNewEmployee: false);
            }

            // Broken FK or soft-deleted employee — clear so we can create or re-link after email check.
            c.EmployeeId = null;
        }

        var emailTrimmed = (c.Email ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(emailTrimmed))
            throw new InvalidOperationException("Candidate email is required to create an employee record.");

        var emailLower = emailTrimmed.ToLowerInvariant();
        // Unique index on Email applies to ALL rows including soft-deleted; global query filter would hide conflicts.
        var existingByEmail = await _db.Employees
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Email.ToLower() == emailLower);
        if (existingByEmail != null)
        {
            if (existingByEmail.IsDeleted)
            {
                throw new InvalidOperationException(
                    $"The email '{emailTrimmed}' is still tied to a former employee record in the database (deleted/archived). " +
                    "An administrator must change that archived employee's email in People (or permanently remove the row) before this candidate can use the same address.");
            }

            throw new InvalidOperationException(
                $"An employee with email '{emailTrimmed}' already exists ({existingByEmail.EmployeeCode}: {existingByEmail.FirstName} {existingByEmail.LastName}). " +
                "Update the candidate's email in recruitment, or open the existing employee in People.");
        }

        var employee = new Employee
        {
            FirstName = c.FirstName,
            LastName = c.LastName,
            Email = emailTrimmed,
            Phone = c.Phone,
            DepartmentId = c.Offer?.DepartmentId ?? c.Requisition.DepartmentId,
            PositionId = c.Offer?.PositionId ?? c.Requisition.PositionId,
            JobTitleId = c.Offer?.JobTitleId ?? c.Requisition.JobTitleId,
            JoinDate = c.Offer?.JoiningDate ?? DateTime.UtcNow,
            DateOfBirth = DateTime.UtcNow.AddYears(-25),
            Status = "Active",
            EmploymentType = "FullTimePermanent",
            EmployeeCode = await _settings.GenerateNextEmployeeCodeAsync(),
        };

        _db.Employees.Add(employee);
        c.EmployeeId = employee.Id;
        c.Stage = "Hired";

        if (c.Requisition.PositionId.HasValue || c.Offer?.PositionId != null)
        {
            var posId = c.Offer?.PositionId ?? c.Requisition.PositionId;
            if (posId.HasValue)
            {
                var pos = await _db.Positions.FindAsync(posId.Value);
                if (pos != null) pos.IsVacant = false;
            }
        }

        LogActivity(c.Id, "Hired", $"Candidate converted to employee {employee.FullName}");
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            if (!IsEmployeesEmailUniqueViolation(ex))
                throw;

            DetachAddedEmployee(employee);
            await _db.Entry(c).ReloadAsync();
            if (c.EmployeeId is { } recoveredId)
                return new HireCandidateResult(recoveredId, CreatedNewEmployee: false);

            throw new InvalidOperationException(
                $"This email is already used by another employee record (including possible archived users not visible in normal lists). " +
                $"Try a different email for the candidate, or ask an admin to free '{emailTrimmed}'.",
                ex);
        }

        return new HireCandidateResult(employee.Id, CreatedNewEmployee: true);
    }

    /// <summary>Detects Postgres unique_violation on Employees.Email (message shape varies by Npgsql / redacted detail).</summary>
    private static bool IsEmployeesEmailUniqueViolation(DbUpdateException ex)
    {
        for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
        {
            var msg = inner.Message ?? string.Empty;
            if (msg.Contains("IX_Employees_Email", StringComparison.OrdinalIgnoreCase))
                return true;
            if (msg.Contains("23505", StringComparison.Ordinal) && msg.Contains("email", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private void DetachAddedEmployee(Employee employee)
    {
        var entry = _db.Entry(employee);
        if (entry.State == EntityState.Added)
            entry.State = EntityState.Detached;
    }

    // ── Interviews ───────────────────────────────────────────────

    public async Task<List<InterviewDto>> GetInterviewsForCandidateAsync(Guid candidateId)
    {
        return await _db.Interviews
            .Include(i => i.Interviewer)
            .Include(i => i.Scorecards)
            .Include(i => i.Candidate)
            .Where(i => i.CandidateId == candidateId)
            .OrderByDescending(i => i.ScheduledAt)
            .Select(i => MapInterview(i))
            .ToListAsync();
    }

    public async Task<InterviewDto> CreateInterviewAsync(CreateInterviewDto dto)
    {
        var interview = new Interview
        {
            Title = dto.Title, ScheduledAt = dto.ScheduledAt, Duration = dto.Duration,
            Location = dto.Location, InterviewType = dto.InterviewType,
            CandidateId = dto.CandidateId, InterviewerId = dto.InterviewerId,
            InterviewerName = dto.InterviewerName,
        };

        if (dto.InterviewerId.HasValue && string.IsNullOrEmpty(dto.InterviewerName))
        {
            var emp = await _db.Employees.FindAsync(dto.InterviewerId.Value);
            if (emp != null) interview.InterviewerName = emp.FullName;
        }

        _db.Interviews.Add(interview);
        LogActivity(dto.CandidateId, "Interview", $"Interview scheduled: {dto.Title}");
        await _db.SaveChangesAsync();

        if (dto.NotifyCandidateByEmail || dto.NotifyInterviewerByEmail)
        {
            try
            {
                await SendInterviewScheduledEmailsAsync(dto, interview);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Interview {InterviewId} was created but one or more notification emails failed.", interview.Id);
            }
        }

        return (await _db.Interviews
            .Include(i => i.Interviewer).Include(i => i.Scorecards).Include(i => i.Candidate)
            .FirstAsync(i => i.Id == interview.Id))
            .Let(MapInterview);
    }

    private async Task SendInterviewScheduledEmailsAsync(CreateInterviewDto dto, Interview interview)
    {
        var cand = await _db.Candidates.AsNoTracking()
            .Include(c => c.Requisition)
            .FirstOrDefaultAsync(c => c.Id == dto.CandidateId);
        if (cand == null) return;

        var requisitionTitle = cand.Requisition?.Title ?? "Open position";
        var loc = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location;
        var intType = string.IsNullOrWhiteSpace(dto.InterviewType) ? null : dto.InterviewType;
        var interviewerDisplay = interview.InterviewerName;

        if (dto.NotifyCandidateByEmail && !string.IsNullOrWhiteSpace(cand.Email))
        {
            await _email.SendInterviewScheduledToCandidateAsync(
                cand.Email,
                cand.FullName,
                dto.Title,
                dto.ScheduledAt,
                dto.Duration,
                loc,
                intType,
                interviewerDisplay,
                requisitionTitle);
        }

        if (dto.NotifyInterviewerByEmail && dto.InterviewerId.HasValue)
        {
            var emp = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == dto.InterviewerId.Value);
            if (emp != null && !string.IsNullOrWhiteSpace(emp.Email))
            {
                await _email.SendInterviewScheduledToInterviewerAsync(
                    emp.Email,
                    emp.FullName,
                    cand.FullName,
                    dto.Title,
                    dto.ScheduledAt,
                    dto.Duration,
                    loc,
                    intType,
                    requisitionTitle);
            }
        }
    }

    public async Task<InterviewDto> UpdateInterviewAsync(UpdateInterviewDto dto)
    {
        var i = await _db.Interviews.FindAsync(dto.Id)
            ?? throw new InvalidOperationException("Interview not found");
        i.Title = dto.Title; i.ScheduledAt = dto.ScheduledAt; i.Duration = dto.Duration;
        i.Location = dto.Location; i.InterviewType = dto.InterviewType;
        i.InterviewerId = dto.InterviewerId; i.InterviewerName = dto.InterviewerName;

        if (dto.InterviewerId.HasValue && string.IsNullOrEmpty(dto.InterviewerName))
        {
            var emp = await _db.Employees.FindAsync(dto.InterviewerId.Value);
            if (emp != null) i.InterviewerName = emp.FullName;
        }

        await _db.SaveChangesAsync();
        return (await _db.Interviews
            .Include(x => x.Interviewer).Include(x => x.Scorecards).Include(x => x.Candidate)
            .FirstAsync(x => x.Id == i.Id))
            .Let(MapInterview);
    }

    public async Task DeleteInterviewAsync(Guid id)
    {
        var i = await _db.Interviews.FindAsync(id)
            ?? throw new InvalidOperationException("Interview not found");
        i.IsDeleted = true;
        i.Status = "Cancelled";
        LogActivity(i.CandidateId, "Interview", $"Interview cancelled: {i.Title}");
        await _db.SaveChangesAsync();
    }

    public async Task<InterviewDto> CompleteInterviewAsync(Guid id, CompleteInterviewDto dto)
    {
        var i = await _db.Interviews
            .Include(x => x.Scorecards)
            .Include(x => x.Interviewer)
            .Include(x => x.Candidate)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Interview not found");

        i.Status = "Completed";
        i.Feedback = dto.Feedback;
        i.OverallRating = dto.OverallRating;
        i.Recommendation = dto.Recommendation;

        var existingScores = i.Scorecards.ToList();
        foreach (var sc in existingScores)
            _db.InterviewScorecards.Remove(sc);

        foreach (var sc in dto.Scorecards)
        {
            _db.InterviewScorecards.Add(new InterviewScorecard
            {
                InterviewId = i.Id, Criteria = sc.Criteria, Rating = sc.Rating, Comment = sc.Comment,
            });
        }

        LogActivity(i.CandidateId, "Interview", $"Interview completed: {i.Title} — {dto.Recommendation}");
        await _db.SaveChangesAsync();
        return MapInterview(i);
    }

    public async Task<List<InterviewDto>> GetUpcomingInterviewsAsync()
    {
        var now = DateTime.UtcNow;
        return await _db.Interviews
            .Include(i => i.Interviewer)
            .Include(i => i.Candidate).ThenInclude(c => c.Requisition)
            .Include(i => i.Scorecards)
            .Where(i => i.ScheduledAt >= now && i.Status == "Scheduled")
            .OrderBy(i => i.ScheduledAt)
            .Take(20)
            .Select(i => MapInterview(i))
            .ToListAsync();
    }

    // ── Scorecards ───────────────────────────────────────────────

    public async Task<List<InterviewScorecardDto>> GetScorecardAsync(Guid interviewId)
    {
        return await _db.InterviewScorecards
            .Where(s => s.InterviewId == interviewId)
            .Select(s => new InterviewScorecardDto
            {
                Id = s.Id, Criteria = s.Criteria, Rating = s.Rating, Comment = s.Comment,
            })
            .ToListAsync();
    }

    public async Task SubmitScorecardAsync(Guid interviewId, List<ScorecardItemDto> items)
    {
        var existing = await _db.InterviewScorecards.Where(s => s.InterviewId == interviewId).ToListAsync();
        _db.InterviewScorecards.RemoveRange(existing);

        foreach (var item in items)
        {
            _db.InterviewScorecards.Add(new InterviewScorecard
            {
                InterviewId = interviewId, Criteria = item.Criteria, Rating = item.Rating, Comment = item.Comment,
            });
        }
        await _db.SaveChangesAsync();
    }

    // ── Offers ───────────────────────────────────────────────────

    public async Task<OfferDto> CreateOfferAsync(CreateOfferDto dto)
    {
        var offer = new Offer
        {
            SalaryOffered = dto.SalaryOffered, Currency = dto.Currency, OfferDate = dto.OfferDate,
            ExpiryDate = dto.ExpiryDate, Remarks = dto.Remarks, JoiningDate = dto.JoiningDate,
            CandidateId = dto.CandidateId, PositionId = dto.PositionId,
            JobTitleId = dto.JobTitleId, DepartmentId = dto.DepartmentId,
        };
        _db.Offers.Add(offer);

        var candidate = await _db.Candidates.FindAsync(dto.CandidateId);
        if (candidate != null && candidate.Stage != "Offer")
        {
            candidate.Stage = "Offer";
            LogActivity(candidate.Id, "OfferSent", $"Offer extended: {dto.SalaryOffered} {dto.Currency}");
        }

        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<OfferDto> UpdateOfferAsync(UpdateOfferDto dto)
    {
        var offer = await _db.Offers.FindAsync(dto.Id)
            ?? throw new InvalidOperationException("Offer not found");
        if (offer.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending offers can be edited.");
        offer.SalaryOffered = dto.SalaryOffered; offer.Currency = dto.Currency;
        offer.OfferDate = dto.OfferDate; offer.ExpiryDate = dto.ExpiryDate;
        offer.Remarks = dto.Remarks; offer.JoiningDate = dto.JoiningDate;
        offer.PositionId = dto.PositionId; offer.JobTitleId = dto.JobTitleId;
        offer.DepartmentId = dto.DepartmentId;
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<OfferDto> ApproveOfferAsync(Guid id)
    {
        var offer = await _db.Offers.FindAsync(id)
            ?? throw new InvalidOperationException("Offer not found");
        if (offer.Status == ApprovalStatus.Approved)
            return MapOffer(offer);
        if (offer.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending offers can be approved.");
        offer.Status = ApprovalStatus.Approved;
        LogActivity(offer.CandidateId, "OfferSent", "Offer approved");
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<OfferDto> AcceptOfferAsync(Guid id)
    {
        var offer = await _db.Offers.Include(o => o.Candidate).FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new InvalidOperationException("Offer not found");
        if (offer.AcceptedAt.HasValue)
            return MapOffer(offer);
        if (offer.Status != ApprovalStatus.Approved)
            throw new InvalidOperationException("Offer must be approved before it can be marked as accepted.");
        offer.Status = ApprovalStatus.Approved;
        offer.AcceptedAt = DateTime.UtcNow;
        if (offer.Candidate != null)
        {
            offer.Candidate.Stage = "Hired";
            LogActivity(offer.CandidateId, "StageChange", "Offer accepted — candidate moved to Hired");
        }
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<OfferDto> RejectOfferAsync(Guid id, string? reason)
    {
        var offer = await _db.Offers.FindAsync(id)
            ?? throw new InvalidOperationException("Offer not found");
        if (offer.Status == ApprovalStatus.Rejected)
            return MapOffer(offer);
        if (offer.AcceptedAt.HasValue)
            throw new InvalidOperationException("Accepted offers cannot be rejected.");
        if (offer.Status != ApprovalStatus.Pending && offer.Status != ApprovalStatus.Approved)
            throw new InvalidOperationException("This offer can no longer be rejected.");
        offer.Status = ApprovalStatus.Rejected;
        offer.RejectedAt = DateTime.UtcNow;
        offer.RejectionReason = reason;
        LogActivity(offer.CandidateId, "OfferSent", $"Offer rejected: {reason}");
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<OfferEmailInfoDto?> GetOfferWithCandidateAsync(Guid offerId)
    {
        var offer = await _db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.Requisition)
            .Include(o => o.Position)
            .Include(o => o.JobTitle)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer == null) return null;

        return new OfferEmailInfoDto
        {
            Status = offer.Status.ToString(),
            CandidateEmail = offer.Candidate.Email,
            CandidateName = offer.Candidate.FullName,
            PositionTitle = offer.Position?.Title ?? offer.JobTitle?.Title,
            RequisitionTitle = offer.Candidate.Requisition?.Title,
            SalaryOffered = offer.SalaryOffered,
            Currency = offer.Currency,
            JoiningDate = offer.JoiningDate,
            Remarks = offer.Remarks,
        };
    }

    // ── Dashboard & Pipeline ─────────────────────────────────────

    public async Task<RecruitmentDashboardDto> GetDashboardAsync()
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var weekEnd = now.AddDays(7);

        var openReqs = await _db.Requisitions.CountAsync(r => r.Status == ApprovalStatus.Approved && r.ClosedAt == null);
        var totalCandidates = await _db.Candidates.CountAsync();
        var interviewsThisWeek = await _db.Interviews.CountAsync(i => i.ScheduledAt >= now && i.ScheduledAt <= weekEnd && i.Status == "Scheduled");
        var offersExtended = await _db.Offers.CountAsync(o => o.Status == ApprovalStatus.Pending || o.Status == ApprovalStatus.Approved);
        var hiredThisMonth = await _db.Candidates.CountAsync(c => c.Stage == "Hired" && c.UpdatedAt >= monthStart);

        var allOffers = await _db.Offers.CountAsync();
        var acceptedOffers = await _db.Offers.CountAsync(o => o.AcceptedAt != null);
        var offerAcceptanceRate = allOffers > 0 ? Math.Round((double)acceptedOffers / allOffers * 100, 1) : 0;

        var hiredCandidates = await _db.Candidates
            .Where(c => c.Stage == "Hired" && c.EmployeeId != null)
            .Select(c => new { c.AppliedAt, c.UpdatedAt })
            .ToListAsync();
        var avgTimeToHire = hiredCandidates.Count > 0
            ? Math.Round(hiredCandidates.Average(c => (c.UpdatedAt ?? DateTime.UtcNow).Subtract(c.AppliedAt).TotalDays), 1)
            : 0;

        var stages = new[] { "Sourced", "Screening", "Phone Screen", "Interview", "Evaluation", "Offer", "Hired", "Rejected", "Withdrawn" };
        var pipelineByStage = new Dictionary<string, int>();
        foreach (var st in stages)
            pipelineByStage[st] = await _db.Candidates.CountAsync(c => c.Stage == st);

        var upcoming = await GetUpcomingInterviewsAsync();

        var recentActivities = await _db.CandidateActivities
            .OrderByDescending(a => a.PerformedAt)
            .Take(10)
            .Select(a => new CandidateActivityDto
            {
                Id = a.Id, ActivityType = a.ActivityType, Description = a.Description,
                PerformedBy = a.PerformedBy, PerformedAt = a.PerformedAt,
            })
            .ToListAsync();

        return new RecruitmentDashboardDto
        {
            OpenRequisitions = openReqs, TotalCandidates = totalCandidates,
            InterviewsThisWeek = interviewsThisWeek, OffersExtended = offersExtended,
            HiredThisMonth = hiredThisMonth, AvgTimeToHireDays = avgTimeToHire,
            OfferAcceptanceRate = offerAcceptanceRate, PipelineByStage = pipelineByStage,
            UpcomingInterviews = upcoming, RecentActivities = recentActivities,
        };
    }

    public async Task<PipelineDto> GetPipelineAsync(Guid requisitionId)
    {
        var candidates = await _db.Candidates
            .Where(c => c.RequisitionId == requisitionId)
            .GroupBy(c => c.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count() })
            .ToListAsync();

        var dict = candidates.ToDictionary(x => x.Stage, x => x.Count);
        return new PipelineDto { Stages = dict, Total = dict.Values.Sum() };
    }

    // ── Helpers ──────────────────────────────────────────────────

    private void LogActivity(Guid candidateId, string type, string description, string? performedBy = null)
    {
        _db.CandidateActivities.Add(new CandidateActivity
        {
            CandidateId = candidateId,
            ActivityType = type,
            Description = description,
            PerformedBy = performedBy,
            PerformedAt = DateTime.UtcNow,
        });
    }

    private static List<RequisitionTimelineEntryDto> DeserializeTimeline(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<RequisitionTimelineEntryDto>();
        try
        {
            return JsonSerializer.Deserialize<List<RequisitionTimelineEntryDto>>(json)
                ?? new List<RequisitionTimelineEntryDto>();
        }
        catch
        {
            return new List<RequisitionTimelineEntryDto>();
        }
    }

    private static RequisitionDto MapRequisition(Requisition r) => new()
    {
        Id = r.Id, Title = r.Title, Code = r.Code, Description = r.Description,
        Vacancies = r.Vacancies, Status = r.Status.ToString(), TargetDate = r.TargetDate, Priority = r.Priority,
        EmploymentType = r.EmploymentType, ExperienceMin = r.ExperienceMin, ExperienceMax = r.ExperienceMax,
        SalaryMin = r.SalaryMin, SalaryMax = r.SalaryMax, Skills = r.Skills, ClosedAt = r.ClosedAt,
        DepartmentName = r.Department?.Name, DepartmentId = r.DepartmentId,
        JobTitleName = r.JobTitle?.Title, JobTitleId = r.JobTitleId,
        HiringManagerName = r.HiringManager != null ? r.HiringManager.FullName : null, HiringManagerId = r.HiringManagerId,
        LocationName = r.Location?.Name, LocationId = r.LocationId,
        PositionTitle = r.Position?.Title, PositionId = r.PositionId,
        CandidateCount = r.Candidates?.Count ?? 0,
        Timeline = DeserializeTimeline(r.RoleTimelineJson),
        SupportingPdfOriginalFileName = r.SupportingPdfOriginalFileName,
        HasSupportingPdf = !string.IsNullOrEmpty(r.SupportingPdfStoredFileName),
        ApplicationNotificationEmail = r.ApplicationNotificationEmail,
    };

    private static PublicRequisitionDto MapPublicRequisition(Requisition r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        Code = r.Code,
        Description = r.Description,
        Vacancies = r.Vacancies,
        Status = r.Status.ToString(),
        TargetDate = r.TargetDate,
        Priority = r.Priority,
        EmploymentType = r.EmploymentType,
        ExperienceMin = r.ExperienceMin,
        ExperienceMax = r.ExperienceMax,
        SalaryMin = r.SalaryMin,
        SalaryMax = r.SalaryMax,
        Skills = r.Skills,
        DepartmentName = r.Department?.Name,
        DepartmentId = r.DepartmentId,
        JobTitleName = r.JobTitle?.Title,
        JobTitleId = r.JobTitleId,
        HiringManagerName = r.HiringManager != null ? r.HiringManager.FullName : null,
        HiringManagerId = r.HiringManagerId,
        LocationName = r.Location?.Name,
        LocationId = r.LocationId,
        PositionTitle = r.Position?.Title,
        PositionId = r.PositionId,
        Timeline = DeserializeTimeline(r.RoleTimelineJson),
    };

    private CandidateDto MapCandidate(Candidate c) => new()
    {
        Id = c.Id, FirstName = c.FirstName, LastName = c.LastName, FullName = c.FullName,
        Email = c.Email, Phone = c.Phone, ResumeUrl = c.ResumeUrl, Source = c.Source, Stage = c.Stage,
        AppliedAt = c.AppliedAt, CurrentTitle = c.CurrentTitle, CurrentCompany = c.CurrentCompany,
        ExpectedSalary = c.ExpectedSalary, NoticePeriod = c.NoticePeriod, Notes = c.Notes,
        Rating = c.Rating, RejectionReason = c.RejectionReason, Tags = c.Tags,
        RequisitionId = c.RequisitionId, RequisitionTitle = c.Requisition?.Title,
        EmployeeId = c.EmployeeId,
        HasUploadedResume = ResumeFileExists(c.Id),
    };

    private static InterviewDto MapInterview(Interview i) => new()
    {
        Id = i.Id, Title = i.Title, ScheduledAt = i.ScheduledAt, Duration = i.Duration,
        Location = i.Location, InterviewType = i.InterviewType, Status = i.Status,
        Feedback = i.Feedback, Result = i.Result, OverallRating = i.OverallRating,
        Recommendation = i.Recommendation,
        InterviewerName = i.Interviewer?.FullName ?? i.InterviewerName,
        InterviewerId = i.InterviewerId, CandidateId = i.CandidateId,
        CandidateName = i.Candidate != null ? i.Candidate.FullName : null,
        RequisitionTitle = i.Candidate?.Requisition?.Title,
        Scorecards = i.Scorecards?.Select(s => new InterviewScorecardDto
        {
            Id = s.Id, Criteria = s.Criteria, Rating = s.Rating, Comment = s.Comment,
        }).ToList() ?? new(),
    };

    private static OfferDto MapOffer(Offer o) => new()
    {
        Id = o.Id, SalaryOffered = o.SalaryOffered, Currency = o.Currency,
        OfferDate = o.OfferDate, ExpiryDate = o.ExpiryDate, Status = o.Status.ToString(),
        Remarks = o.Remarks, JoiningDate = o.JoiningDate, OfferLetterUrl = o.OfferLetterUrl,
        AcceptedAt = o.AcceptedAt, RejectedAt = o.RejectedAt, RejectionReason = o.RejectionReason,
        CandidateId = o.CandidateId, CandidateName = o.Candidate?.FullName,
        PositionId = o.PositionId, JobTitleId = o.JobTitleId, DepartmentId = o.DepartmentId,
    };
}

public static class ObjectExtensions
{
    public static TResult Let<T, TResult>(this T obj, Func<T, TResult> func) => func(obj);
}
