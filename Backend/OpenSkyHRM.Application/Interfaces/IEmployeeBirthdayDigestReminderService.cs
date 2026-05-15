namespace OpenSkyHRM.Application.Interfaces;

public interface IEmployeeBirthdayDigestReminderService
{
    /// <summary>
    /// Rebuilds in-app birthday rows for all active users: one notification per person with a birthday
    /// on <paramref name="utcToday"/> (today) or in the following six UTC calendar days (upcoming).
    /// Replaces prior rows in categories <c>BirthdayToday</c>, <c>BirthdayUpcoming</c>, and legacy digest.
    /// </summary>
    Task<int> ProcessForUtcDateAsync(DateTime utcToday, CancellationToken cancellationToken = default);
}
