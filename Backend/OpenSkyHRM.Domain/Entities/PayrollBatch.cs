using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class PayrollBatch : AuditableEntity
{
    public string BatchCode { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public PayrollProcessType ProcessType { get; set; } = PayrollProcessType.Salary;
    public BatchStatus Status { get; set; } = BatchStatus.Draft;
    public DateTime? ProcessedAt { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public int EmployeeCount { get; set; }
    public decimal TotalGross { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal TotalNet { get; set; }
    public decimal TotalEmployerCost { get; set; }
    public string? Notes { get; set; }
    public string? SelectedEmployeeIds { get; set; }

    public ICollection<PayStatement> PayStatements { get; set; } = new List<PayStatement>();
}
