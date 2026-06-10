using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>Idempotent defaults for Learning catalog tables used by People Hub and Learning module.</summary>
public static class LearningSeeder
{
    public static async Task EnsureCatalogAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        if (!await context.Certifications.AnyAsync(cancellationToken))
        {
            context.Certifications.AddRange(
                new Certification { Name = "First Aid", IssuingBody = "Red Cross", IsActive = true },
                new Certification { Name = "OSHA Safety", IssuingBody = "OSHA", IsActive = true },
                new Certification { Name = "PMP", IssuingBody = "PMI", IsActive = true },
                new Certification { Name = "AWS Solutions Architect", IssuingBody = "Amazon Web Services", IsActive = true });
        }

        if (!await context.Skills.AnyAsync(cancellationToken))
        {
            context.Skills.AddRange(
                new Skill { Name = "Leadership", Category = "Soft Skills", IsActive = true },
                new Skill { Name = "Communication", Category = "Soft Skills", IsActive = true },
                new Skill { Name = "Excel", Category = "Technical", IsActive = true },
                new Skill { Name = "Project Management", Category = "Role Skills", IsActive = true },
                new Skill { Name = "JavaScript", Category = "Technical", IsActive = true });
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
