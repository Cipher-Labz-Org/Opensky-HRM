using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class LeaveType : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public bool AllowHalfDay { get; set; }
    public bool AllowShortLeave { get; set; }
    public int ShortLeaveHours { get; set; } = 3;
    /// <summary>Minimum hours allowed on one short-leave request. Null means no minimum.</summary>
    public int? MinHours { get; set; }
    /// <summary>Maximum hours allowed on one short-leave request. Null means no maximum.</summary>
    public int? MaxHours { get; set; }
    /// <summary>Minimum days allowed on one request. Null means no minimum.</summary>
    public decimal? MinDays { get; set; }
    /// <summary>Maximum days allowed on one request. Null means no maximum.</summary>
    public decimal? MaxDays { get; set; }

    public ICollection<LeavePolicy> Policies { get; set; } = new List<LeavePolicy>();
    public ICollection<LeaveRequest> Requests { get; set; } = new List<LeaveRequest>();
    public ICollection<LeaveBalance> Balances { get; set; } = new List<LeaveBalance>();
}
