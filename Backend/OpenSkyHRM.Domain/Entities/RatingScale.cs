using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class RatingScale : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<RatingScaleItem> Items { get; set; } = new List<RatingScaleItem>();
}

public class RatingScaleItem : AuditableEntity
{
    public int Value { get; set; }
    public string Label { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }

    public Guid RatingScaleId { get; set; }
    public RatingScale RatingScale { get; set; } = null!;
}
