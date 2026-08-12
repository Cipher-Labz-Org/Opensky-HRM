using System.Text.RegularExpressions;

namespace OpenSkyHRM.Api.Controllers;

internal static class AdmsWebhookUrlHelper
{
    public static string? RecommendWebhookUrl(string? host, string scheme = "https")
    {
        if (string.IsNullOrWhiteSpace(host))
            return null;

        var h = host.Trim().ToLowerInvariant();
        if (h.StartsWith("www."))
            h = h[4..];

        if (h.EndsWith("backend.openskyhrm.com", StringComparison.Ordinal))
            return $"{scheme}://{h}/api/biometric/adms/logs";

        var match = Regex.Match(h, @"^([a-z0-9-]+)\.openskyhrm\.com$", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            var slug = match.Groups[1].Value.ToLowerInvariant();
            if (slug is "www" or "app" or "api")
                return null;
            return $"{scheme}://{slug}backend.openskyhrm.com/api/biometric/adms/logs";
        }

        if (h is "localhost" or "127.0.0.1")
            return null;

        return $"{scheme}://{h}/api/biometric/adms/logs";
    }
}
