using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class CompensationComponent : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public ComponentType Type { get; set; } = ComponentType.Earning;
    public ComponentCategory Category { get; set; } = ComponentCategory.Fixed;
    public bool IsTaxable { get; set; }
    public bool IsEpfApplicable { get; set; }
    public bool IsEtfApplicable { get; set; }
    public bool IsStatutory { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }
    public string? FormulaExpression { get; set; }
    public string? DependsOnComponentCode { get; set; }
    public int SortOrder { get; set; }
    public bool IsEmployerContribution { get; set; }

    public ICollection<EmployeeCompensation> EmployeeCompensations { get; set; } = new List<EmployeeCompensation>();
    public ICollection<PayrollFormula> Formulas { get; set; } = new List<PayrollFormula>();
}
