using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>Real lifecycle milestone or org/role change for an employee.</summary>
public class EmployeeLifecycleEvent : BaseEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    /// <see cref="EmployeeLifecycleEventTypes"/>
    public string EventType { get; set; } = string.Empty;

    /// <summary>Effective calendar date (business-local wall time).</summary>
    public DateTime EventDate { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }

    /// <summary>Optional JSON details (e.g. field changes).</summary>
    public string? DetailsJson { get; set; }

    /// <see cref="EmployeeLifecycleEventSources"/>
    public string Source { get; set; } = EmployeeLifecycleEventSources.System;

    /// <summary>Idempotency key to avoid duplicate backfill rows.</summary>
    public string? ExternalKey { get; set; }
}
