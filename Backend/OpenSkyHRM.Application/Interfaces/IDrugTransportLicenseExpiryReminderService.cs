namespace OpenSkyHRM.Application.Interfaces;

public interface IDrugTransportLicenseExpiryReminderService
{
    /// <summary>
    /// Creates in-app notifications for attachments whose expiry date is exactly 30 days after <paramref name="utcToday"/> (calendar date in UTC).
    /// Recipients: users linked to the license employee, and users linked to their direct supervisor(s).
    /// </summary>
    Task<int> ProcessForUtcDateAsync(DateTime utcToday, CancellationToken cancellationToken = default);
}
