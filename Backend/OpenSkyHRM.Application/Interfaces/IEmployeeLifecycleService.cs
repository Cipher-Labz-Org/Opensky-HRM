using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Application.Interfaces;

public interface IEmployeeLifecycleService
{
    Task<EmployeeLifecycleTimelineDto> GetTimelineAsync(Guid employeeId, CancellationToken cancellationToken = default);

    Task RecordJoinedAsync(Employee employee, CancellationToken cancellationToken = default);

    Task RecordEmployeeUpdateAsync(Employee before, Employee after, CancellationToken cancellationToken = default);

    Task RecordSeparationAsync(Employee employee, CancellationToken cancellationToken = default);

    Task RecordReactivatedAsync(Employee employee, CancellationToken cancellationToken = default);
}
