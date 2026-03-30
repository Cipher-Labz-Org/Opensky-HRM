using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class PayStatementLine : BaseEntity
{
    public Guid PayStatementId { get; set; }
    public Guid ComponentId { get; set; }
    public string ComponentName { get; set; } = string.Empty;
    public string ComponentCode { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public bool IsEmployerContribution { get; set; }
    public int SortOrder { get; set; }

    public PayStatement PayStatement { get; set; } = null!;
    public CompensationComponent Component { get; set; } = null!;
}
