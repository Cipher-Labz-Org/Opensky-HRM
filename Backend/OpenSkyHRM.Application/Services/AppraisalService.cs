using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Appraisal;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AppraisalService : IAppraisalService
{
    private readonly AppDbContext _db;

    public AppraisalService(AppDbContext db) => _db = db;

    // ═══════════════════════════════════════════════════════════════
    //  RATING SCALES
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<RatingScaleDto>> GetRatingScalesAsync()
    {
        return await _db.RatingScales
            .Include(s => s.Items.OrderBy(i => i.Value))
            .OrderBy(s => s.Name)
            .Select(s => MapScale(s))
            .ToListAsync();
    }

    public async Task<RatingScaleDto> CreateRatingScaleAsync(CreateRatingScaleDto dto)
    {
        var entity = new RatingScale
        {
            Name = dto.Name,
            Description = dto.Description,
            IsDefault = dto.IsDefault,
        };
        foreach (var item in dto.Items)
            entity.Items.Add(new RatingScaleItem { Value = item.Value, Label = item.Label, Description = item.Description, Color = item.Color });

        if (dto.IsDefault)
            await ClearDefaultScaleAsync();

        _db.RatingScales.Add(entity);
        await _db.SaveChangesAsync();
        return MapScale(entity);
    }

    public async Task<RatingScaleDto?> UpdateRatingScaleAsync(Guid id, CreateRatingScaleDto dto)
    {
        var entity = await _db.RatingScales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return null;

        entity.Name = dto.Name;
        entity.Description = dto.Description;
        entity.IsDefault = dto.IsDefault;

        _db.RatingScaleItems.RemoveRange(entity.Items);
        foreach (var item in dto.Items)
            entity.Items.Add(new RatingScaleItem { Value = item.Value, Label = item.Label, Description = item.Description, Color = item.Color });

        if (dto.IsDefault) await ClearDefaultScaleAsync(id);

        await _db.SaveChangesAsync();
        return MapScale(entity);
    }

    public async Task<bool> DeleteRatingScaleAsync(Guid id)
    {
        var entity = await _db.RatingScales.FindAsync(id);
        if (entity is null) return false;
        var inUse = await _db.AppraisalTemplates.AnyAsync(t => t.RatingScaleId == id);
        if (inUse) throw new InvalidOperationException("Rating scale is in use by a template.");
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task ClearDefaultScaleAsync(Guid? excludeId = null)
    {
        var defaults = await _db.RatingScales.Where(s => s.IsDefault && (excludeId == null || s.Id != excludeId)).ToListAsync();
        foreach (var d in defaults) d.IsDefault = false;
    }

    private static RatingScaleDto MapScale(RatingScale s) => new()
    {
        Id = s.Id, Name = s.Name, Description = s.Description, IsDefault = s.IsDefault, IsActive = s.IsActive,
        Items = s.Items.OrderBy(i => i.Value).Select(i => new RatingScaleItemDto
        {
            Id = i.Id, Value = i.Value, Label = i.Label, Description = i.Description, Color = i.Color,
        }).ToList(),
    };

    // ═══════════════════════════════════════════════════════════════
    //  COMPETENCIES
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<CompetencyCategoryDto>> GetCompetencyCategoriesAsync()
    {
        return await _db.CompetencyCategories
            .Include(c => c.Competencies.OrderBy(x => x.SortOrder))
            .OrderBy(c => c.SortOrder)
            .Select(c => new CompetencyCategoryDto
            {
                Id = c.Id, Name = c.Name, Description = c.Description, SortOrder = c.SortOrder,
                Competencies = c.Competencies.Select(x => new CompetencyDto
                {
                    Id = x.Id, Name = x.Name, Description = x.Description, SortOrder = x.SortOrder,
                    CategoryId = c.Id, CategoryName = c.Name,
                }).ToList(),
            }).ToListAsync();
    }

    public async Task<CompetencyCategoryDto> CreateCompetencyCategoryAsync(CreateCompetencyCategoryDto dto)
    {
        var entity = new CompetencyCategory { Name = dto.Name, Description = dto.Description, SortOrder = dto.SortOrder };
        _db.CompetencyCategories.Add(entity);
        await _db.SaveChangesAsync();
        return new CompetencyCategoryDto { Id = entity.Id, Name = entity.Name, Description = entity.Description, SortOrder = entity.SortOrder };
    }

    public async Task<CompetencyCategoryDto?> UpdateCompetencyCategoryAsync(Guid id, CreateCompetencyCategoryDto dto)
    {
        var entity = await _db.CompetencyCategories.FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name; entity.Description = dto.Description; entity.SortOrder = dto.SortOrder;
        await _db.SaveChangesAsync();
        return new CompetencyCategoryDto { Id = entity.Id, Name = entity.Name, Description = entity.Description, SortOrder = entity.SortOrder };
    }

    public async Task<bool> DeleteCompetencyCategoryAsync(Guid id)
    {
        var entity = await _db.CompetencyCategories.FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<CompetencyDto> CreateCompetencyAsync(CreateCompetencyDto dto)
    {
        var entity = new Competency { Name = dto.Name, Description = dto.Description, SortOrder = dto.SortOrder, CategoryId = dto.CategoryId };
        _db.Competencies.Add(entity);
        await _db.SaveChangesAsync();
        var cat = await _db.CompetencyCategories.FindAsync(dto.CategoryId);
        return new CompetencyDto { Id = entity.Id, Name = entity.Name, Description = entity.Description, SortOrder = entity.SortOrder, CategoryId = dto.CategoryId, CategoryName = cat?.Name };
    }

    public async Task<CompetencyDto?> UpdateCompetencyAsync(Guid id, CreateCompetencyDto dto)
    {
        var entity = await _db.Competencies.FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name; entity.Description = dto.Description; entity.SortOrder = dto.SortOrder; entity.CategoryId = dto.CategoryId;
        await _db.SaveChangesAsync();
        var cat = await _db.CompetencyCategories.FindAsync(dto.CategoryId);
        return new CompetencyDto { Id = entity.Id, Name = entity.Name, Description = entity.Description, SortOrder = entity.SortOrder, CategoryId = dto.CategoryId, CategoryName = cat?.Name };
    }

    public async Task<bool> DeleteCompetencyAsync(Guid id)
    {
        var entity = await _db.Competencies.FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  APPRAISAL TEMPLATES
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<AppraisalTemplateDto>> GetTemplatesAsync()
    {
        return await _db.AppraisalTemplates
            .Include(t => t.RatingScale)
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .OrderBy(t => t.Name)
            .Select(t => MapTemplate(t))
            .ToListAsync();
    }

    public async Task<AppraisalTemplateDto?> GetTemplateByIdAsync(Guid id)
    {
        var t = await _db.AppraisalTemplates
            .Include(t => t.RatingScale).ThenInclude(r => r.Items)
            .Include(t => t.Sections.OrderBy(s => s.SortOrder))
                .ThenInclude(s => s.Items.OrderBy(i => i.SortOrder))
                    .ThenInclude(i => i.Competency)
            .FirstOrDefaultAsync(t => t.Id == id);
        return t is null ? null : MapTemplate(t);
    }

    public async Task<AppraisalTemplateDto> CreateTemplateAsync(CreateAppraisalTemplateDto dto)
    {
        var entity = new AppraisalTemplate { Name = dto.Name, Description = dto.Description, RatingScaleId = dto.RatingScaleId };
        foreach (var sec in dto.Sections)
        {
            var section = new AppraisalTemplateSection { Name = sec.Name, Description = sec.Description, Weight = sec.Weight, SortOrder = sec.SortOrder };
            foreach (var item in sec.Items)
                section.Items.Add(new AppraisalTemplateSectionItem { Name = item.Name, Description = item.Description, Weight = item.Weight, SortOrder = item.SortOrder, CompetencyId = item.CompetencyId });
            entity.Sections.Add(section);
        }
        _db.AppraisalTemplates.Add(entity);
        await _db.SaveChangesAsync();

        return (await GetTemplateByIdAsync(entity.Id))!;
    }

    public async Task<AppraisalTemplateDto?> UpdateTemplateAsync(Guid id, CreateAppraisalTemplateDto dto)
    {
        var entity = await _db.AppraisalTemplates
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null) return null;

        entity.Name = dto.Name; entity.Description = dto.Description; entity.RatingScaleId = dto.RatingScaleId;

        foreach (var s in entity.Sections.ToList())
        {
            _db.AppraisalTemplateSectionItems.RemoveRange(s.Items);
            _db.AppraisalTemplateSections.Remove(s);
        }

        foreach (var sec in dto.Sections)
        {
            var section = new AppraisalTemplateSection { Name = sec.Name, Description = sec.Description, Weight = sec.Weight, SortOrder = sec.SortOrder };
            foreach (var item in sec.Items)
                section.Items.Add(new AppraisalTemplateSectionItem { Name = item.Name, Description = item.Description, Weight = item.Weight, SortOrder = item.SortOrder, CompetencyId = item.CompetencyId });
            entity.Sections.Add(section);
        }

        await _db.SaveChangesAsync();
        return await GetTemplateByIdAsync(id);
    }

    public async Task<bool> DeleteTemplateAsync(Guid id)
    {
        var entity = await _db.AppraisalTemplates.FindAsync(id);
        if (entity is null) return false;
        var inUse = await _db.AppraisalCycles.AnyAsync(c => c.TemplateId == id);
        if (inUse) throw new InvalidOperationException("Template is in use by an appraisal cycle.");
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    private static AppraisalTemplateDto MapTemplate(AppraisalTemplate t) => new()
    {
        Id = t.Id, Name = t.Name, Description = t.Description, IsActive = t.IsActive,
        RatingScaleId = t.RatingScaleId, RatingScaleName = t.RatingScale?.Name,
        SectionCount = t.Sections.Count,
        Sections = t.Sections.OrderBy(s => s.SortOrder).Select(s => new AppraisalTemplateSectionDto
        {
            Id = s.Id, Name = s.Name, Description = s.Description, Weight = s.Weight, SortOrder = s.SortOrder,
            Items = s.Items.OrderBy(i => i.SortOrder).Select(i => new AppraisalTemplateSectionItemDto
            {
                Id = i.Id, Name = i.Name, Description = i.Description, Weight = i.Weight, SortOrder = i.SortOrder,
                CompetencyId = i.CompetencyId, CompetencyName = i.Competency?.Name,
            }).ToList(),
        }).ToList(),
    };

    // ═══════════════════════════════════════════════════════════════
    //  APPRAISAL CYCLES
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<AppraisalCycleDto>> GetCyclesAsync()
    {
        var cycles = await _db.AppraisalCycles
            .Include(c => c.Template)
            .Include(c => c.Appraisals)
            .OrderByDescending(c => c.StartDate)
            .ToListAsync();

        return cycles.Select(MapCycle).ToList();
    }

    public async Task<AppraisalCycleDto?> GetCycleByIdAsync(Guid id)
    {
        var c = await _db.AppraisalCycles
            .Include(c => c.Template)
            .Include(c => c.Appraisals)
            .FirstOrDefaultAsync(c => c.Id == id);
        return c is null ? null : MapCycle(c);
    }

    public async Task<AppraisalCycleDto> CreateCycleAsync(CreateAppraisalCycleDto dto)
    {
        var entity = new AppraisalCycle
        {
            Name = dto.Name, Description = dto.Description, CycleType = dto.CycleType,
            StartDate = dto.StartDate, EndDate = dto.EndDate,
            IncludeSelfAssessment = dto.IncludeSelfAssessment, IncludeManagerReview = dto.IncludeManagerReview,
            IncludePeerReview = dto.IncludePeerReview, IncludeDirectReportReview = dto.IncludeDirectReportReview,
            IncludeExternalReview = dto.IncludeExternalReview, IncludeGoals = dto.IncludeGoals,
            SelfWeight = dto.SelfWeight, ManagerWeight = dto.ManagerWeight,
            PeerWeight = dto.PeerWeight, DirectReportWeight = dto.DirectReportWeight, ExternalWeight = dto.ExternalWeight,
            SelfDeadline = dto.SelfDeadline, ManagerDeadline = dto.ManagerDeadline,
            PeerDeadline = dto.PeerDeadline, CompletionDeadline = dto.CompletionDeadline,
            TemplateId = dto.TemplateId,
        };
        _db.AppraisalCycles.Add(entity);
        await _db.SaveChangesAsync();
        return (await GetCycleByIdAsync(entity.Id))!;
    }

    public async Task<AppraisalCycleDto?> UpdateCycleAsync(Guid id, CreateAppraisalCycleDto dto)
    {
        var entity = await _db.AppraisalCycles.FindAsync(id);
        if (entity is null) return null;
        if (entity.Phase != "Draft") throw new InvalidOperationException("Can only edit cycles in Draft phase.");

        entity.Name = dto.Name; entity.Description = dto.Description; entity.CycleType = dto.CycleType;
        entity.StartDate = dto.StartDate; entity.EndDate = dto.EndDate;
        entity.IncludeSelfAssessment = dto.IncludeSelfAssessment; entity.IncludeManagerReview = dto.IncludeManagerReview;
        entity.IncludePeerReview = dto.IncludePeerReview; entity.IncludeDirectReportReview = dto.IncludeDirectReportReview;
        entity.IncludeExternalReview = dto.IncludeExternalReview; entity.IncludeGoals = dto.IncludeGoals;
        entity.SelfWeight = dto.SelfWeight; entity.ManagerWeight = dto.ManagerWeight;
        entity.PeerWeight = dto.PeerWeight; entity.DirectReportWeight = dto.DirectReportWeight; entity.ExternalWeight = dto.ExternalWeight;
        entity.SelfDeadline = dto.SelfDeadline; entity.ManagerDeadline = dto.ManagerDeadline;
        entity.PeerDeadline = dto.PeerDeadline; entity.CompletionDeadline = dto.CompletionDeadline;
        entity.TemplateId = dto.TemplateId;

        await _db.SaveChangesAsync();
        return await GetCycleByIdAsync(id);
    }

    public async Task<bool> DeleteCycleAsync(Guid id)
    {
        var entity = await _db.AppraisalCycles.FindAsync(id);
        if (entity is null) return false;
        if (entity.Phase != "Draft") throw new InvalidOperationException("Can only delete cycles in Draft phase.");
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<AppraisalCycleDto?> ActivateCycleAsync(Guid id)
    {
        var cycle = await _db.AppraisalCycles.FindAsync(id);
        if (cycle is null) return null;
        if (cycle.Phase != "Draft") throw new InvalidOperationException("Cycle is not in Draft phase.");

        var employeeIds = await _db.Employees
            .Where(e => e.Status != "Terminated")
            .Select(e => e.Id)
            .ToListAsync();

        var supervisorMap = await _db.EmployeeSupervisors
            .Where(s => !s.IsDeleted && s.ReportingMethod == "Direct")
            .ToDictionaryAsync(s => s.EmployeeId, s => s.SupervisorId);

        foreach (var empId in employeeIds)
        {
            var appraisal = new Appraisal { EmployeeId = empId, CycleId = id, Status = "SelfAssessment" };
            _db.Appraisals.Add(appraisal);

            if (cycle.IncludeSelfAssessment)
                _db.AppraisalReviewers.Add(new AppraisalReviewer
                {
                    AppraisalId = appraisal.Id, ReviewerType = "Self", ReviewerEmployeeId = empId
                });

            if (cycle.IncludeManagerReview && supervisorMap.TryGetValue(empId, out var supId))
                _db.AppraisalReviewers.Add(new AppraisalReviewer
                {
                    AppraisalId = appraisal.Id, ReviewerType = "Manager", ReviewerEmployeeId = supId
                });
        }

        cycle.Phase = "SelfAssessment";
        await _db.SaveChangesAsync();
        return await GetCycleByIdAsync(id);
    }

    public async Task<AppraisalCycleDto?> AdvancePhaseAsync(Guid id)
    {
        var cycle = await _db.AppraisalCycles.FindAsync(id);
        if (cycle is null) return null;

        var phases = new[] { "Draft", "SelfAssessment", "ManagerReview", "PeerReview", "Calibration", "Acknowledgement", "Completed" };
        var idx = Array.IndexOf(phases, cycle.Phase);
        if (idx < 0 || idx >= phases.Length - 1) throw new InvalidOperationException("Cannot advance further.");

        var nextPhase = phases[idx + 1];

        if (nextPhase == "PeerReview" && !cycle.IncludePeerReview)
            nextPhase = "Calibration";

        cycle.Phase = nextPhase;

        if (nextPhase == "Completed")
        {
            var appraisals = await _db.Appraisals
                .Include(a => a.Reviewers).ThenInclude(r => r.ResponseItems)
                .Where(a => a.CycleId == id)
                .ToListAsync();

            foreach (var appraisal in appraisals)
            {
                appraisal.Status = "Completed";
                if (appraisal.FinalRating == null)
                    appraisal.FinalRating = ComputeConsolidatedRating(appraisal, cycle);
            }
        }
        else
        {
            var appraisals = await _db.Appraisals.Where(a => a.CycleId == id).ToListAsync();
            foreach (var a in appraisals)
                a.Status = nextPhase;
        }

        await _db.SaveChangesAsync();
        return await GetCycleByIdAsync(id);
    }

    public async Task<AppraisalCycleDashboardDto?> GetCycleDashboardAsync(Guid id)
    {
        var cycle = await _db.AppraisalCycles
            .Include(c => c.Template)
            .Include(c => c.Appraisals).ThenInclude(a => a.Reviewers)
            .Include(c => c.Appraisals).ThenInclude(a => a.Employee).ThenInclude(e => e.Department)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (cycle is null) return null;

        var scale = await _db.RatingScales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == cycle.Template.RatingScaleId);

        var dto = new AppraisalCycleDashboardDto
        {
            Cycle = MapCycle(cycle),
            TotalEmployees = cycle.Appraisals.Count,
            SelfCompleted = cycle.Appraisals.Count(a => a.Reviewers.Any(r => r.ReviewerType == "Self" && r.Status == "Submitted")),
            ManagerCompleted = cycle.Appraisals.Count(a => a.Reviewers.Any(r => r.ReviewerType == "Manager" && r.Status == "Submitted")),
            PeerCompleted = cycle.Appraisals.Count(a => a.Reviewers.Any(r => r.ReviewerType == "Peer" && r.Status == "Submitted")),
            FullyCompleted = cycle.Appraisals.Count(a => a.Status == "Completed"),
            Acknowledged = cycle.Appraisals.Count(a => a.AcknowledgedAt != null),
        };

        if (scale != null)
        {
            dto.RatingDistribution = scale.Items.OrderBy(i => i.Value).Select(i => new RatingDistributionDto
            {
                Label = i.Label,
                Count = cycle.Appraisals.Count(a => a.FinalRating.HasValue && Math.Round(a.FinalRating.Value) == i.Value),
            }).ToList();
        }

        dto.DepartmentProgress = cycle.Appraisals
            .GroupBy(a => a.Employee.Department?.Name ?? "Unknown")
            .Select(g => new DepartmentProgressDto
            {
                Department = g.Key,
                Total = g.Count(),
                Completed = g.Count(a => a.Status == "Completed"),
                AverageRating = g.Where(a => a.FinalRating.HasValue).Select(a => a.FinalRating!.Value).DefaultIfEmpty(0).Average(),
            }).OrderBy(d => d.Department).ToList();

        return dto;
    }

    private static AppraisalCycleDto MapCycle(AppraisalCycle c) => new()
    {
        Id = c.Id, Name = c.Name, Description = c.Description, CycleType = c.CycleType,
        StartDate = c.StartDate, EndDate = c.EndDate, Phase = c.Phase,
        IncludeSelfAssessment = c.IncludeSelfAssessment, IncludeManagerReview = c.IncludeManagerReview,
        IncludePeerReview = c.IncludePeerReview, IncludeDirectReportReview = c.IncludeDirectReportReview,
        IncludeExternalReview = c.IncludeExternalReview, IncludeGoals = c.IncludeGoals,
        SelfWeight = c.SelfWeight, ManagerWeight = c.ManagerWeight,
        PeerWeight = c.PeerWeight, DirectReportWeight = c.DirectReportWeight, ExternalWeight = c.ExternalWeight,
        SelfDeadline = c.SelfDeadline, ManagerDeadline = c.ManagerDeadline,
        PeerDeadline = c.PeerDeadline, CompletionDeadline = c.CompletionDeadline,
        TemplateId = c.TemplateId, TemplateName = c.Template?.Name,
        TotalAppraisals = c.Appraisals?.Count ?? 0,
        CompletedAppraisals = c.Appraisals?.Count(a => a.Status == "Completed") ?? 0,
    };

    // ═══════════════════════════════════════════════════════════════
    //  APPRAISALS (per-employee)
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<AppraisalDto>> GetAppraisalsForCycleAsync(Guid cycleId)
    {
        var list = await _db.Appraisals
            .Include(a => a.Employee).ThenInclude(e => e.Department)
            .Include(a => a.Employee).ThenInclude(e => e.Position)
            .Include(a => a.Cycle)
            .Include(a => a.Reviewers).ThenInclude(r => r.ReviewerEmployee)
            .Where(a => a.CycleId == cycleId)
            .OrderBy(a => a.Employee.FirstName)
            .ToListAsync();
        return list.Select(MapAppraisal).ToList();
    }

    public async Task<AppraisalDto?> GetAppraisalByIdAsync(Guid id)
    {
        var a = await _db.Appraisals
            .Include(a => a.Employee).ThenInclude(e => e.Department)
            .Include(a => a.Employee).ThenInclude(e => e.Position)
            .Include(a => a.Cycle)
            .Include(a => a.Reviewers).ThenInclude(r => r.ReviewerEmployee)
            .Include(a => a.Reviewers).ThenInclude(r => r.ResponseItems).ThenInclude(ri => ri.TemplateSectionItem).ThenInclude(si => si.Section)
            .FirstOrDefaultAsync(a => a.Id == id);
        return a is null ? null : MapAppraisal(a);
    }

    public async Task<AppraisalFormDto?> GetAppraisalFormAsync(Guid appraisalId, Guid reviewerId)
    {
        var reviewer = await _db.AppraisalReviewers
            .Include(r => r.ResponseItems)
            .Include(r => r.Appraisal).ThenInclude(a => a.Employee)
            .Include(r => r.Appraisal).ThenInclude(a => a.Cycle).ThenInclude(c => c.Template)
                .ThenInclude(t => t.Sections.OrderBy(s => s.SortOrder))
                .ThenInclude(s => s.Items.OrderBy(i => i.SortOrder))
            .FirstOrDefaultAsync(r => r.Id == reviewerId && r.AppraisalId == appraisalId);

        if (reviewer is null) return null;

        var scale = await _db.RatingScales.Include(s => s.Items.OrderBy(i => i.Value))
            .FirstOrDefaultAsync(s => s.Id == reviewer.Appraisal.Cycle.Template.RatingScaleId);

        AppraisalReviewer? selfReviewer = null;
        if (reviewer.ReviewerType != "Self")
        {
            selfReviewer = await _db.AppraisalReviewers
                .Include(r => r.ResponseItems)
                .FirstOrDefaultAsync(r => r.AppraisalId == appraisalId && r.ReviewerType == "Self");
        }

        var template = reviewer.Appraisal.Cycle.Template;
        var form = new AppraisalFormDto
        {
            AppraisalId = appraisalId,
            ReviewerId = reviewerId,
            ReviewerType = reviewer.ReviewerType,
            EmployeeName = reviewer.Appraisal.Employee.FullName,
            CycleName = reviewer.Appraisal.Cycle.Name,
            RatingScale = scale != null ? MapScale(scale) : new RatingScaleDto(),
            Sections = template.Sections.OrderBy(s => s.SortOrder).Select(sec => new AppraisalFormSectionDto
            {
                SectionId = sec.Id, Name = sec.Name, Description = sec.Description, Weight = sec.Weight,
                Items = sec.Items.OrderBy(i => i.SortOrder).Select(item => new AppraisalFormItemDto
                {
                    TemplateSectionItemId = item.Id, Name = item.Name, Description = item.Description, Weight = item.Weight,
                    CurrentRating = reviewer.ResponseItems.FirstOrDefault(ri => ri.TemplateSectionItemId == item.Id)?.RatingValue,
                    CurrentComment = reviewer.ResponseItems.FirstOrDefault(ri => ri.TemplateSectionItemId == item.Id)?.Comment,
                    SelfRating = selfReviewer?.ResponseItems.FirstOrDefault(ri => ri.TemplateSectionItemId == item.Id)?.RatingValue,
                }).ToList(),
            }).ToList(),
        };

        if (reviewer.Appraisal.Cycle.IncludeGoals)
        {
            var goals = await _db.Goals
                .Where(g => g.EmployeeId == reviewer.Appraisal.EmployeeId && (g.AppraisalCycleId == reviewer.Appraisal.CycleId || g.AppraisalCycleId == null))
                .OrderBy(g => g.Title)
                .ToListAsync();

            form.Goals = goals.Select(g => new AppraisalGoalDto
            {
                GoalId = g.Id, Title = g.Title, Description = g.Description,
                Weight = g.Weight, Progress = g.Progress, Status = g.Status,
                SelfRating = g.SelfRating, ManagerRating = g.ManagerRating,
            }).ToList();
        }

        return form;
    }

    public async Task<bool> SubmitAppraisalAsync(Guid appraisalId, Guid reviewerId, SubmitAppraisalDto dto)
    {
        var reviewer = await _db.AppraisalReviewers
            .Include(r => r.ResponseItems)
            .FirstOrDefaultAsync(r => r.Id == reviewerId && r.AppraisalId == appraisalId);
        if (reviewer is null) return false;

        _db.AppraisalResponseItems.RemoveRange(reviewer.ResponseItems);
        foreach (var rating in dto.Ratings)
        {
            reviewer.ResponseItems.Add(new AppraisalResponseItem
            {
                TemplateSectionItemId = rating.TemplateSectionItemId,
                RatingValue = rating.RatingValue,
                Comment = rating.Comment,
            });
        }

        reviewer.OverallComments = dto.OverallComments;

        if (dto.GoalRatings != null)
        {
            foreach (var gr in dto.GoalRatings)
            {
                var goal = await _db.Goals.FindAsync(gr.GoalId);
                if (goal != null)
                {
                    if (reviewer.ReviewerType == "Self") goal.SelfRating = gr.Rating;
                    else if (reviewer.ReviewerType == "Manager") goal.ManagerRating = gr.Rating;
                }
            }
        }

        if (dto.IsFinal)
        {
            reviewer.Status = "Submitted";
            reviewer.SubmittedAt = DateTime.UtcNow;

            var totalWeight = reviewer.ResponseItems.Sum(ri => ri.RatingValue.HasValue ? 1 : 0);
            if (totalWeight > 0)
                reviewer.OverallRating = (decimal)reviewer.ResponseItems.Where(ri => ri.RatingValue.HasValue).Average(ri => ri.RatingValue!.Value);
        }
        else
        {
            reviewer.Status = "InProgress";
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AddReviewerAsync(Guid appraisalId, AddReviewerDto dto)
    {
        var appraisal = await _db.Appraisals.FindAsync(appraisalId);
        if (appraisal is null) return false;

        var exists = await _db.AppraisalReviewers.AnyAsync(r =>
            r.AppraisalId == appraisalId && r.ReviewerEmployeeId == dto.EmployeeId && r.ReviewerType == dto.ReviewerType);
        if (exists) return true;

        _db.AppraisalReviewers.Add(new AppraisalReviewer
        {
            AppraisalId = appraisalId,
            ReviewerEmployeeId = dto.EmployeeId,
            ReviewerType = dto.ReviewerType,
        });
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveReviewerAsync(Guid reviewerId)
    {
        var reviewer = await _db.AppraisalReviewers.FindAsync(reviewerId);
        if (reviewer is null) return false;
        if (reviewer.ReviewerType is "Self" or "Manager") throw new InvalidOperationException("Cannot remove Self or Manager reviewer.");
        reviewer.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CalibrateAsync(Guid appraisalId, CalibrateAppraisalDto dto)
    {
        var appraisal = await _db.Appraisals.FindAsync(appraisalId);
        if (appraisal is null) return false;
        appraisal.FinalRating = dto.FinalRating;
        appraisal.FinalComments = dto.Comments;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AcknowledgeAsync(Guid appraisalId, AcknowledgeAppraisalDto dto)
    {
        var appraisal = await _db.Appraisals.FindAsync(appraisalId);
        if (appraisal is null) return false;
        appraisal.AcknowledgedAt = DateTime.UtcNow;
        appraisal.AcknowledgementComment = dto.Comment;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<AppraisalDto>> GetMyAppraisalsAsync(Guid employeeId)
    {
        var list = await _db.Appraisals
            .Include(a => a.Employee).ThenInclude(e => e.Department)
            .Include(a => a.Cycle)
            .Include(a => a.Reviewers).ThenInclude(r => r.ReviewerEmployee)
            .Where(a => a.EmployeeId == employeeId)
            .OrderByDescending(a => a.Cycle.StartDate)
            .ToListAsync();
        return list.Select(MapAppraisal).ToList();
    }

    public async Task<List<AppraisalDto>> GetMyReviewTasksAsync(Guid employeeId)
    {
        var reviewerRecords = await _db.AppraisalReviewers
            .Include(r => r.Appraisal).ThenInclude(a => a.Employee).ThenInclude(e => e.Department)
            .Include(r => r.Appraisal).ThenInclude(a => a.Cycle)
            .Include(r => r.Appraisal).ThenInclude(a => a.Reviewers).ThenInclude(r2 => r2.ReviewerEmployee)
            .Where(r => r.ReviewerEmployeeId == employeeId && r.Status != "Submitted")
            .OrderByDescending(r => r.Appraisal.Cycle.StartDate)
            .ToListAsync();

        return reviewerRecords.Select(r => MapAppraisal(r.Appraisal)).Distinct().ToList();
    }

    private static AppraisalDto MapAppraisal(Appraisal a) => new()
    {
        Id = a.Id, Status = a.Status, FinalRating = a.FinalRating,
        FinalComments = a.FinalComments, AcknowledgedAt = a.AcknowledgedAt,
        AcknowledgementComment = a.AcknowledgementComment,
        EmployeeId = a.EmployeeId, EmployeeName = a.Employee?.FullName ?? "",
        EmployeeCode = a.Employee?.EmployeeCode, DepartmentName = a.Employee?.Department?.Name,
        PositionName = a.Employee?.Position?.Title,
        CycleId = a.CycleId, CycleName = a.Cycle?.Name ?? "",
        Reviewers = a.Reviewers?.Select(r => new AppraisalReviewerDto
        {
            Id = r.Id, ReviewerType = r.ReviewerType, Status = r.Status,
            OverallRating = r.OverallRating, OverallComments = r.OverallComments, SubmittedAt = r.SubmittedAt,
            ReviewerEmployeeId = r.ReviewerEmployeeId, ReviewerName = r.ReviewerEmployee?.FullName ?? "",
            ResponseItems = r.ResponseItems?.Select(ri => new AppraisalResponseItemDto
            {
                Id = ri.Id, RatingValue = ri.RatingValue, Comment = ri.Comment,
                TemplateSectionItemId = ri.TemplateSectionItemId,
                ItemName = ri.TemplateSectionItem?.Name, SectionName = ri.TemplateSectionItem?.Section?.Name,
            }).ToList() ?? new(),
        }).ToList() ?? new(),
    };

    private static decimal ComputeConsolidatedRating(Appraisal appraisal, AppraisalCycle cycle)
    {
        decimal totalWeightedRating = 0;
        int totalWeight = 0;

        foreach (var reviewer in appraisal.Reviewers.Where(r => r.OverallRating.HasValue))
        {
            int weight = reviewer.ReviewerType switch
            {
                "Self" => cycle.SelfWeight,
                "Manager" => cycle.ManagerWeight,
                "Peer" => cycle.PeerWeight,
                "DirectReport" => cycle.DirectReportWeight,
                "External" => cycle.ExternalWeight,
                _ => 0,
            };
            totalWeightedRating += reviewer.OverallRating!.Value * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? Math.Round(totalWeightedRating / totalWeight, 2) : 0;
    }
}
