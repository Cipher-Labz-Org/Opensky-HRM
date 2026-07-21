using System.Text.Json;
using OpenSkyHRM.Application.Common;

namespace OpenSkyHRM.Application.Services.AiTools;

public abstract class AiToolBase : IAiTool
{
    public abstract string Name { get; }
    public abstract string Description { get; }
    public abstract IReadOnlyList<string> RequiredModules { get; }
    public virtual IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();

    public abstract JsonDocument InputSchema { get; }
    public abstract Task<DTOs.AiAssistant.AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct);

    protected static JsonDocument Schema(object schema) =>
        JsonDocument.Parse(JsonSerializer.Serialize(schema));

    protected static string? GetString(JsonElement args, string name) =>
        args.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()?.Trim()
            : null;

    protected static int? GetInt(JsonElement args, string name) =>
        args.TryGetProperty(name, out var el) && el.TryGetInt32(out var v) ? v : null;
}
