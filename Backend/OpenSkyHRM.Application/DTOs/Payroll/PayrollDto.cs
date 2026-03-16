namespace OpenSkyHRM.Application.DTOs.Payroll;

public class CompensationComponentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool IsTaxable { get; set; }
    public bool IsStatutory { get; set; }
    public bool IsActive { get; set; }
}

public class EmployeeCompensationDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = string.Empty;
    public DateTime EffectiveFrom { get; set; }
}

public class SalaryRevisionDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string RevisionType { get; set; } = string.Empty;
    public decimal CurrentSalary { get; set; }
    public decimal ProposedSalary { get; set; }
    public decimal ChangePercentage { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime EffectiveDate { get; set; }
}

public class PayrollBatchDto
{
    public Guid Id { get; set; }
    public string BatchCode { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public string Status { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
    public decimal TotalGross { get; set; }
    public decimal TotalNet { get; set; }
}

public class PayStatementDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal GrossPay { get; set; }
    public decimal Deductions { get; set; }
    public decimal NetPay { get; set; }
    public string Status { get; set; } = string.Empty;
}
