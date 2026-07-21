using System.Net;
using System.Text.RegularExpressions;

namespace OpenSkyHRM.Application.Common;

public static partial class OfferLetterHelper
{
    public const string DefaultCompanyName = "OpenSky HRM";

    public const string HeaderGradientStyle =
        "background: linear-gradient(90deg, #1a3a6e 0%, #1e4a8c 50%, #2e78e6 100%); padding: 28px 36px; color: white;";

    public static string BuildOfferLetterHeaderHtml(string? logoUrl, string companyName)
    {
        var resolvedCompanyName = string.IsNullOrWhiteSpace(companyName) ? DefaultCompanyName : companyName.Trim();
        var encodedName = WebUtility.HtmlEncode(resolvedCompanyName);

        var logoHtml = "";
        if (!string.IsNullOrWhiteSpace(logoUrl) && !logoUrl.TrimEnd().EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
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
            ["{{OfferActionsHtml}}"] = "",
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

    public static string BuildOfferActionsHtml(string responseUrl)
    {
        if (string.IsNullOrWhiteSpace(responseUrl)) return "";

        var encodedUrl = WebUtility.HtmlEncode(responseUrl.Trim());
        var acceptUrl = WebUtility.HtmlEncode($"{responseUrl.Trim()}?action=accept");
        var negotiateUrl = WebUtility.HtmlEncode($"{responseUrl.Trim()}?action=negotiate");
        var rejectUrl = WebUtility.HtmlEncode($"{responseUrl.Trim()}?action=reject");

        return $"""
            <div style="margin: 28px 0 12px; padding: 24px; background: #f8f9fe; border-radius: 12px; text-align: center;">
              <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #1a1a2e;">Your response</p>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #555;">Please choose how you would like to proceed with this offer.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 6px;"><a href="{acceptUrl}" style="display: inline-block; padding: 12px 20px; background: #16a34a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Accept offer</a></td>
                  <td style="padding: 6px;"><a href="{negotiateUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Negotiate</a></td>
                  <td style="padding: 6px;"><a href="{rejectUrl}" style="display: inline-block; padding: 12px 20px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Decline</a></td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; font-size: 12px; color: #888;"><a href="{encodedUrl}" style="color: #2563eb; text-decoration: none;">Open offer response page</a></p>
            </div>
            """;
    }

    public static string InjectOfferActions(string html, string actionsHtml)
    {
        if (string.IsNullOrWhiteSpace(html) || string.IsNullOrWhiteSpace(actionsHtml))
            return html;

        html = StripPreviewOfferActions(html);

        if (html.Contains(actionsHtml, StringComparison.Ordinal)
            || html.Contains("Accept offer</a>", StringComparison.OrdinalIgnoreCase))
            return html;

        const string placeholder = "{{OfferActionsHtml}}";
        if (html.Contains(placeholder, StringComparison.Ordinal))
            return html.Replace(placeholder, actionsHtml, StringComparison.Ordinal);

        const string marker = "Please review the details and let us know your decision at your earliest convenience.";
        if (html.Contains(marker, StringComparison.Ordinal))
        {
            return html.Replace(
                marker,
                marker + actionsHtml,
                StringComparison.Ordinal);
        }

        const string footerMarker = "This is an automated email from";
        var footerIndex = html.IndexOf(footerMarker, StringComparison.OrdinalIgnoreCase);
        if (footerIndex > 0)
            return html.Insert(footerIndex, actionsHtml);

        return html + actionsHtml;
    }

    /// <summary>Removes non-clickable preview action buttons injected by the HR offer letter preview.</summary>
    public static string StripPreviewOfferActions(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return html;

        const string previewMarker = "When emailed, the candidate can accept";
        if (!html.Contains(previewMarker, StringComparison.OrdinalIgnoreCase))
            return html;

        return PreviewActionsBlockRegex().Replace(html, "");
    }

    [GeneratedRegex(
        @"<div style=""margin: 28px 0 12px; padding: 24px; background: #f8f9fe; border-radius: 12px; text-align: center;"">[\s\S]*?When emailed, the candidate can accept[\s\S]*?</div>",
        RegexOptions.IgnoreCase)]
    private static partial Regex PreviewActionsBlockRegex();
}
