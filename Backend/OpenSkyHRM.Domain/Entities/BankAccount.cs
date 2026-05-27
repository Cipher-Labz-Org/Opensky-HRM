using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class BankAccount : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string AccountNumber { get; set; } = string.Empty;
    public string? BankName { get; set; }
    public string AccountType { get; set; } = "Checking";
    public string? BankCode { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchLocation { get; set; }
}
