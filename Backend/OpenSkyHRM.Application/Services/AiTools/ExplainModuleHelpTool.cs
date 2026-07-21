using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class ExplainModuleHelpTool : AiToolBase
{
    public override string Name => "explain_module_help";
    public override string Description =>
        "Explain how to use an OpenSky HRM module. Use for how-to questions about navigation and features.";
    public override IReadOnlyList<string> RequiredModules => [];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            module = new { type = "string", description = "Module slug or name, e.g. people, leave, recruitment" },
        },
        required = new[] { "module" },
    });

    public override Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var module = GetString(args, "module");
        if (string.IsNullOrWhiteSpace(module))
            return Task.FromResult(AiToolResult.Denied("module is required"));

        var topic = AiHelpTopics.Find(module);
        if (topic == null)
        {
            var available = string.Join(", ", AiHelpTopics.Topics.Select(t => t.Title));
            return Task.FromResult(AiToolResult.Ok(new
            {
                found = false,
                message = $"No help topic matched '{module}'. Available modules: {available}",
            }, "Help topic not found"));
        }

        if (!ctx.User.LicensedModules.Any(m =>
                string.Equals(m, topic.ModuleCode, StringComparison.OrdinalIgnoreCase)
                || string.Equals(m, "Dashboard", StringComparison.OrdinalIgnoreCase)))
        {
            return Task.FromResult(AiToolResult.Denied(
                $"The {topic.Title} module is not licensed for your organization."));
        }

        return Task.FromResult(AiToolResult.Ok(new
        {
            found = true,
            slug = topic.Slug,
            title = topic.Title,
            description = topic.Description,
            moduleCode = topic.ModuleCode,
        }, $"Help for {topic.Title}"));
    }
}
