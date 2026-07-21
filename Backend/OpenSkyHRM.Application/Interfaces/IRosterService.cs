using OpenSkyHRM.Application.DTOs.TimeAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IRosterService
{
    Task<List<RosterTemplateDto>> GetAllTemplatesAsync(bool includeInactive = false);
    Task<RosterTemplateDto?> GetTemplateByIdAsync(Guid id);
    Task<RosterTemplateDto> CreateTemplateAsync(CreateRosterTemplateDto dto);
    Task<RosterTemplateDto?> UpdateTemplateAsync(Guid id, UpdateRosterTemplateDto dto);
    Task<bool> DeleteTemplateAsync(Guid id, bool deleteAssignments = false);

    Task<List<RosterAssignmentDto>> GetAssignmentsAsync(
        Guid? employeeId = null,
        Guid? rosterTemplateId = null,
        DateTime? effectiveDate = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<RosterAssignmentDto?> GetAssignmentByIdAsync(Guid id);
    Task<RosterAssignmentDto> CreateAssignmentAsync(CreateRosterAssignmentDto dto);
    Task<RosterAssignmentDto?> UpdateAssignmentAsync(Guid id, UpdateRosterAssignmentDto dto);
    Task<bool> DeleteAssignmentAsync(Guid id);
    Task<BulkAssignmentResultDto> BulkCreateAssignmentsAsync(BulkCreateRosterAssignmentDto dto);
}
