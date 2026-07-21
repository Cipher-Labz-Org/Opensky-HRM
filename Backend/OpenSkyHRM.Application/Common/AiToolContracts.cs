using System.Text.Json;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Common;

public class AiToolContext
{
    public AiUserContext User { get; init; } = new();
    public AppDbContext Db { get; init; } = null!;
    public IServiceProvider Services { get; init; } = null!;
}

public interface IAiTool
{
    string Name { get; }
    string Description { get; }
    IReadOnlyList<string> RequiredModules { get; }
    IReadOnlyList<string> RequiredPermissions { get; }
    JsonDocument InputSchema { get; }
    Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct);
}
