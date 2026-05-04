using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

public static class AppraisalTemplateSeeder
{
    public static async Task EnsureAsync(AppDbContext context)
    {
        if (await context.AppraisalTemplates.AnyAsync())
            return;

        var scale = await context.RatingScales
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.IsDefault)
            ?? await CreateDefaultScaleAsync(context);

        var category = await context.CompetencyCategories
            .Include(c => c.Competencies)
            .OrderBy(c => c.SortOrder)
            .FirstOrDefaultAsync()
            ?? await CreateDefaultCompetencyCatalogAsync(context);

        var template = new AppraisalTemplate
        {
            Name = "Standard Annual Appraisal",
            Description = "Starter template with core competency and goal sections.",
            RatingScaleId = scale.Id,
            Sections =
            {
                new AppraisalTemplateSection
                {
                    Name = "Core Competencies",
                    Description = "Behavioral and role competencies.",
                    Weight = 60,
                    SortOrder = 1,
                    Items =
                    {
                        new AppraisalTemplateSectionItem
                        {
                            Name = "Job Knowledge",
                            Description = "Understands role responsibilities and standards.",
                            Weight = 20,
                            SortOrder = 1,
                            CompetencyId = category.Competencies.FirstOrDefault()?.Id
                        },
                        new AppraisalTemplateSectionItem
                        {
                            Name = "Communication",
                            Description = "Communicates clearly with stakeholders.",
                            Weight = 20,
                            SortOrder = 2,
                            CompetencyId = category.Competencies.Skip(1).FirstOrDefault()?.Id
                        },
                        new AppraisalTemplateSectionItem
                        {
                            Name = "Teamwork",
                            Description = "Collaborates effectively across teams.",
                            Weight = 20,
                            SortOrder = 3,
                            CompetencyId = category.Competencies.Skip(2).FirstOrDefault()?.Id
                        }
                    }
                },
                new AppraisalTemplateSection
                {
                    Name = "Goals & Delivery",
                    Description = "Progress against agreed goals and outcomes.",
                    Weight = 40,
                    SortOrder = 2,
                    Items =
                    {
                        new AppraisalTemplateSectionItem
                        {
                            Name = "Goal Achievement",
                            Description = "Achievement against agreed goals and KPIs.",
                            Weight = 25,
                            SortOrder = 1
                        },
                        new AppraisalTemplateSectionItem
                        {
                            Name = "Quality & Timeliness",
                            Description = "Quality of output and adherence to deadlines.",
                            Weight = 15,
                            SortOrder = 2
                        }
                    }
                }
            }
        };

        context.AppraisalTemplates.Add(template);
        await context.SaveChangesAsync();
    }

    private static async Task<RatingScale> CreateDefaultScaleAsync(AppDbContext context)
    {
        var scale = new RatingScale
        {
            Name = "5 Point Scale",
            Description = "Default appraisal scale.",
            IsDefault = true,
            Items =
            {
                new RatingScaleItem { Value = 1, Label = "Needs Improvement", Color = "#ef4444" },
                new RatingScaleItem { Value = 2, Label = "Partially Meets", Color = "#f97316" },
                new RatingScaleItem { Value = 3, Label = "Meets Expectations", Color = "#eab308" },
                new RatingScaleItem { Value = 4, Label = "Exceeds Expectations", Color = "#22c55e" },
                new RatingScaleItem { Value = 5, Label = "Outstanding", Color = "#3b82f6" }
            }
        };

        context.RatingScales.Add(scale);
        await context.SaveChangesAsync();
        return scale;
    }

    private static async Task<CompetencyCategory> CreateDefaultCompetencyCatalogAsync(AppDbContext context)
    {
        var category = new CompetencyCategory
        {
            Name = "General Competencies",
            Description = "Default competency set for appraisals.",
            SortOrder = 1,
            Competencies =
            {
                new Competency { Name = "Job Knowledge", Description = "Role knowledge and technical understanding.", SortOrder = 1 },
                new Competency { Name = "Communication", Description = "Clear written and verbal communication.", SortOrder = 2 },
                new Competency { Name = "Teamwork", Description = "Collaboration and support across teams.", SortOrder = 3 }
            }
        };

        context.CompetencyCategories.Add(category);
        await context.SaveChangesAsync();
        return category;
    }
}
