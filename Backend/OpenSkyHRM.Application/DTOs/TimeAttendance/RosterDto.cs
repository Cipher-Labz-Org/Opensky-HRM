namespace OpenSkyHRM.Application.DTOs.TimeAttendance;

public class RosterTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TimeSpan DefaultStartTime { get; set; }
    public TimeSpan DefaultEndTime { get; set; }
    public decimal WorkHoursPerDay { get; set; }
    public bool IsActive { get; set; }
    public Guid? DefaultShiftPatternId { get; set; }
    public string? DefaultShiftPatternName { get; set; }
}

public class CreateRosterTemplateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TimeSpan DefaultStartTime { get; set; }
    public TimeSpan DefaultEndTime { get; set; }
    public decimal WorkHoursPerDay { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? DefaultShiftPatternId { get; set; }
}

public class UpdateRosterTemplateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TimeSpan DefaultStartTime { get; set; }
    public TimeSpan DefaultEndTime { get; set; }
    public decimal WorkHoursPerDay { get; set; }
    public bool IsActive { get; set; }
    public Guid? DefaultShiftPatternId { get; set; }
}

public class RosterAssignmentDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public Guid RosterTemplateId { get; set; }
    public string RosterTemplateName { get; set; } = string.Empty;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string? Notes { get; set; }
}

public class CreateRosterAssignmentDto
{
    public Guid EmployeeId { get; set; }
    public Guid RosterTemplateId { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string? Notes { get; set; }
}

public class UpdateRosterAssignmentDto
{
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string? Notes { get; set; }
}

public class BulkCreateRosterAssignmentDto
{
    public List<Guid> EmployeeIds { get; set; } = new();
    public Guid RosterTemplateId { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string? Notes { get; set; }
}

public class BulkAssignmentResultDto
{
    public int Created { get; set; }
    public int Skipped { get; set; }
    public List<string> Errors { get; set; } = new();
}
