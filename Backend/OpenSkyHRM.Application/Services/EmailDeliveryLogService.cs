using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class EmailDeliveryLogService : IEmailDeliveryLogWriter
{
    private const int MaxErrorLength = 4000;
    private readonly AppDbContext _db;

    public EmailDeliveryLogService(AppDbContext db) => _db = db;

    public async Task WriteAsync(EmailDeliveryLogEntry entry, CancellationToken cancellationToken = default)
    {
        var err = entry.ErrorDetail;
        if (err != null && err.Length > MaxErrorLength)
            err = err[..MaxErrorLength];

        _db.Set<OutboundEmailLog>().Add(new OutboundEmailLog
        {
            Category = entry.Category,
            RecipientEmail = entry.RecipientEmail,
            RecipientName = entry.RecipientName,
            Subject = entry.Subject,
            Status = entry.Status,
            Provider = entry.Provider,
            HttpStatusCode = entry.HttpStatusCode,
            FromEmail = entry.FromEmail,
            ErrorDetail = err,
        });

        await _db.SaveChangesAsync(cancellationToken);
    }
}
