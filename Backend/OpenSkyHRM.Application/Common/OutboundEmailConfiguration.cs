using Microsoft.Extensions.Configuration;

namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Single place for SendGrid/API email resolution so leave, recruitment (candidate applications),
/// interviews, offers, and startup diagnostics agree on the same key sources.
/// </summary>
public static class OutboundEmailConfiguration
{
    /// <summary>
    /// SendGrid key from configuration, then <c>SENDGRID_API_KEY</c>, then <c>SendGrid__ApiKey</c>
    /// (matches ASP.NET env binding for nested keys when reading env directly).
    /// </summary>
    public static string? GetSendGridApiKey(IConfiguration config)
    {
        var v = config["SendGrid:ApiKey"];
        if (!string.IsNullOrWhiteSpace(v))
            return v.Trim();

        var sendgridEnv = Environment.GetEnvironmentVariable("SENDGRID_API_KEY");
        if (!string.IsNullOrWhiteSpace(sendgridEnv))
            return sendgridEnv.Trim();

        var sendGridSectionEnv = Environment.GetEnvironmentVariable("SendGrid__ApiKey");
        if (!string.IsNullOrWhiteSpace(sendGridSectionEnv))
            return sendGridSectionEnv.Trim();

        return null;
    }

    public static bool IsEmailProviderConfigured(IConfiguration config) =>
        !string.IsNullOrWhiteSpace(GetSendGridApiKey(config))
        || !string.IsNullOrWhiteSpace(config["Smtp:Host"]);
}
