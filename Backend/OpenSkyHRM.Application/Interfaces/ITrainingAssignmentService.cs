using OpenSkyHRM.Application.DTOs.Learning;

namespace OpenSkyHRM.Application.Interfaces;

public interface ITrainingAssignmentService
{
    Task<List<TrainingAssignmentDto>> GetAssignmentsAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds,
        Guid? employeeId = null,
        Guid? courseId = null,
        string? status = null,
        bool? overdueOnly = null,
        CancellationToken cancellationToken = default);

    Task<TrainingAssignmentDto?> GetByIdAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default);

    Task<TrainingAssignmentDto> CreateAsync(CreateTrainingAssignmentRequest request, Guid? assignedByEmployeeId,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<List<TrainingAssignmentDto>> BulkCreateAsync(BulkCreateTrainingAssignmentRequest request,
        Guid? assignedByEmployeeId, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default);

    Task<TrainingAssignmentDto?> UpdateAsync(Guid id, UpdateTrainingAssignmentRequest request,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default);

    /// <summary>Sends overdue reminders (at most once per UTC day per assignment).</summary>
    Task<int> SendOverdueRemindersAsync(CancellationToken cancellationToken = default);
}
