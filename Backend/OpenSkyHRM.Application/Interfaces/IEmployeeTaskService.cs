using OpenSkyHRM.Application.DTOs;

namespace OpenSkyHRM.Application.Interfaces;

public interface IEmployeeTaskService
{
    Task<List<EmployeeTaskTemplateDto>> GetTemplatesAsync(string? type = null);
    Task<EmployeeTaskTemplateDto?> GetTemplateByIdAsync(Guid id);
    Task<EmployeeTaskTemplateDto> CreateTemplateAsync(CreateEmployeeTaskTemplateDto dto);
    Task<EmployeeTaskTemplateDto?> UpdateTemplateAsync(Guid id, CreateEmployeeTaskTemplateDto dto);
    Task<bool> DeleteTemplateAsync(Guid id);

    Task<EmployeeTaskTemplateItemDto> AddItemAsync(Guid templateId, CreateEmployeeTaskTemplateItemDto dto);
    Task<EmployeeTaskTemplateItemDto?> UpdateItemAsync(Guid itemId, CreateEmployeeTaskTemplateItemDto dto);
    Task<bool> DeleteItemAsync(Guid itemId);

    Task CreateTasksFromTemplateAsync(Guid employeeId, Guid templateId, string taskType);

    Task<List<EmployeeTaskLookupDto>> GetTemplateLookupAsync(string type);
}
