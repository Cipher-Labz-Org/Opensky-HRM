using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Idempotent defaults: <see cref="OffboardingTaskTemplate"/> (used when terminating without a template id),
/// and <see cref="EmployeeTaskTemplate"/> + items (used from People / recruitment when a template is chosen).
/// </summary>
public static class EmployeeLifecycleTemplateSeeder
{
    public const string StandardOnboardingTemplateName = "Standard onboarding";
    public const string StandardOffboardingTemplateName = "Standard offboarding";

    public static async Task EnsureAsync(AppDbContext context)
    {
        await EnsureOffboardingTaskTemplatesAsync(context);
        await EnsureStandardEmployeeOnboardingTemplateAsync(context);
        await EnsureStandardEmployeeOffboardingTemplateAsync(context);
    }

    private static async Task EnsureOffboardingTaskTemplatesAsync(AppDbContext context)
    {
        foreach (var row in StandardOffboardingTemplateRows)
        {
            var exists = await context.OffboardingTaskTemplates.AnyAsync(
                t => t.Title == row.Title && !t.IsDeleted);
            if (exists) continue;

            context.OffboardingTaskTemplates.Add(new OffboardingTaskTemplate
            {
                Title = row.Title,
                Description = row.Description,
                Category = row.Category,
                SortOrder = row.SortOrder,
                IsActive = true,
                AssignmentType = row.AssignmentType,
                AssignedToUserId = null,
            });
        }
    }

    private static async Task EnsureStandardEmployeeOnboardingTemplateAsync(AppDbContext context)
    {
        var has = await context.EmployeeTaskTemplates.AnyAsync(
            t => t.Name == StandardOnboardingTemplateName && t.Type == "Onboarding" && !t.IsDeleted);
        if (has) return;

        var template = new EmployeeTaskTemplate
        {
            Name = StandardOnboardingTemplateName,
            Description = "Default checklist for new hires before and during their first weeks.",
            Type = "Onboarding",
            IsActive = true,
        };
        context.EmployeeTaskTemplates.Add(template);

        var order = 0;
        foreach (var row in StandardOnboardingItems)
        {
            order++;
            context.EmployeeTaskTemplateItems.Add(new EmployeeTaskTemplateItem
            {
                Template = template,
                Title = row.Title,
                Description = row.Description,
                Category = row.Category,
                SortOrder = row.SortOrder > 0 ? row.SortOrder : order,
                AssignmentType = row.AssignmentType,
                AssignedToUserId = null,
            });
        }
    }

    private static async Task EnsureStandardEmployeeOffboardingTemplateAsync(AppDbContext context)
    {
        var has = await context.EmployeeTaskTemplates.AnyAsync(
            t => t.Name == StandardOffboardingTemplateName && t.Type == "Offboarding" && !t.IsDeleted);
        if (has) return;

        var template = new EmployeeTaskTemplate
        {
            Name = StandardOffboardingTemplateName,
            Description = "Default checklist when an employee leaves (matches default offboarding tasks).",
            Type = "Offboarding",
            IsActive = true,
        };
        context.EmployeeTaskTemplates.Add(template);

        var order = 0;
        foreach (var row in StandardOffboardingTemplateRows)
        {
            order++;
            context.EmployeeTaskTemplateItems.Add(new EmployeeTaskTemplateItem
            {
                Template = template,
                Title = row.Title,
                Description = row.Description,
                Category = row.Category,
                SortOrder = row.SortOrder > 0 ? row.SortOrder : order,
                AssignmentType = row.AssignmentType,
                AssignedToUserId = null,
            });
        }
    }

    private static readonly (string Title, string? Description, string Category, int SortOrder, string AssignmentType)[]
        StandardOnboardingItems =
        [
            ("Send welcome pack & first-day instructions", null, "HR", 1, "User"),
            ("Create IT accounts (email, SSO, core apps)", null, "IT & Assets", 2, "User"),
            ("Prepare workstation, equipment & building access", null, "IT & Assets", 3, "User"),
            ("Payroll, bank details & statutory forms", null, "Finance", 4, "User"),
            ("Signed policies, handbook & code of conduct acknowledgment", null, "HR", 5, "Supervisor"),
            ("Schedule orientation / company overview", null, "HR", 6, "User"),
            ("Benefits enrollment & dependent updates (if applicable)", null, "HR", 7, "User"),
            ("Role-specific training & access to tools", null, "Department", 8, "Supervisor"),
            ("Assign buddy / mentor introduction", null, "Department", 9, "Supervisor"),
            ("30-day check-in with manager", null, "HR", 10, "Supervisor"),
        ];

    /// <summary>Same steps as <see cref="StandardOffboardingTemplateName"/> employee template and typical exit workflow.</summary>
    private static readonly (string Title, string? Description, string Category, int SortOrder, string AssignmentType)[]
        StandardOffboardingTemplateRows =
        [
            ("Return company laptop / equipment", null, "IT & Assets", 1, "User"),
            ("Revoke system access & email", null, "IT & Assets", 2, "User"),
            ("Return ID badge & access cards", null, "IT & Assets", 3, "User"),
            ("Collect company property (keys, uniforms, etc.)", null, "IT & Assets", 4, "User"),
            ("Conduct exit interview", null, "HR", 5, "User"),
            ("Process final pay & benefits settlement", null, "Finance", 6, "User"),
            ("Settle outstanding expense claims", null, "Finance", 7, "User"),
            ("Update insurance / benefits termination", null, "HR", 8, "User"),
            ("Transfer knowledge & handover duties", null, "Department", 9, "Supervisor"),
            ("Remove from org chart & distribution lists", null, "HR", 10, "User"),
            ("Issue experience / service letter", null, "HR", 11, "User"),
        ];
}
