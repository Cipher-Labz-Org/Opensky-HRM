namespace OpenSkyHRM.Application.DTOs.BirthdayCenter;

public sealed record BirthdayCenterPersonDto(
    Guid Id,
    string FullName,
    string EmployeeCode,
    string? DepartmentName,
    string OccasionDateIso,
    string OccasionMonthDay,
    int? DaysUntil,
    string? ProfileImageUrl);

public sealed record BirthdayCenterNoticeDto(
    Guid Id,
    string Title,
    string Preview,
    string Category,
    DateTime CreatedAt,
    bool IsUnread,
    string NoticeKind);

public sealed record BirthdayCenterSummaryDto(
    IReadOnlyList<BirthdayCenterPersonDto> Today,
    IReadOnlyList<BirthdayCenterPersonDto> Upcoming,
    IReadOnlyList<BirthdayCenterNoticeDto> Notices);
