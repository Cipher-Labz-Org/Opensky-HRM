using OpenSkyHRM.Application.DTOs.Learning;

namespace OpenSkyHRM.Application.Interfaces;

public interface ICertificationService
{
    Task<List<CertificationCatalogDto>> GetCatalogAsync(CancellationToken cancellationToken = default);
    Task<CertificationCatalogDto> CreateCatalogEntryAsync(CreateCertificationRequest request,
        CancellationToken cancellationToken = default);
    Task<CertificationCatalogDto?> UpdateCatalogEntryAsync(Guid id, UpdateCertificationRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteCatalogEntryAsync(Guid id, CancellationToken cancellationToken = default);

    Task<List<EmployeeCertificationDto>> GetEmployeeCertificationsAsync(Guid employeeId,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<List<EmployeeCertificationListItemDto>> GetAllEmployeeCertificationsAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<EmployeeCertificationDto> CreateEmployeeCertificationAsync(Guid employeeId,
        CreateEmployeeCertificationRequest request, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default);

    Task<EmployeeCertificationDto?> UpdateEmployeeCertificationAsync(Guid employeeId, Guid id,
        UpdateEmployeeCertificationRequest request, IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteEmployeeCertificationAsync(Guid employeeId, Guid id,
        IReadOnlyList<Guid>? allowedEmployeeIds, CancellationToken cancellationToken = default);

    Task<List<LearningCertificationSummaryDto>> GetCertificationSummariesAsync(
        CancellationToken cancellationToken = default);

    Task<List<LearningSkillCoverageDto>> GetSkillCoverageAsync(CancellationToken cancellationToken = default);
}
