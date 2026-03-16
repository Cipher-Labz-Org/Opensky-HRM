using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class PayStatement : AuditableEntity
{
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal GrossPay { get; set; }
    public decimal Deductions { get; set; }
    public decimal NetPay { get; set; }
    public string Status { get; set; } = "Draft";
    public string Currency { get; set; } = "LKR";

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid? BatchId { get; set; }
    public PayrollBatch? Batch { get; set; }
}
