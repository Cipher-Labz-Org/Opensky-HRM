using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeEvaluation : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public int Rating { get; set; }
    public string? Comment { get; set; }

    public Guid? EvaluatorEmployeeId { get; set; }
    public Employee? EvaluatorEmployee { get; set; }
    public string? EvaluatorName { get; set; }
}
