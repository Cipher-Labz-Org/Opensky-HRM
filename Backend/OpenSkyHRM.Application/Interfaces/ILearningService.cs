using OpenSkyHRM.Application.DTOs.Learning;
using OpenSkyHRM.Application.DTOs.Performance;

namespace OpenSkyHRM.Application.Interfaces;

public interface ILearningService
{
    Task<List<CourseDto>> GetCoursesAsync(CancellationToken cancellationToken = default);
    Task<CourseDto> CreateCourseAsync(CreateCourseRequest request, CancellationToken cancellationToken = default);
    Task<CourseDto?> UpdateCourseAsync(Guid id, UpdateCourseRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteCourseAsync(Guid id, CancellationToken cancellationToken = default);

    Task<List<SkillDto>> GetSkillsAsync(CancellationToken cancellationToken = default);
    Task<SkillDto> CreateSkillAsync(CreateSkillRequest request, CancellationToken cancellationToken = default);
    Task<SkillDto?> UpdateSkillAsync(Guid id, CreateSkillRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteSkillAsync(Guid id, CancellationToken cancellationToken = default);

    Task<List<SkillMatrixDto>> GetSkillMatrixAsync(IReadOnlyList<Guid>? allowedEmployeeIds,
        Guid? employeeId = null, CancellationToken cancellationToken = default);

    Task<SkillMatrixDto> CreateSkillMatrixEntryAsync(CreateSkillMatrixRequest request,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<SkillMatrixDto?> UpdateSkillMatrixEntryAsync(Guid id, UpdateSkillMatrixRequest request,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<bool> DeleteSkillMatrixEntryAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default);
}
