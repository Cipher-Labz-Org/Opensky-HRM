using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Idempotent sample data for Performance Appraisal (rating scales, competencies, templates, cycles).
/// </summary>
public static class AppraisalDevSeeder
{
    public static async Task EnsureSampleDataAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        if (!await db.AppraisalCycles.AnyAsync(cancellationToken))
            await EnsureCatalogAndCyclesAsync(db, cancellationToken);

        if (await db.Appraisals.AnyAsync(cancellationToken))
            return;

        await EnsureAppraisalsAsync(db, cancellationToken);
    }

    private static async Task EnsureCatalogAndCyclesAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var scale = new RatingScale
        {
            Name = "5-Point Performance Scale",
            Description = "Standard annual performance rating scale",
            IsDefault = true,
            IsActive = true,
            Items =
            {
                new RatingScaleItem { Value = 1, Label = "Needs Improvement", Description = "Below expectations", Color = "#ef4444" },
                new RatingScaleItem { Value = 2, Label = "Developing", Description = "Partially meets expectations", Color = "#f97316" },
                new RatingScaleItem { Value = 3, Label = "Meets Expectations", Description = "Consistently meets expectations", Color = "#eab308" },
                new RatingScaleItem { Value = 4, Label = "Exceeds Expectations", Description = "Often exceeds expectations", Color = "#22c55e" },
                new RatingScaleItem { Value = 5, Label = "Outstanding", Description = "Exceptional performance", Color = "#3b82f6" },
            },
        };
        db.RatingScales.Add(scale);

        var coreValues = new CompetencyCategory
        {
            Name = "Core Values",
            Description = "Behaviours aligned with company culture",
            SortOrder = 1,
            Competencies =
            {
                new Competency { Name = "Integrity", Description = "Acts ethically and transparently", SortOrder = 1 },
                new Competency { Name = "Teamwork", Description = "Collaborates effectively across teams", SortOrder = 2 },
                new Competency { Name = "Customer Focus", Description = "Prioritises customer outcomes", SortOrder = 3 },
            },
        };
        var technical = new CompetencyCategory
        {
            Name = "Technical Skills",
            Description = "Role-specific expertise and delivery",
            SortOrder = 2,
            Competencies =
            {
                new Competency { Name = "Job Knowledge", Description = "Understands role requirements", SortOrder = 1 },
                new Competency { Name = "Quality of Work", Description = "Produces accurate, reliable output", SortOrder = 2 },
                new Competency { Name = "Problem Solving", Description = "Resolves issues independently", SortOrder = 3 },
            },
        };
        var leadership = new CompetencyCategory
        {
            Name = "Leadership",
            Description = "Influence, coaching, and accountability",
            SortOrder = 3,
            Competencies =
            {
                new Competency { Name = "Communication", Description = "Clear verbal and written communication", SortOrder = 1 },
                new Competency { Name = "Decision Making", Description = "Makes timely, informed decisions", SortOrder = 2 },
            },
        };
        db.CompetencyCategories.AddRange(coreValues, technical, leadership);
        await db.SaveChangesAsync(cancellationToken);

        var allCompetencies = coreValues.Competencies.Concat(technical.Competencies).Concat(leadership.Competencies).ToList();

        var template = new AppraisalTemplate
        {
            Name = "Standard Annual Appraisal",
            Description = "Default template for annual and mid-year reviews",
            IsActive = true,
            RatingScaleId = scale.Id,
            Sections =
            {
                new AppraisalTemplateSection
                {
                    Name = "Core Competencies",
                    Description = "Values and behaviours",
                    Weight = 40,
                    SortOrder = 1,
                    Items =
                    {
                        Item("Integrity", 34, 1, allCompetencies[0].Id),
                        Item("Teamwork", 33, 2, allCompetencies[1].Id),
                        Item("Customer Focus", 33, 3, allCompetencies[2].Id),
                    },
                },
                new AppraisalTemplateSection
                {
                    Name = "Role Performance",
                    Description = "Delivery and technical contribution",
                    Weight = 60,
                    SortOrder = 2,
                    Items =
                    {
                        Item("Job Knowledge", 34, 1, allCompetencies[3].Id),
                        Item("Quality of Work", 33, 2, allCompetencies[4].Id),
                        Item("Problem Solving", 33, 3, allCompetencies[5].Id),
                    },
                },
            },
        };
        db.AppraisalTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);

        var now = DateTime.UtcNow.Date;

        db.AppraisalCycles.Add(new AppraisalCycle
        {
            Name = "2025 Annual Performance Review",
            Description = "Company-wide annual review cycle (completed sample data)",
            CycleType = "Annual",
            StartDate = new DateTime(now.Year - 1, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(now.Year - 1, 12, 31, 0, 0, 0, DateTimeKind.Utc),
            Phase = "Completed",
            IncludeSelfAssessment = true,
            IncludeManagerReview = true,
            IncludePeerReview = false,
            IncludeGoals = true,
            SelfWeight = 10,
            ManagerWeight = 90,
            SelfDeadline = new DateTime(now.Year - 1, 3, 31, 0, 0, 0, DateTimeKind.Utc),
            ManagerDeadline = new DateTime(now.Year - 1, 4, 30, 0, 0, 0, DateTimeKind.Utc),
            CompletionDeadline = new DateTime(now.Year - 1, 5, 15, 0, 0, 0, DateTimeKind.Utc),
            TemplateId = template.Id,
        });

        db.AppraisalCycles.Add(new AppraisalCycle
        {
            Name = "2026 Mid-Year Review",
            Description = "Active mid-year review cycle with in-progress appraisals",
            CycleType = "MidYear",
            StartDate = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(now.Year, 6, 30, 0, 0, 0, DateTimeKind.Utc),
            Phase = "ManagerReview",
            IncludeSelfAssessment = true,
            IncludeManagerReview = true,
            IncludePeerReview = false,
            IncludeGoals = true,
            SelfWeight = 20,
            ManagerWeight = 80,
            SelfDeadline = new DateTime(now.Year, 4, 15, 0, 0, 0, DateTimeKind.Utc),
            ManagerDeadline = new DateTime(now.Year, 5, 31, 0, 0, 0, DateTimeKind.Utc),
            CompletionDeadline = new DateTime(now.Year, 6, 15, 0, 0, 0, DateTimeKind.Utc),
            TemplateId = template.Id,
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureAppraisalsAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await EnsureSupervisorsFromManagersAsync(db, cancellationToken);

        var employees = await db.Employees
            .Where(e => e.Status != "Terminated")
            .OrderBy(e => e.EmployeeCode)
            .Take(12)
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
            return;

        var cycles = await db.AppraisalCycles
            .Where(c => !c.IsDeleted)
            .OrderBy(c => c.StartDate)
            .ToListAsync(cancellationToken);

        if (cycles.Count == 0)
            return;

        var supervisorMap = await BuildSupervisorMapAsync(db, cancellationToken);

        foreach (var cycle in cycles)
        {
            var completed = cycle.Phase == "Completed";
            SeedAppraisals(db, cycle, employees, supervisorMap, completed);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static AppraisalTemplateSectionItem Item(string name, int weight, int sortOrder, Guid competencyId) =>
        new()
        {
            Name = name,
            Description = null,
            Weight = weight,
            SortOrder = sortOrder,
            CompetencyId = competencyId,
        };

    private static async Task EnsureSupervisorsFromManagersAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var pairs = await db.Employees
            .Where(e => e.ManagerId != null && e.Status != "Terminated")
            .Select(e => new { e.Id, SupervisorId = e.ManagerId!.Value })
            .ToListAsync(cancellationToken);

        foreach (var pair in pairs)
        {
            var exists = await db.EmployeeSupervisors.AnyAsync(
                s => !s.IsDeleted && s.EmployeeId == pair.Id && s.ReportingMethod == "Direct",
                cancellationToken);
            if (exists) continue;

            db.EmployeeSupervisors.Add(new EmployeeSupervisor
            {
                EmployeeId = pair.Id,
                SupervisorId = pair.SupervisorId,
                ReportingMethod = "Direct",
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<Dictionary<Guid, Guid>> BuildSupervisorMapAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var map = await db.EmployeeSupervisors
            .Where(s => !s.IsDeleted && s.ReportingMethod == "Direct")
            .ToDictionaryAsync(s => s.EmployeeId, s => s.SupervisorId, cancellationToken);

        var managerFallback = await db.Employees
            .Where(e => e.ManagerId != null)
            .Select(e => new { e.Id, e.ManagerId })
            .ToListAsync(cancellationToken);

        foreach (var row in managerFallback)
        {
            if (row.ManagerId.HasValue && !map.ContainsKey(row.Id))
                map[row.Id] = row.ManagerId.Value;
        }

        return map;
    }

    private static void SeedAppraisals(
        AppDbContext db,
        AppraisalCycle cycle,
        List<Employee> employees,
        Dictionary<Guid, Guid> supervisorMap,
        bool completed)
    {
        for (var i = 0; i < employees.Count; i++)
        {
            var emp = employees[i];
            var rating = 3 + (i % 3);
            var appraisal = new Appraisal
            {
                EmployeeId = emp.Id,
                CycleId = cycle.Id,
                Status = completed ? "Completed" : "ManagerReview",
                FinalRating = completed ? rating : null,
                AcknowledgedAt = completed ? DateTime.UtcNow.AddDays(-30 + i) : null,
            };
            db.Appraisals.Add(appraisal);

            db.AppraisalReviewers.Add(new AppraisalReviewer
            {
                AppraisalId = appraisal.Id,
                ReviewerType = "Self",
                ReviewerEmployeeId = emp.Id,
                Status = "Submitted",
                OverallRating = rating,
                OverallComments = completed ? "Self-assessment submitted." : "Mid-year self review completed.",
                SubmittedAt = DateTime.UtcNow.AddDays(-14 + i),
            });

            if (supervisorMap.TryGetValue(emp.Id, out var supervisorId))
            {
                var managerSubmitted = completed || i < employees.Count - 2;
                db.AppraisalReviewers.Add(new AppraisalReviewer
                {
                    AppraisalId = appraisal.Id,
                    ReviewerType = "Manager",
                    ReviewerEmployeeId = supervisorId,
                    Status = managerSubmitted ? "Submitted" : "Pending",
                    OverallRating = managerSubmitted ? rating : null,
                    OverallComments = managerSubmitted ? "Manager review submitted." : null,
                    SubmittedAt = managerSubmitted ? DateTime.UtcNow.AddDays(-7 + i) : null,
                });
            }
        }
    }
}
