using OpenSkyHRM.Application.DTOs.Performance;

namespace OpenSkyHRM.Application.Interfaces;

public interface ILearningService
{
    Task<List<CourseDto>> GetCoursesAsync();
    Task<List<SkillDto>> GetSkillsAsync();
    Task<List<SkillMatrixDto>> GetSkillMatrixAsync(Guid? employeeId = null);
}
