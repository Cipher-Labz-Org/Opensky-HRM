using OpenSkyHRM.Application.DTOs.Recruitment;

namespace OpenSkyHRM.Application.Interfaces;

public interface IOffboardingService
{
    Task<List<OffboardingTaskDto>> GetTasksByEmployeeAsync(Guid employeeId);
    Task<OffboardingTaskDto?> CompleteTaskAsync(Guid taskId);
    Task CreateDefaultTasksAsync(Guid employeeId, List<Guid>? templateIds = null);

    Task<List<OffboardingTaskTemplateDto>> GetTemplatesAsync();
    Task<OffboardingTaskTemplateDto> CreateTemplateAsync(CreateOffboardingTaskTemplateDto dto);
    Task<OffboardingTaskTemplateDto?> UpdateTemplateAsync(Guid id, CreateOffboardingTaskTemplateDto dto);
    Task<bool> DeleteTemplateAsync(Guid id);

    Task<List<ActiveOffboardingDto>> GetActiveOffboardingsAsync();
}

public class ActiveOffboardingDto
{
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeCode { get; set; } = string.Empty;
    public string? DepartmentName { get; set; }
    public string? TerminationReason { get; set; }
    public DateTime? TerminationDate { get; set; }
    public int TotalTasks { get; set; }
    public int CompletedTasks { get; set; }
    public List<OffboardingTaskDto> Tasks { get; set; } = new();
}
