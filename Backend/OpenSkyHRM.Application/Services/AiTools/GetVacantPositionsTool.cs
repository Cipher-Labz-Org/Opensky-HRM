using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetVacantPositionsTool : AiToolBase
{
    public override string Name => "get_vacant_positions";
    public override string Description =>
        "List vacant organizational positions (unfilled seats in the org structure).";
    public override IReadOnlyList<string> RequiredModules => ["OrgStructure"];
    public override IReadOnlyList<string> RequiredPermissions => ["OrgStructure:Read:All"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max rows (default 15)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var limit = Math.Clamp(GetInt(args, "limit") ?? 15, 1, 50);

        var q = ctx.Db.Positions.AsNoTracking()
            .Where(p => !p.IsDeleted && p.IsVacant);

        var total = await q.CountAsync(ct);
        var positions = await q
            .OrderBy(p => p.Department!.Name).ThenBy(p => p.Title)
            .Take(limit)
            .Select(p => new
            {
                p.Title,
                p.Code,
                department = p.Department != null ? p.Department.Name : null,
                location = p.Location != null ? p.Location.Name : null,
                jobTitle = p.JobTitle != null ? p.JobTitle.Title : null,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new { totalVacant = total, positions },
            total == 0 ? "No vacant positions" : $"{total} vacant position(s) in org structure");
    }
}
