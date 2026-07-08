using System.Net;

namespace OpenSkyHRM.Application.Common;

public static class OfferLetterHelper
{
    public const string DefaultCompanyName = "OpenSky HRM";

    public const string HeaderGradientStyle =
        "background: linear-gradient(90deg, #1a3a6e 0%, #1e4a8c 50%, #2e78e6 100%); padding: 28px 36px; color: white;";

    public static string BuildOfferLetterHeaderHtml(string? logoUrl, string companyName)
    {
        var resolvedCompanyName = string.IsNullOrWhiteSpace(companyName) ? DefaultCompanyName : companyName.Trim();
        var encodedName = WebUtility.HtmlEncode(resolvedCompanyName);

        var logoHtml = "";
        if (!string.IsNullOrWhiteSpace(logoUrl))
        {
            var encodedUrl = WebUtility.HtmlEncode(logoUrl);
            var alt = WebUtility.HtmlEncode($"{resolvedCompanyName} logo");
            logoHtml = $"""
                <img src="{encodedUrl}" alt="{alt}" style="height: 80px; max-width: 200px; width: auto; object-fit: contain; display: block; flex-shrink: 0;" />
                """;
        }

        return $"""
            <div style="display: flex; align-items: center; gap: 24px;">
              {logoHtml}
              <div style="min-width: 0; flex: 1;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Offer of Employment</h1>
                <p style="margin: 8px 0 0; font-size: 15px; font-weight: 400; opacity: 0.9;">{encodedName}</p>
              </div>
            </div>
            """;
    }

    public static string BuildCompanyLogoHtml(string? logoUrl, string companyName) =>
        BuildOfferLetterHeaderHtml(logoUrl, companyName);

    /// <summary>Upgrades legacy offer templates that predate company branding placeholders.</summary>
    public static string EnsureBrandingPlaceholders(string html)
    {
        if (html.Contains("{{CompanyHeaderHtml}}", StringComparison.Ordinal))
            return html;

        const string modernHeaderBlock =
            "{{CompanyLogoHtml}}\n      <h1 style=\"margin: 0; font-size: 24px; font-weight: 600;\">Offer of Employment</h1>\n      <p style=\"margin: 8px 0 0; opacity: 0.85; font-size: 14px;\">{{CompanyName}}</p>";
        if (html.Contains(modernHeaderBlock, StringComparison.Ordinal))
        {
            return html.Replace(modernHeaderBlock, "{{CompanyHeaderHtml}}", StringComparison.Ordinal);
        }

        const string headerTitle = "<h1 style=\"margin: 0; font-size: 24px; font-weight: 600;\">Offer of Employment</h1>";
        if (html.Contains(headerTitle, StringComparison.Ordinal))
        {
            html = html.Replace(headerTitle, "{{CompanyHeaderHtml}}", StringComparison.Ordinal);
        }

        const string headerSubtitle = "<p style=\"margin: 8px 0 0; opacity: 0.85; font-size: 14px;\">OpenSky HRM</p>";
        if (html.Contains(headerSubtitle, StringComparison.Ordinal))
        {
            html = html.Replace(
                headerSubtitle,
                "",
                StringComparison.Ordinal);
        }

        if (html.Contains("{{CompanyLogoHtml}}", StringComparison.Ordinal))
        {
            html = html.Replace("{{CompanyLogoHtml}}", "{{CompanyHeaderHtml}}", StringComparison.Ordinal);
        }

        const string signoff = "<span style=\"color: #666; font-size: 13px;\">OpenSky HRM</span>";
        if (html.Contains(signoff, StringComparison.Ordinal))
        {
            html = html.Replace(
                signoff,
                "<span style=\"color: #666; font-size: 13px;\">{{CompanyName}}</span>",
                StringComparison.Ordinal);
        }

        return html;
    }

    public static Dictionary<string, string> BuildReplacements(
        string candidateName,
        string positionTitle,
        decimal salary,
        string currency,
        DateTime? joiningDate,
        DateTime? offerDate,
        DateTime? expiryDate,
        string? remarks,
        string companyName = DefaultCompanyName,
        string? companyHeaderHtml = null)
    {
        var remarksHtml = string.IsNullOrWhiteSpace(remarks)
            ? ""
            : $"<p style=\"font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 20px;\">{WebUtility.HtmlEncode(remarks)}</p>";

        var resolvedCompanyName = string.IsNullOrWhiteSpace(companyName) ? DefaultCompanyName : companyName.Trim();
        var headerHtml = companyHeaderHtml ?? BuildOfferLetterHeaderHtml(null, resolvedCompanyName);

        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["{{CandidateName}}"] = WebUtility.HtmlEncode(candidateName),
            ["{{PositionTitle}}"] = WebUtility.HtmlEncode(positionTitle),
            ["{{RequisitionTitle}}"] = WebUtility.HtmlEncode(positionTitle),
            ["{{SalaryFormatted}}"] = WebUtility.HtmlEncode($"{currency} {salary:N0}"),
            ["{{JoiningDate}}"] = WebUtility.HtmlEncode(joiningDate.HasValue ? joiningDate.Value.ToString("dd MMM yyyy") : "—"),
            ["{{OfferDate}}"] = WebUtility.HtmlEncode(offerDate.HasValue ? offerDate.Value.ToString("dd MMM yyyy") : "—"),
            ["{{ExpiryDate}}"] = WebUtility.HtmlEncode(expiryDate.HasValue ? expiryDate.Value.ToString("dd MMM yyyy") : "—"),
            ["{{RemarksHtml}}"] = remarksHtml,
            ["{{CompanyName}}"] = WebUtility.HtmlEncode(resolvedCompanyName),
            ["{{CompanyHeaderHtml}}"] = headerHtml,
            ["{{CompanyLogoHtml}}"] = "",
        };
    }

    public static string Merge(string template, IReadOnlyDictionary<string, string> replacements)
    {
        var result = template;
        foreach (var (key, value) in replacements)
            result = result.Replace(key, value, StringComparison.Ordinal);
        return result;
    }

    /// <summary>Normalizes merged HTML headers to the current requisition-style layout.</summary>
    public static string InjectBrandingIntoHtml(string html, string companyName, string companyHeaderHtml)
    {
        if (string.IsNullOrWhiteSpace(html))
            return html;

        if (html.Contains("display: flex; align-items: center; gap: 24px;", StringComparison.Ordinal)
            && html.Contains("#1a3a6e", StringComparison.OrdinalIgnoreCase))
            return html;

        const string headerOpen = "<div style=\"background: linear-gradient";
        var headerStart = html.IndexOf(headerOpen, StringComparison.OrdinalIgnoreCase);
        if (headerStart < 0)
            return html;

        var bodyStart = html.IndexOf("<div style=\"padding:", headerStart, StringComparison.OrdinalIgnoreCase);
        if (bodyStart < 0)
            return html;

        var normalizedHeader = $"<div style=\"{HeaderGradientStyle}\">{companyHeaderHtml}</div>\n    ";
        return html[..headerStart] + normalizedHeader + html[bodyStart..];
    }

    public static string NormalizeUploadPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "";
        var trimmed = path.Trim();
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return trimmed;
        return trimmed.StartsWith('/') ? trimmed : $"/{trimmed}";
    }
}
