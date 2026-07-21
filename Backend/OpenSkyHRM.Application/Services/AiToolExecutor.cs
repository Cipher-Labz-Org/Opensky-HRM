using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AiToolExecutor : IAiToolExecutor
{
    private readonly AppDbContext _db;
    private readonly IServiceProvider _services;
    private readonly IAiAuditLogger _audit;

    public AiToolExecutor(AppDbContext db, IServiceProvider services, IAiAuditLogger audit)
    {
        _db = db;
        _services = services;
        _audit = audit;
    }

    public async Task<AiToolResult> ExecuteAsync(IAiTool tool, AiUserContext user, JsonElement args, CancellationToken ct)
    {
        var ctx = new AiToolContext
        {
            User = user,
            Db = _db,
            Services = _services,
        };

        var redactedArgs = RedactArgs(args);
        AiToolResult result;
        try
        {
            result = await tool.ExecuteAsync(ctx, args, ct);
        }
        catch (Exception ex)
        {
            result = AiToolResult.Denied($"Tool execution failed: {ex.Message}");
        }

        await _audit.LogAsync(user.UserId, tool.Name, redactedArgs, SanitizeSummary(result.Summary), ct);
        return result;
    }

    private static string SanitizeSummary(string summary)
    {
        if (string.IsNullOrWhiteSpace(summary))
            return summary;
        // Avoid storing employee names in audit — keep counts/status only when possible.
        if (summary.Length > 200)
            return summary[..200];
        return summary;
    }

    private static string RedactArgs(JsonElement args)
    {
        try
        {
            var raw = args.GetRawText();
            return raw.Length > 2000 ? raw[..2000] : raw;
        }
        catch
        {
            return "{}";
        }
    }
}
