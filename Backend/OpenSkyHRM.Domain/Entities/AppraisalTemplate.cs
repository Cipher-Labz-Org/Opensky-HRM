using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AppraisalTemplate : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    public Guid RatingScaleId { get; set; }
    public RatingScale RatingScale { get; set; } = null!;

    public ICollection<AppraisalTemplateSection> Sections { get; set; } = new List<AppraisalTemplateSection>();
}

public class AppraisalTemplateSection : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }

    public Guid TemplateId { get; set; }
    public AppraisalTemplate Template { get; set; } = null!;

    public ICollection<AppraisalTemplateSectionItem> Items { get; set; } = new List<AppraisalTemplateSectionItem>();
}

public class AppraisalTemplateSectionItem : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }

    public Guid SectionId { get; set; }
    public AppraisalTemplateSection Section { get; set; } = null!;

    public Guid? CompetencyId { get; set; }
    public Competency? Competency { get; set; }
}
