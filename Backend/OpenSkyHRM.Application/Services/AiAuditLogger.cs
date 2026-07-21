using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AiAuditLogger : IAiAuditLogger
{
    private readonly AppDbContext _db;

    public AiAuditLogger(AppDbContext db) => _db = db;

    public async Task LogAsync(Guid userId, string toolName, string argsRedactedJson, string resultSummary, CancellationToken ct = default)
    {
        _db.Set<AiToolAuditLog>().Add(new AiToolAuditLog
        {
            UserId = userId,
            ToolName = toolName,
            ArgsRedactedJson = Truncate(argsRedactedJson, 4000),
            ResultSummary = Truncate(resultSummary, 500),
        });
        await _db.SaveChangesAsync(ct);
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
