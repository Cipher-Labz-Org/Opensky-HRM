using OpenSkyHRM.Application.DTOs.Recruitment;

namespace OpenSkyHRM.Application.Interfaces;

public interface IOnboardingService
{
    Task<List<OnboardingTaskDto>> GetTasksByEmployeeAsync(Guid employeeId);
    Task<OnboardingTaskDto?> CompleteTaskAsync(Guid taskId);
}
