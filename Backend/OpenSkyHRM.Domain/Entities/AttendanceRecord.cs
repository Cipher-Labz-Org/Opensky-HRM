using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AttendanceRecord : AuditableEntity
{
    public DateTime Date { get; set; }
    public DateTime? PunchIn { get; set; }
    public DateTime? PunchOut { get; set; }
    public decimal? WorkedHours { get; set; }
    public string Status { get; set; } = "Present";
    public string? Remarks { get; set; }
    public string? Source { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
}
