using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

namespace OpenSkyHRM.Application.Services;

public class RecruitmentService : IRecruitmentService
{
    private readonly AppDbContext _db;
    private readonly ISystemSettingService _settings;
    private readonly IEmailService _email;
    private readonly ILogger<RecruitmentService> _logger;
    private readonly IFileStorageService _files;
    private readonly IConfiguration _configuration;

    public RecruitmentService(
        AppDbContext db,
        ISystemSettingService settings,
        IEmailService email,
        ILogger<RecruitmentService> logger,
        IFileStorageService files,
        IConfiguration configuration)
    {
        _db = db;
        _settings = settings;
        _email = email;
        _logger = logger;
        _files = files;
        _configuration = configuration;
    }

    private string CandidateResumePath(Guid candidateId) =>
        _files.BuildLogicalPath($"candidates/{candidateId}", "resume.pdf");

    private Task<bool> ResumeFileExistsAsync(Guid candidateId) =>
        _files.ExistsAsync(CandidateResumePath(candidateId));

    private static bool CandidateAllowsSelfServiceEdit(string stage) =>
        !string.Equals(stage, "Rejected", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(stage, "Hired", StringComparison.OrdinalIgnoreCase);

    /// <summary>UTC instants persisted in <c>timestamp without time zone</c> columns (read back as Unspecified).</summary>
    private static DateTime AsStoredUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private async Task<PublicCandidateApplicationDto> MapPublicApplicationAsync(Candidate c) => new()
    {
        Id = c.Id,
        FirstName = c.FirstName,
        LastName = c.LastName,
        Email = c.Email,
        Phone = c.Phone,
        Stage = c.Stage,
        AppliedAt = AsStoredUtc(c.AppliedAt),
        RequisitionId = c.RequisitionId,
        RequisitionTitle = c.Requisition?.Title,
        HasUploadedResume = await ResumeFileExistsAsync(c.Id),
        ResumeFileName = c.ResumeUrl,
        CanEdit = CandidateAllowsSelfServiceEdit(c.Stage),
    };

    private async Task<Candidate?> FindCandidateForSelfServiceAsync(Guid candidateId, string email)
    {
        var normalized = email.Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return null;

        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .FirstOrDefaultAsync(x => x.Id == candidateId);
        if (c == null || c.IsDeleted) return null;
        if (!string.Equals(c.Email.Trim(), normalized, StringComparison.OrdinalIgnoreCase))
            return null;
        return c;
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
        var rows = await query.OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        await SyncAutoCloseRequisitionsAsync(rows);
        var items = rows.Select(MapRequisition).ToList();

        return new PagedResult<RequisitionDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<RequisitionDto?> GetRequisitionByIdAsync(Guid id)
    {
        var r = await _db.Requisitions
            .Include(x => x.Department).Include(x => x.JobTitle)
            .Include(x => x.HiringManager).Include(x => x.Location)
            .Include(x => x.Position).Include(x => x.Candidates)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return null;
        await TryAutoCloseRequisitionIfFilledAsync(r.Id);
        await _db.SaveChangesAsync();
        await _db.Entry(r).ReloadAsync();
        return MapRequisition(r);
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
        InputValidators.ValidateEmailInput(dto.ApplicationNotificationEmail, "Application notification email", required: false);
        ValidateRequisitionRequiredFields(dto);

        var req = new Requisition
        {
            Title = dto.Title, Code = dto.Code, Description = dto.Description, Vacancies = dto.Vacancies,
            Status = ApprovalStatus.Pending,
            TargetDate = dto.TargetDate, Priority = dto.Priority, EmploymentType = dto.EmploymentType,
            ExperienceMin = dto.ExperienceMin, ExperienceMax = dto.ExperienceMax,
            SalaryMin = dto.SalaryMin, SalaryMax = dto.SalaryMax,
            SalaryCurrency = NormalizeSalaryCurrency(dto.SalaryCurrency),
            Skills = dto.Skills,
            DepartmentId = dto.DepartmentId, JobTitleId = dto.JobTitleId,
            HiringManagerId = dto.HiringManagerId,
            LocationId = null,
            WorkLocation = NormalizeWorkLocation(dto.WorkLocation),
            PositionId = dto.PositionId,
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
        InputValidators.ValidateEmailInput(dto.ApplicationNotificationEmail, "Application notification email", required: false);
        ValidateRequisitionRequiredFields(dto);
        req.Title = dto.Title; req.Code = dto.Code; req.Description = dto.Description;
        req.Vacancies = dto.Vacancies; req.TargetDate = dto.TargetDate; req.Priority = dto.Priority;
        req.EmploymentType = dto.EmploymentType; req.ExperienceMin = dto.ExperienceMin;
        req.ExperienceMax = dto.ExperienceMax; req.SalaryMin = dto.SalaryMin; req.SalaryMax = dto.SalaryMax;
        req.SalaryCurrency = NormalizeSalaryCurrency(dto.SalaryCurrency);
        req.Skills = dto.Skills; req.DepartmentId = dto.DepartmentId; req.JobTitleId = dto.JobTitleId;
        req.HiringManagerId = dto.HiringManagerId;
        req.LocationId = null;
        req.WorkLocation = NormalizeWorkLocation(dto.WorkLocation);
        req.PositionId = dto.PositionId;
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
        await EnsureRequisitionCanBeDeletedAsync(id);
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
            RequisitionDepartmentId = c.Requisition?.DepartmentId,
            RequisitionJobTitleId = c.Requisition?.JobTitleId,
            RequisitionLocationId = c.Requisition?.LocationId,
            RequisitionPositionId = c.Requisition?.PositionId,
            EmployeeId = m.EmployeeId,
            HasUploadedResume = m.HasUploadedResume,
            Interviews = c.Interviews.OrderByDescending(i => i.ScheduledAt).Select(i => MapInterview(i)).ToList(),
            Offer = c.Offer != null ? MapOffer(c.Offer) : null,
            Activities = c.Activities.OrderByDescending(a => a.PerformedAt)
                .Select(a => new CandidateActivityDto
                {
                    Id = a.Id, ActivityType = a.ActivityType, Description = a.Description,
                    PerformedBy = a.PerformedBy, PerformedAt = AsStoredUtc(a.PerformedAt),
                }).ToList(),
        };
    }

    public async Task<CandidateDto> CreateCandidateAsync(CreateCandidateDto dto)
    {
        InputValidators.ValidatePersonName(dto.FirstName, "First name");
        InputValidators.ValidatePersonName(dto.LastName, "Last name");
        InputValidators.ValidatePhone(dto.Phone, "Phone", required: false);
        InputValidators.ValidateEmailInput(dto.Email, "Email", required: true);

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

    public async Task<PublicCandidateApplicationDto?> GetPublicApplicationAsync(Guid candidateId, string email)
    {
        var c = await FindCandidateForSelfServiceAsync(candidateId, email);
        return c == null ? null : await MapPublicApplicationAsync(c);
    }

    public async Task<PublicCandidateApplicationDto?> LookupPublicApplicationAsync(Guid requisitionId, string email)
    {
        var normalized = email.Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return null;

        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .Where(x => x.RequisitionId == requisitionId && !x.IsDeleted)
            .Where(x => x.Email.ToLower() == normalized.ToLower())
            .OrderByDescending(x => x.AppliedAt)
            .FirstOrDefaultAsync();

        return c == null ? null : await MapPublicApplicationAsync(c);
    }

    public async Task<PublicCandidateApplicationDto> UpdatePublicApplicationAsync(
        Guid candidateId,
        string email,
        string firstName,
        string lastName,
        string phone,
        string? resumeFileName = null)
    {
        var c = await FindCandidateForSelfServiceAsync(candidateId, email)
            ?? throw new InvalidOperationException("Application not found or email does not match.");

        if (!CandidateAllowsSelfServiceEdit(c.Stage))
            throw new InvalidOperationException("This application can no longer be edited. Contact HR if you need to make changes.");

        InputValidators.ValidatePersonName(firstName, "First name");
        InputValidators.ValidatePersonName(lastName, "Last name");
        InputValidators.ValidatePhone(phone, "Phone", required: true);

        c.FirstName = firstName.Trim();
        c.LastName = lastName.Trim();
        c.Phone = phone.Trim();
        if (!string.IsNullOrWhiteSpace(resumeFileName))
            c.ResumeUrl = resumeFileName.Trim();

        await _db.SaveChangesAsync();
        return await MapPublicApplicationAsync(c);
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
        var resumeUploaded = await ResumeFileExistsAsync(candidateId);

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

        InputValidators.ValidatePersonName(dto.FirstName, "First name");
        InputValidators.ValidatePersonName(dto.LastName, "Last name");
        InputValidators.ValidatePhone(dto.Phone, "Phone", required: false);
        InputValidators.ValidateEmailInput(dto.Email, "Email", required: true);

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
        if (string.Equals(stage, "Hired", StringComparison.OrdinalIgnoreCase))
        {
            await TryAutoCloseRequisitionIfFilledAsync(c.RequisitionId);
            await _db.SaveChangesAsync();
        }
        return MapCandidate(c);
    }

    public async Task<CandidateActivityDto> AddEvaluationNoteAsync(Guid candidateId, string note, string? performedBy)
    {
        var trimmed = note?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new InvalidOperationException("Evaluation note cannot be empty.");

        var c = await _db.Candidates.FindAsync(candidateId)
            ?? throw new InvalidOperationException("Candidate not found.");

        if (!string.Equals(c.Stage, "Evaluation", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Evaluation notes can only be added while the candidate is in the Evaluation stage.");

        LogActivity(candidateId, "EvaluationNote", trimmed, performedBy);
        await _db.SaveChangesAsync();

        var activity = await _db.CandidateActivities
            .Where(a => a.CandidateId == candidateId && a.ActivityType == "EvaluationNote")
            .OrderByDescending(a => a.PerformedAt)
            .FirstAsync();

        return new CandidateActivityDto
        {
            Id = activity.Id,
            ActivityType = activity.ActivityType,
            Description = activity.Description,
            PerformedBy = activity.PerformedBy,
            PerformedAt = AsStoredUtc(activity.PerformedAt),
        };
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

    public async Task<CandidateDto> ReopenCandidateForInterviewAsync(Guid id)
    {
        var c = await _db.Candidates.Include(x => x.Requisition).FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Candidate not found");

        if (!string.Equals(c.Stage, "Rejected", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only rejected candidates can be reopened for interview.");

        var previousReason = c.RejectionReason;
        c.Stage = "Interview";
        c.RejectionReason = null;
        LogActivity(
            c.Id,
            "StageChange",
            string.IsNullOrWhiteSpace(previousReason)
                ? "Candidate reopened for interview"
                : $"Candidate reopened for interview (previously rejected: {previousReason})");
        await _db.SaveChangesAsync();
        return MapCandidate(c);
    }

    public async Task<HireCandidateResult> LinkCandidateToEmployeeAsync(Guid candidateId, Guid employeeId)
    {
        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .Include(x => x.Offer)
            .FirstOrDefaultAsync(x => x.Id == candidateId)
            ?? throw new InvalidOperationException("Candidate not found");

        if (c.Stage != "Hired" && c.Stage != "Offer")
            throw new InvalidOperationException("Candidate must be in Offer or Hired stage to convert");

        var employee = await _db.Employees
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == employeeId)
            ?? throw new InvalidOperationException("Employee not found.");

        if (employee.IsDeleted)
            throw new InvalidOperationException("Cannot link a deleted employee record to this candidate.");

        if (c.EmployeeId is { } existingEmpId && existingEmpId != employeeId)
        {
            var linked = await _db.Employees.IgnoreQueryFilters().AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == existingEmpId);
            if (linked != null && !linked.IsDeleted)
                throw new InvalidOperationException("This candidate is already linked to another employee.");
        }

        c.EmployeeId = employee.Id;
        c.Stage = "Hired";

        var posId = employee.PositionId ?? c.Offer?.PositionId ?? c.Requisition?.PositionId;
        if (posId.HasValue)
        {
            var pos = await _db.Positions.FindAsync(posId.Value);
            if (pos != null) pos.IsVacant = false;
        }

        LogActivity(c.Id, "Hired", $"Candidate converted to employee {employee.FullName}");
        await _db.SaveChangesAsync();
        await TryAutoCloseRequisitionIfFilledAsync(c.RequisitionId);
        await _db.SaveChangesAsync();
        return new HireCandidateResult(employee.Id, CreatedNewEmployee: true);
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
        var candidate = await _db.Candidates.FirstOrDefaultAsync(c => c.Id == dto.CandidateId)
            ?? throw new InvalidOperationException("Candidate not found");

        if (string.Equals(candidate.Stage, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            candidate.Stage = "Interview";
            candidate.RejectionReason = null;
            LogActivity(candidate.Id, "StageChange", "Candidate reopened for interview (scheduled)");
        }
        else if (string.Equals(candidate.Stage, "Hired", StringComparison.OrdinalIgnoreCase)
            || string.Equals(candidate.Stage, "Withdrawn", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Cannot schedule an interview for a candidate in {candidate.Stage} stage.");
        }

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

    public async Task<List<InterviewDto>> GetInterviewHistoryAsync(int page = 1, int pageSize = 50)
    {
        var now = DateTime.UtcNow;
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        return await _db.Interviews
            .Include(i => i.Interviewer)
            .Include(i => i.Candidate).ThenInclude(c => c.Requisition)
            .Include(i => i.Scorecards)
            .Where(i => i.Status != "Scheduled" || i.ScheduledAt < now)
            .OrderByDescending(i => i.ScheduledAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
        var candidate = await _db.Candidates
            .Include(c => c.Requisition)
            .FirstOrDefaultAsync(c => c.Id == dto.CandidateId)
            ?? throw new InvalidOperationException("Candidate not found.");

        var existingOffer = await _db.Offers.FirstOrDefaultAsync(o => o.CandidateId == dto.CandidateId);
        if (existingOffer != null)
        {
            if (existingOffer.Status == ApprovalStatus.Rejected)
            {
                return await ReplaceRejectedOfferAsync(existingOffer, dto);
            }

            throw new InvalidOperationException("This candidate already has an offer. Edit the existing offer or withdraw it before creating a new one.");
        }

        var letterHtml = dto.LetterHtml;
        if (string.IsNullOrWhiteSpace(letterHtml))
        {
            letterHtml = await PreviewOfferLetterAsync(new PreviewOfferLetterDto
            {
                CandidateId = dto.CandidateId,
                SalaryOffered = dto.SalaryOffered,
                Currency = dto.Currency,
                OfferDate = dto.OfferDate,
                ExpiryDate = dto.ExpiryDate,
                JoiningDate = dto.JoiningDate,
                Remarks = dto.Remarks,
                PositionTitle = dto.PositionTitle,
            });
        }

        var offer = new Offer
        {
            SalaryOffered = dto.SalaryOffered, Currency = dto.Currency, OfferDate = dto.OfferDate,
            ExpiryDate = dto.ExpiryDate, Remarks = dto.Remarks, JoiningDate = dto.JoiningDate,
            CandidateId = dto.CandidateId, PositionId = dto.PositionId,
            JobTitleId = dto.JobTitleId, DepartmentId = dto.DepartmentId,
            LetterHtml = letterHtml,
        };
        _db.Offers.Add(offer);

        if (candidate != null && candidate.Stage != "Offer")
        {
            candidate.Stage = "Offer";
            LogActivity(candidate.Id, "OfferSent", $"Offer extended: {dto.SalaryOffered} {dto.Currency}");
        }

        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    private async Task<OfferDto> ReplaceRejectedOfferAsync(Offer offer, CreateOfferDto dto)
    {
        var letterHtml = dto.LetterHtml;
        if (string.IsNullOrWhiteSpace(letterHtml))
        {
            letterHtml = await PreviewOfferLetterAsync(new PreviewOfferLetterDto
            {
                CandidateId = dto.CandidateId,
                SalaryOffered = dto.SalaryOffered,
                Currency = dto.Currency,
                OfferDate = dto.OfferDate,
                ExpiryDate = dto.ExpiryDate,
                JoiningDate = dto.JoiningDate,
                Remarks = dto.Remarks,
                PositionTitle = dto.PositionTitle,
            });
        }

        offer.SalaryOffered = dto.SalaryOffered;
        offer.Currency = dto.Currency;
        offer.OfferDate = dto.OfferDate;
        offer.ExpiryDate = dto.ExpiryDate;
        offer.Remarks = dto.Remarks;
        offer.JoiningDate = dto.JoiningDate;
        offer.PositionId = dto.PositionId;
        offer.JobTitleId = dto.JobTitleId;
        offer.DepartmentId = dto.DepartmentId;
        offer.LetterHtml = letterHtml;
        offer.Status = ApprovalStatus.Pending;
        offer.RejectedAt = null;
        offer.RejectionReason = null;
        offer.AcceptedAt = null;

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
        if (dto.LetterHtml != null)
            offer.LetterHtml = dto.LetterHtml;
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<string> GetOfferLetterTemplateHtmlAsync()
    {
        var template = await _db.DocumentTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TemplateKey == TransactionalEmailTemplateSeeder.RecruitmentOfferKey && t.IsActive);
        return template?.HtmlContent
            ?? throw new InvalidOperationException("Offer letter template is not configured. Add Email_RecruitmentOffer under Settings → Letter templates.");
    }

    public async Task<string> PreviewOfferLetterAsync(PreviewOfferLetterDto dto)
    {
        var candidate = await _db.Candidates
            .Include(c => c.Requisition)
            .FirstOrDefaultAsync(c => c.Id == dto.CandidateId)
            ?? throw new InvalidOperationException("Candidate not found.");

        var positionTitle = !string.IsNullOrWhiteSpace(dto.PositionTitle)
            ? dto.PositionTitle.Trim()
            : candidate.Requisition?.Title ?? "Open Position";
        var templateHtml = string.IsNullOrWhiteSpace(dto.TemplateHtml)
            ? await GetOfferLetterTemplateHtmlAsync()
            : dto.TemplateHtml!;
        templateHtml = OfferLetterHelper.EnsureBrandingPlaceholders(templateHtml);

        var (companyName, companyHeaderHtml) = await GetOfferLetterBrandingAsync();

        var replacements = OfferLetterHelper.BuildReplacements(
            candidate.FullName,
            positionTitle,
            dto.SalaryOffered,
            dto.Currency ?? "LKR",
            dto.JoiningDate,
            dto.OfferDate,
            dto.ExpiryDate,
            dto.Remarks,
            companyName,
            companyHeaderHtml);

        var merged = OfferLetterHelper.Merge(templateHtml, replacements);
        return OfferLetterHelper.InjectBrandingIntoHtml(merged, companyName, companyHeaderHtml);
    }

    private async Task<(string companyName, string companyHeaderHtml)> GetOfferLetterBrandingAsync()
    {
        var companyName = (await _settings.GetAsync("CompanyName") ?? "").Trim();
        if (string.IsNullOrEmpty(companyName))
            companyName = OfferLetterHelper.DefaultCompanyName;

        var logoPath = OfferLetterHelper.NormalizeUploadPath(await _settings.GetAsync("CompanyLogoUrl"));
        var companyHeaderHtml = OfferLetterHelper.BuildOfferLetterHeaderHtml(logoPath, companyName);
        return (companyName, companyHeaderHtml);
    }

    public async Task<OfferDto> UpdateOfferLetterAsync(Guid offerId, string? letterHtml)
    {
        var offer = await _db.Offers
            .Include(o => o.Candidate)
            .FirstOrDefaultAsync(o => o.Id == offerId)
            ?? throw new InvalidOperationException("Offer not found.");

        if (offer.Status == ApprovalStatus.Rejected)
            throw new InvalidOperationException("Rejected offers cannot be edited.");

        if (string.IsNullOrWhiteSpace(letterHtml))
            throw new InvalidOperationException("Offer letter cannot be empty.");

        offer.LetterHtml = letterHtml.Trim();
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task SaveOfferLetterPdfAsync(Guid offerId, byte[] pdfBytes)
    {
        if (pdfBytes.Length == 0)
            throw new InvalidOperationException("Offer letter PDF is empty.");

        var offer = await _db.Offers.FirstOrDefaultAsync(o => o.Id == offerId)
            ?? throw new InvalidOperationException("Offer not found.");

        var logicalPath = _files.BuildLogicalPath($"offers/{offerId}", "offer-letter.pdf");
        await using var stream = new MemoryStream(pdfBytes);
        await _files.SaveAsync(logicalPath, stream, "application/pdf");
        offer.OfferLetterUrl = logicalPath;
        await _db.SaveChangesAsync();
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
            LogActivity(offer.CandidateId, "StageChange", $"{offer.Candidate.FullName} — offer accepted, moved to Hired");
        }
        await _db.SaveChangesAsync();
        if (offer.Candidate != null)
            await TryAutoCloseRequisitionIfFilledAsync(offer.Candidate.RequisitionId);
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

    public async Task<List<OfferHistoryDto>> GetOfferHistoryAsync(int page = 1, int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var offers = await _db.Offers
            .AsNoTracking()
            .Include(o => o.Candidate).ThenInclude(c => c.Requisition)
            .Include(o => o.Position)
            .Include(o => o.JobTitle)
            .OrderByDescending(o => o.OfferDate)
            .ThenByDescending(o => o.UpdatedAt ?? o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return offers.Select(MapOfferHistory).ToList();
    }

    public async Task<OfferDto?> GetOfferByIdAsync(Guid id)
    {
        var offer = await _db.Offers
            .AsNoTracking()
            .Include(o => o.Candidate)
            .FirstOrDefaultAsync(o => o.Id == id);
        return offer == null ? null : MapOffer(offer);
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
            LetterHtml = offer.LetterHtml,
        };
    }

    // ── Dashboard & Pipeline ─────────────────────────────────────

    public async Task<RecruitmentDashboardDto> GetDashboardAsync()
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var weekEnd = now.AddDays(7);

        // Open = not formally closed (matches requisitions visible for hiring work; excludes cancelled only).
        var openReqs = await _db.Requisitions.CountAsync(r =>
            r.ClosedAt == null && r.Status != ApprovalStatus.Cancelled);

        // Active pipeline = candidates still moving through hiring (exclude terminal outcomes).
        var totalCandidates = await _db.Candidates.CountAsync(c =>
            !c.IsDeleted
            && c.Stage.ToLower() != "hired"
            && c.Stage.ToLower() != "rejected"
            && c.Stage.ToLower() != "withdrawn");

        var interviewsThisWeek = await _db.Interviews.CountAsync(i =>
            !i.IsDeleted
            && i.ScheduledAt >= now
            && i.ScheduledAt <= weekEnd
            && i.Status == "Scheduled");

        // Offers approved and sent to candidates, still awaiting accept/reject.
        var offersExtended = await _db.Offers.CountAsync(o =>
            !o.IsDeleted
            && o.Status == ApprovalStatus.Approved
            && o.AcceptedAt == null
            && o.RejectedAt == null);

        var hiredThisMonth = await _db.Candidates.CountAsync(c =>
            !c.IsDeleted && c.Stage == "Hired" && c.UpdatedAt >= monthStart);

        var approvedOffers = await _db.Offers.CountAsync(o => !o.IsDeleted && o.Status == ApprovalStatus.Approved);
        var acceptedOffers = await _db.Offers.CountAsync(o => !o.IsDeleted && o.AcceptedAt != null);
        var offerAcceptanceRate = approvedOffers > 0
            ? Math.Round((double)acceptedOffers / approvedOffers * 100, 1)
            : 0;

        var hiredCandidates = await _db.Candidates
            .Where(c => !c.IsDeleted && c.Stage == "Hired")
            .Select(c => new { c.AppliedAt, c.UpdatedAt })
            .ToListAsync();
        var avgTimeToHire = hiredCandidates.Count > 0
            ? Math.Round(hiredCandidates.Average(c => (c.UpdatedAt ?? DateTime.UtcNow).Subtract(c.AppliedAt).TotalDays), 1)
            : 0;

        var stages = new[] { "Sourced", "Screening", "Interview", "Evaluation", "Offer", "Hired", "Rejected", "Withdrawn" };
        var pipelineByStage = new Dictionary<string, int>();
        foreach (var st in stages)
            pipelineByStage[st] = await _db.Candidates.CountAsync(c => !c.IsDeleted && c.Stage == st);

        var upcoming = await GetUpcomingInterviewsAsync();

        var recentActivities = await _db.CandidateActivities
            .OrderByDescending(a => a.PerformedAt)
            .Take(10)
            .Select(a => new CandidateActivityDto
            {
                Id = a.Id,
                ActivityType = a.ActivityType,
                Description = a.Description,
                CandidateName = a.Candidate.FirstName + " " + a.Candidate.LastName,
                PerformedBy = a.PerformedBy,
                PerformedAt = AsStoredUtc(a.PerformedAt),
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

    private static string NormalizeSalaryCurrency(string? currency) =>
        string.IsNullOrWhiteSpace(currency) ? "LKR" : currency.Trim().ToUpperInvariant();

    private static string? NormalizeWorkLocation(string? workLocation) =>
        string.IsNullOrWhiteSpace(workLocation) ? null : workLocation.Trim();

    private static string? ResolveRequisitionLocationName(Requisition r) =>
        NormalizeWorkLocation(r.WorkLocation) ?? r.Location?.Name;

    /// <summary>
    /// Candidates still in the hiring pipeline block requisition deletion until rejected or hired as an employee.
    /// </summary>
    private static bool CandidateBlocksRequisitionDeletion(Candidate c)
    {
        if (c.IsDeleted) return false;
        return CandidateBlocksRequisitionDeletion(c.Stage, c.EmployeeId);
    }

    private static bool CandidateBlocksRequisitionDeletion(string? stage, Guid? employeeId)
    {
        var s = (stage ?? "").Trim().ToLowerInvariant();
        if (s is "rejected" or "withdrawn") return false;
        if (s == "hired" && employeeId.HasValue) return false;
        return true;
    }

    private async Task EnsureRequisitionCanBeDeletedAsync(Guid requisitionId)
    {
        var blocking = await _db.Candidates
            .Where(c => c.RequisitionId == requisitionId && !c.IsDeleted)
            .Select(c => new { c.Stage, c.EmployeeId })
            .ToListAsync();
        if (blocking.Any(c => CandidateBlocksRequisitionDeletion(c.Stage, c.EmployeeId)))
        {
            throw new InvalidOperationException(
                "This requisition cannot be deleted while it has active candidates. Reject each candidate or convert them to employees first.");
        }
    }

    /// <summary>When hired placements meet or exceed vacancies, mark the requisition closed.</summary>
    private async Task TryAutoCloseRequisitionIfFilledAsync(Guid requisitionId)
    {
        var req = await _db.Requisitions.FindAsync(requisitionId);
        if (req == null || req.ClosedAt.HasValue || req.Status != ApprovalStatus.Approved)
            return;

        if (req.Vacancies < 1)
            return;

        var filledCount = await _db.Candidates.CountAsync(c =>
            c.RequisitionId == requisitionId
            && !c.IsDeleted
            && c.Stage.ToLower() == "hired");

        if (filledCount >= req.Vacancies)
            req.ClosedAt = DateTime.UtcNow;
    }

    private async Task SyncAutoCloseRequisitionsAsync(IReadOnlyList<Requisition> requisitions)
    {
        if (requisitions.Count == 0) return;

        foreach (var r in requisitions)
        {
            if (r.Status != ApprovalStatus.Approved || r.ClosedAt.HasValue)
                continue;
            await TryAutoCloseRequisitionIfFilledAsync(r.Id);
        }

        await _db.SaveChangesAsync();
        var ids = requisitions.Select(r => r.Id).ToList();
        var closedMap = await _db.Requisitions.AsNoTracking()
            .Where(r => ids.Contains(r.Id))
            .Select(r => new { r.Id, r.ClosedAt })
            .ToDictionaryAsync(x => x.Id, x => x.ClosedAt);
        foreach (var r in requisitions)
            r.ClosedAt = closedMap.GetValueOrDefault(r.Id);
    }

    private static string ResolveRequisitionDisplayStatus(Requisition r) =>
        r.ClosedAt.HasValue ? "Closed" : r.Status.ToString();

    private static void ValidateRequisitionRequiredFields(CreateRequisitionDto dto)
    {
        if (!dto.ExperienceMin.HasValue)
            throw new InvalidOperationException("Experience minimum (years) is required.");
        if (dto.ExperienceMin.Value < 0)
            throw new InvalidOperationException("Experience minimum cannot be negative.");
        if (NormalizeWorkLocation(dto.WorkLocation) is null)
            throw new InvalidOperationException("Location is required.");
        if (string.IsNullOrWhiteSpace(dto.Skills))
            throw new InvalidOperationException("At least one skill is required.");
    }

    private static RequisitionDto MapRequisition(Requisition r) => new()
    {
        Id = r.Id, Title = r.Title, Code = r.Code, Description = r.Description,
        Vacancies = r.Vacancies, Status = ResolveRequisitionDisplayStatus(r), TargetDate = r.TargetDate, Priority = r.Priority,
        EmploymentType = r.EmploymentType, ExperienceMin = r.ExperienceMin, ExperienceMax = r.ExperienceMax,
        SalaryMin = r.SalaryMin, SalaryMax = r.SalaryMax,
        SalaryCurrency = NormalizeSalaryCurrency(r.SalaryCurrency),
        Skills = r.Skills, ClosedAt = r.ClosedAt,
        DepartmentName = r.Department?.Name, DepartmentId = r.DepartmentId,
        JobTitleName = r.JobTitle?.Title, JobTitleId = r.JobTitleId,
        HiringManagerName = r.HiringManager != null ? r.HiringManager.FullName : null, HiringManagerId = r.HiringManagerId,
        LocationName = ResolveRequisitionLocationName(r), LocationId = r.LocationId,
        PositionTitle = r.Position?.Title, PositionId = r.PositionId,
        CandidateCount = r.Candidates?.Count ?? 0,
        BlockingCandidateCount = r.Candidates?.Count(CandidateBlocksRequisitionDeletion) ?? 0,
        CanDelete = !(r.Candidates?.Any(CandidateBlocksRequisitionDeletion) ?? false),
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
        SalaryCurrency = NormalizeSalaryCurrency(r.SalaryCurrency),
        Skills = r.Skills,
        DepartmentName = r.Department?.Name,
        DepartmentId = r.DepartmentId,
        JobTitleName = r.JobTitle?.Title,
        JobTitleId = r.JobTitleId,
        HiringManagerName = r.HiringManager != null ? r.HiringManager.FullName : null,
        HiringManagerId = r.HiringManagerId,
        LocationName = ResolveRequisitionLocationName(r),
        LocationId = r.LocationId,
        PositionTitle = r.Position?.Title,
        PositionId = r.PositionId,
        Timeline = DeserializeTimeline(r.RoleTimelineJson),
    };

    private CandidateDto MapCandidate(Candidate c) => new()
    {
        Id = c.Id, FirstName = c.FirstName, LastName = c.LastName, FullName = c.FullName,
        Email = c.Email, Phone = c.Phone, ResumeUrl = c.ResumeUrl, Source = c.Source, Stage = c.Stage,
        AppliedAt = AsStoredUtc(c.AppliedAt), CurrentTitle = c.CurrentTitle, CurrentCompany = c.CurrentCompany,
        ExpectedSalary = c.ExpectedSalary, NoticePeriod = c.NoticePeriod, Notes = c.Notes,
        Rating = c.Rating, RejectionReason = c.RejectionReason, Tags = c.Tags,
        RequisitionId = c.RequisitionId, RequisitionTitle = c.Requisition?.Title,
        EmployeeId = c.EmployeeId,
        HasUploadedResume = !string.IsNullOrWhiteSpace(c.ResumeUrl),
    };

    private static InterviewDto MapInterview(Interview i) => new()
    {
        Id = i.Id, Title = i.Title, ScheduledAt = AsStoredUtc(i.ScheduledAt), Duration = i.Duration,
        Location = i.Location, InterviewType = i.InterviewType, Status = i.Status,
        Feedback = i.Feedback, Result = i.Result, OverallRating = i.OverallRating,
        Recommendation = i.Recommendation,
        InterviewerName = i.Interviewer?.FullName ?? i.InterviewerName,
        InterviewerId = i.InterviewerId, CandidateId = i.CandidateId,
        CandidateName = i.Candidate != null ? i.Candidate.FullName : null,
        CandidateStage = i.Candidate?.Stage,
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
        LetterHtml = o.LetterHtml,
        AcceptedAt = o.AcceptedAt, RejectedAt = o.RejectedAt, RejectionReason = o.RejectionReason,
        CandidateId = o.CandidateId, CandidateName = o.Candidate?.FullName,
        PositionId = o.PositionId, JobTitleId = o.JobTitleId, DepartmentId = o.DepartmentId,
    };

    private static OfferHistoryDto MapOfferHistory(Offer o) => new()
    {
        Id = o.Id,
        CandidateId = o.CandidateId,
        CandidateName = o.Candidate?.FullName,
        RequisitionTitle = o.Candidate?.Requisition?.Title,
        PositionTitle = o.Position?.Title ?? o.JobTitle?.Title ?? o.Candidate?.Requisition?.Title,
        SalaryOffered = o.SalaryOffered,
        Currency = o.Currency,
        OfferDate = o.OfferDate,
        ExpiryDate = o.ExpiryDate,
        JoiningDate = o.JoiningDate,
        Status = o.Status.ToString(),
        AcceptedAt = o.AcceptedAt,
        RejectedAt = o.RejectedAt,
        RejectionReason = o.RejectionReason,
        HasLetter = !string.IsNullOrWhiteSpace(o.LetterHtml),
        UpdatedAt = o.UpdatedAt ?? o.CreatedAt,
    };
}

public static class ObjectExtensions
{
    public static TResult Let<T, TResult>(this T obj, Func<T, TResult> func) => func(obj);
}
