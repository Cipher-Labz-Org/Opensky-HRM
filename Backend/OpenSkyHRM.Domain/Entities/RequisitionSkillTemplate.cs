using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Maps role keywords (and optional job title) to suggested skills for recruitment requisitions.
/// </summary>
public class RequisitionSkillTemplate : AuditableEntity
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Pipe-separated keywords matched against requisition title (case-insensitive).</summary>
    public string Keywords { get; set; } = string.Empty;

    /// <summary>Comma-separated skill names suggested when this template matches.</summary>
    public string Skills { get; set; } = string.Empty;

    public Guid? JobTitleId { get; set; }
    public JobTitle? JobTitle { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
