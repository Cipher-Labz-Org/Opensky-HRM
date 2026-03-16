using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class PayrollBatch : AuditableEntity
{
    public string BatchCode { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTime? ProcessedAt { get; set; }
    public int EmployeeCount { get; set; }
    public decimal TotalGross { get; set; }
    public decimal TotalNet { get; set; }
}
