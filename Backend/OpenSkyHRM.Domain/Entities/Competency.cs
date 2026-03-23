using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class CompetencyCategory : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    public ICollection<Competency> Competencies { get; set; } = new List<Competency>();
}

public class Competency : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    public Guid CategoryId { get; set; }
    public CompetencyCategory Category { get; set; } = null!;
}
