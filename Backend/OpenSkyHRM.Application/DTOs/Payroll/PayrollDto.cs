namespace OpenSkyHRM.Application.DTOs.Payroll;

public class CompensationComponentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsTaxable { get; set; }
    public bool IsEpfApplicable { get; set; }
    public bool IsEtfApplicable { get; set; }
    public bool IsStatutory { get; set; }
    public bool IsActive { get; set; }
    public string? Description { get; set; }
    public string? FormulaExpression { get; set; }
    public string? DependsOnComponentCode { get; set; }
    public int SortOrder { get; set; }
    public bool IsEmployerContribution { get; set; }
    public bool RoundResult { get; set; }
}

public class CreateComponentDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = "Earning";
    public string Category { get; set; } = "Fixed";
    public bool IsTaxable { get; set; }
    public bool IsEpfApplicable { get; set; }
    public bool IsEtfApplicable { get; set; }
    public bool IsStatutory { get; set; }
    public string? Description { get; set; }
    public string? FormulaExpression { get; set; }
    public string? DependsOnComponentCode { get; set; }
    public int SortOrder { get; set; }
    public bool IsEmployerContribution { get; set; }
    public bool RoundResult { get; set; }
}

public class UpdateComponentDto : CreateComponentDto
{
    public bool IsActive { get; set; } = true;
}

public class EmployeeCompensationDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public Guid ComponentId { get; set; }
    public string ComponentName { get; set; } = string.Empty;
    public string ComponentCode { get; set; } = string.Empty;
    public string ComponentType { get; set; } = string.Empty;
    public string ComponentCategory { get; set; } = string.Empty;
    public bool IsTaxable { get; set; }
    public bool IsEpfApplicable { get; set; }
    public bool IsEtfApplicable { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; }
    public Guid? BatchId { get; set; }
}

public class CreateEmployeeCompensationDto
{
    public Guid ComponentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public Guid? BatchId { get; set; }
}

public class UpdateEmployeeCompensationDto
{
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SalaryRevisionDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string RevisionType { get; set; } = string.Empty;
    public decimal CurrentSalary { get; set; }
    public decimal ProposedSalary { get; set; }
    public decimal ChangePercentage { get; set; }
    public string? Justification { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime EffectiveDate { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? Remarks { get; set; }
}

public class CreateSalaryRevisionDto
{
    public Guid EmployeeId { get; set; }
    public string RevisionType { get; set; } = "Increment";
    public decimal CurrentSalary { get; set; }
    public decimal ProposedSalary { get; set; }
    public string? Justification { get; set; }
    public DateTime EffectiveDate { get; set; }
}

public class PayrollBatchDto
{
    public Guid Id { get; set; }
    public string BatchCode { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string ProcessType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
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
    public int SelectedCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreatePayrollBatchDto
{
    public int Month { get; set; }
    public int Year { get; set; }
    public DateTime? EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string ProcessType { get; set; } = "Salary";
    public string? Notes { get; set; }
    public List<Guid> EmployeeIds { get; set; } = new();
}

public class PayStatementDto
{
    public Guid Id { get; set; }
    public Guid BatchId { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public string? Department { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal BasicPay { get; set; }
    public decimal TotalEarnings { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal GrossPay { get; set; }
    public decimal NetPay { get; set; }
    public decimal EmployerCost { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<PayStatementLineDto> Lines { get; set; } = new();
}

public class PayStatementLineDto
{
    public Guid Id { get; set; }
    public Guid ComponentId { get; set; }
    public string ComponentName { get; set; } = string.Empty;
    public string ComponentCode { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public bool IsEmployerContribution { get; set; }
    public int SortOrder { get; set; }
}

public class PayrollSettingsDto
{
    public decimal EpfEmployeeRate { get; set; }
    public decimal EpfEmployerRate { get; set; }
    public decimal EtfEmployerRate { get; set; }
    public decimal OtHourlyDivisor { get; set; } = 208m;
    public decimal OtMultiplier { get; set; } = 1.5m;
    /// <summary>Monthly (Table 01), Annual (12× monthly), or Exact (cumulative from 1 March).</summary>
    public string ApitTaxMode { get; set; } = "Exact";
}

public class EmployeeApitSummaryDto
{
    public decimal MonthlySalary { get; set; }
    public decimal YearlySalary { get; set; }
    public decimal MonthlyApit { get; set; }
    public decimal AnnualApit { get; set; }
    public decimal DisplayApit { get; set; }
    public string ApitTaxMode { get; set; } = "Exact";
    public bool BelowMonthlyRelief { get; set; }
    public int TaxYearMonthNumber { get; set; }
    public decimal CumulativeTaxable { get; set; }
    public decimal CumulativeApit { get; set; }
    public int ConfirmedMonths { get; set; }
}

public class UpdateEmployeeApitTaxModeDto
{
    public string ApitTaxMode { get; set; } = "Monthly";
}

public class PayrollAttendanceImportPreviewDto
{
    public Guid BatchId { get; set; }
    public string BatchCode { get; set; } = string.Empty;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public List<PayrollAttendanceImportLineDto> Lines { get; set; } = new();
    public int EmployeesWithApprovedOt { get; set; }
    public int EmployeesMissingOtApproval { get; set; }
    public int EmployeesWithNopay { get; set; }
    public int EmployeesWithPoya { get; set; }
}

public class PayrollAttendanceImportLineDto
{
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public decimal ApprovedOtHours { get; set; }
    public decimal OtAmount { get; set; }
    public bool OtApproved { get; set; }
    public bool OtOutdated { get; set; }
    public int AttendanceNopayDays { get; set; }
    public int LeaveNopayDays { get; set; }
    public int TotalNopayDays { get; set; }
    public decimal PoyaDaysWorked { get; set; }
    public decimal BasicPay { get; set; }
    public string? Warning { get; set; }
}

public class PayrollAttendanceImportResultDto
{
    public int ImportedCount { get; set; }
    public int OtLinesUpdated { get; set; }
    public PayrollAttendanceImportPreviewDto Preview { get; set; } = new();
}

public class BulkVariableUpdateRequest
{
    public List<VariableUpdateItem> Updates { get; set; } = new();
}

public class VariableUpdateItem
{
    public Guid Id { get; set; }
    public decimal Amount { get; set; }
}

public class PayrollFormulaDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid ComponentId { get; set; }
    public string ComponentName { get; set; } = string.Empty;
    public string Expression { get; set; } = string.Empty;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; }
}

public class BankSlipRowDto
{
    public Guid StatementId { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal NetPay { get; set; }
    public decimal EpfEmployee { get; set; }
    public decimal EpfEmployer { get; set; }
    public decimal EtfEmployer { get; set; }
    public bool IsCashPayment { get; set; }
    public bool HasBankAccount { get; set; }
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? BankCode { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchLocation { get; set; }
    public string? NationalId { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
}
