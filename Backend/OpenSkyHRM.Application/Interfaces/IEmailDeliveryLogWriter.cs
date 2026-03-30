namespace OpenSkyHRM.Application.Interfaces;

public sealed record EmailDeliveryLogEntry(
    string Category,
    string RecipientEmail,
    string? RecipientName,
    string Subject,
    string Status,
    string Provider,
    int? HttpStatusCode,
    string? FromEmail,
    string? ErrorDetail);

public interface IEmailDeliveryLogWriter
{
    Task WriteAsync(EmailDeliveryLogEntry entry, CancellationToken cancellationToken = default);
}
