using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAttendanceQrTokenService
{
    BusinessUnitAttendanceQrDto IssueBusinessUnitQr(Guid businessUnitId, string name, string code);

    LocationAttendanceQrDto IssueLocationQr(Guid locationId, string name, string code);

    ValidateBusinessUnitAttendanceQrResultDto Validate(string rawInput);
}
