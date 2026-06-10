using System.Net;

namespace OpenSkyHRM.Application.Common;

public static class OfferLetterHelper
{
    public static Dictionary<string, string> BuildReplacements(
        string candidateName,
        string positionTitle,
        decimal salary,
        string currency,
        DateTime? joiningDate,
        DateTime? offerDate,
        DateTime? expiryDate,
        string? remarks)
    {
        var remarksHtml = string.IsNullOrWhiteSpace(remarks)
            ? ""
            : $"<p style=\"font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 20px;\">{WebUtility.HtmlEncode(remarks)}</p>";

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
        };
    }

    public static string Merge(string template, IReadOnlyDictionary<string, string> replacements)
    {
        var result = template;
        foreach (var (key, value) in replacements)
            result = result.Replace(key, value, StringComparison.Ordinal);
        return result;
    }
}
