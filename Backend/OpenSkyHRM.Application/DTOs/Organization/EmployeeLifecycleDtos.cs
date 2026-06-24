namespace OpenSkyHRM.Application.DTOs.Organization;

public class EmployeeLifecycleEventDto
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EventTypeLabel { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public bool IsCurrentRole { get; set; }
}

public class EmployeeLifecycleTimelineDto
{
    public IReadOnlyList<EmployeeLifecycleEventDto> Milestones { get; set; } = Array.Empty<EmployeeLifecycleEventDto>();
    public IReadOnlyList<EmployeeLifecycleEventDto> RoleHistory { get; set; } = Array.Empty<EmployeeLifecycleEventDto>();
}
