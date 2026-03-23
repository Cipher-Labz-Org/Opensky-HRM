using Microsoft.EntityFrameworkCore;
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
    public RecruitmentService(AppDbContext db, ISystemSettingService settings) { _db = db; _settings = settings; }

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

    public async Task<RequisitionDto> CreateRequisitionAsync(CreateRequisitionDto dto)
    {
        var req = new Requisition
        {
            Title = dto.Title, Code = dto.Code, Description = dto.Description, Vacancies = dto.Vacancies,
            TargetDate = dto.TargetDate, Priority = dto.Priority, EmploymentType = dto.EmploymentType,
            ExperienceMin = dto.ExperienceMin, ExperienceMax = dto.ExperienceMax,
            SalaryMin = dto.SalaryMin, SalaryMax = dto.SalaryMax, Skills = dto.Skills,
            DepartmentId = dto.DepartmentId, JobTitleId = dto.JobTitleId,
            HiringManagerId = dto.HiringManagerId, LocationId = dto.LocationId, PositionId = dto.PositionId,
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
        req.Status = ApprovalStatus.Approved;
        await _db.SaveChangesAsync();
        return (await GetRequisitionByIdAsync(id))!;
    }

    public async Task<RequisitionDto> CloseRequisitionAsync(Guid id)
    {
        var req = await _db.Requisitions.FindAsync(id)
            ?? throw new InvalidOperationException("Requisition not found");
        req.Status = ApprovalStatus.Approved;
        req.ClosedAt = DateTime.UtcNow;
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
        var items = await query.OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => MapCandidate(c))
            .ToListAsync();

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

        return new CandidateDetailDto
        {
            Id = c.Id, FirstName = c.FirstName, LastName = c.LastName, FullName = c.FullName,
            Email = c.Email, Phone = c.Phone, ResumeUrl = c.ResumeUrl, Source = c.Source, Stage = c.Stage,
            AppliedAt = c.AppliedAt, CurrentTitle = c.CurrentTitle, CurrentCompany = c.CurrentCompany,
            ExpectedSalary = c.ExpectedSalary, NoticePeriod = c.NoticePeriod, Notes = c.Notes,
            Rating = c.Rating, RejectionReason = c.RejectionReason, Tags = c.Tags,
            RequisitionId = c.RequisitionId, RequisitionTitle = c.Requisition?.Title,
            EmployeeId = c.EmployeeId,
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

    public async Task<Guid> HireCandidateAsync(Guid id)
    {
        var c = await _db.Candidates
            .Include(x => x.Requisition)
            .Include(x => x.Offer)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Candidate not found");

        if (c.Stage != "Hired" && c.Stage != "Offer")
            throw new InvalidOperationException("Candidate must be in Offer or Hired stage to convert");

        var employee = new Employee
        {
            FirstName = c.FirstName,
            LastName = c.LastName,
            Email = c.Email,
            Phone = c.Phone,
            DepartmentId = c.Offer?.DepartmentId ?? c.Requisition.DepartmentId,
            PositionId = c.Offer?.PositionId ?? c.Requisition.PositionId,
            JobTitleId = c.Offer?.JobTitleId ?? c.Requisition.JobTitleId,
            JoinDate = c.Offer?.JoiningDate ?? DateTime.UtcNow,
            DateOfBirth = DateTime.UtcNow.AddYears(-25),
            Status = "FullTimePermanent",
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
        await _db.SaveChangesAsync();
        return employee.Id;
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

        return (await _db.Interviews
            .Include(i => i.Interviewer).Include(i => i.Scorecards).Include(i => i.Candidate)
            .FirstAsync(i => i.Id == interview.Id))
            .Let(MapInterview);
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
        offer.Status = ApprovalStatus.Approved;
        LogActivity(offer.CandidateId, "OfferSent", "Offer approved");
        await _db.SaveChangesAsync();
        return MapOffer(offer);
    }

    public async Task<OfferDto> AcceptOfferAsync(Guid id)
    {
        var offer = await _db.Offers.Include(o => o.Candidate).FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new InvalidOperationException("Offer not found");
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
    };

    private static CandidateDto MapCandidate(Candidate c) => new()
    {
        Id = c.Id, FirstName = c.FirstName, LastName = c.LastName, FullName = c.FullName,
        Email = c.Email, Phone = c.Phone, ResumeUrl = c.ResumeUrl, Source = c.Source, Stage = c.Stage,
        AppliedAt = c.AppliedAt, CurrentTitle = c.CurrentTitle, CurrentCompany = c.CurrentCompany,
        ExpectedSalary = c.ExpectedSalary, NoticePeriod = c.NoticePeriod, Notes = c.Notes,
        Rating = c.Rating, RejectionReason = c.RejectionReason, Tags = c.Tags,
        RequisitionId = c.RequisitionId, RequisitionTitle = c.Requisition?.Title,
        EmployeeId = c.EmployeeId,
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
