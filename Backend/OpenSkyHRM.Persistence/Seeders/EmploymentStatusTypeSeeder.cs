using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>Idempotent catalog of employment types (Job Details dropdown).</summary>
public static class EmploymentStatusTypeSeeder
{
    private readonly record struct EmploymentTypeDefinition(string Name, string Code, int SortOrder);

    private static readonly EmploymentTypeDefinition[] Defaults =
    [
        new("Full-Time Permanent", nameof(EmploymentType.FullTimePermanent), 1),
        new("Full-Time Probation", nameof(EmploymentType.FullTimeProbation), 2),
        new("Full-Time Contract", nameof(EmploymentType.FullTimeContract), 3),
        new("Full-Time Internship", nameof(EmploymentType.FullTimeInternship), 4),
        new("Part-Time Permanent", nameof(EmploymentType.PartTimePermanent), 5),
        new("Part-Time Contract", nameof(EmploymentType.PartTimeContract), 6),
        new("Part-Time Internship", nameof(EmploymentType.PartTimeInternship), 7),
        new("Freelancer", nameof(EmploymentType.Freelance), 8),
    ];

    public static async Task EnsureCatalogAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var existing = await context.EmploymentStatusTypes
            .IgnoreQueryFilters()
            .ToListAsync(cancellationToken);

        foreach (var definition in Defaults)
        {
            var match = existing.FirstOrDefault(e =>
                e.Code.Equals(definition.Code, StringComparison.OrdinalIgnoreCase)
                || (definition.Code == nameof(EmploymentType.Freelance)
                    && (e.Code.Equals("Freelancer", StringComparison.OrdinalIgnoreCase)
                        || e.Name.Equals("Freelancer", StringComparison.OrdinalIgnoreCase))));

            if (match is null)
            {
                var entity = new EmploymentStatusType
                {
                    Name = definition.Name,
                    Code = definition.Code,
                    IsActive = true,
                    IsSystem = true,
                    SortOrder = definition.SortOrder,
                };
                context.EmploymentStatusTypes.Add(entity);
                existing.Add(entity);
                continue;
            }

            if (match.IsDeleted)
            {
                match.IsDeleted = false;
                match.IsActive = true;
                match.IsSystem = true;
            }

            if (match.IsSystem)
            {
                if (match.SortOrder != definition.SortOrder)
                    match.SortOrder = definition.SortOrder;
                if (!string.Equals(match.Name, definition.Name, StringComparison.Ordinal))
                    match.Name = definition.Name;
            }

            if (definition.Code == nameof(EmploymentType.Freelance))
            {
                match.IsSystem = true;
                if (!match.IsActive)
                    match.IsActive = true;
                if (!match.Code.Equals(definition.Code, StringComparison.OrdinalIgnoreCase))
                    match.Code = definition.Code;
            }
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync(cancellationToken);
    }
}
