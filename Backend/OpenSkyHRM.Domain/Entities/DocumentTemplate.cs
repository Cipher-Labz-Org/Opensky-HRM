using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class DocumentTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;
    public string HtmlContent { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
