using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeSupervisor : BaseEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public Guid SupervisorId { get; set; }
    public Employee Supervisor { get; set; } = null!;
    public string ReportingMethod { get; set; } = "Direct";
}
