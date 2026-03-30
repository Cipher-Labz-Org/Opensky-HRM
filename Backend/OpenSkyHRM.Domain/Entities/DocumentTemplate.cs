using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class DocumentTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;

    /// <summary>Optional email subject for transactional templates (TemplateKey Email_*). Placeholders match the HTML body.</summary>
    public string? Subject { get; set; }

    public string HtmlContent { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
