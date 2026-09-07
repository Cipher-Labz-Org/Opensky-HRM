using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class PayStatement : AuditableEntity
{
    public Guid BatchId { get; set; }
    public Guid EmployeeId { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal BasicPay { get; set; }
    public decimal TotalEarnings { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal GrossPay { get; set; }
    public decimal NetPay { get; set; }
    public decimal EmployerCost { get; set; }
    /// <summary>Monthly APIT base (regular + lump) stored so year-to-date totals can be rebuilt.</summary>
    public decimal ApitTaxable { get; set; }
    public string Currency { get; set; } = "LKR";
    public PayStatementStatus Status { get; set; } = PayStatementStatus.Draft;

    public PayrollBatch Batch { get; set; } = null!;
    public Employee Employee { get; set; } = null!;
    public ICollection<PayStatementLine> Lines { get; set; } = new List<PayStatementLine>();
}
