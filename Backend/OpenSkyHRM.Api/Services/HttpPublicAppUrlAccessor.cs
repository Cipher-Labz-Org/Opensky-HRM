using Microsoft.AspNetCore.Http;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Services;

/// <summary>Reads the site the user is on so email links match that site, including the dev port.</summary>
public sealed class HttpPublicAppUrlAccessor : IPublicAppUrlAccessor
{
    public const string WebOriginHeader = "X-OpenSky-Web-Origin";

    private readonly IHttpContextAccessor _http;

    public HttpPublicAppUrlAccessor(IHttpContextAccessor http) => _http = http;

    public string? TryGetBrowserBaseUrl()
    {
        var request = _http.HttpContext?.Request;
        if (request == null) return null;

        if (TryOrigin(request.Headers[WebOriginHeader].FirstOrDefault(), out var forwarded))
            return forwarded;
        if (TryOrigin(request.Headers.Origin.FirstOrDefault(), out var origin))
            return origin;
        if (Uri.TryCreate(request.Headers.Referer.FirstOrDefault(), UriKind.Absolute, out var referer)
            && TryOrigin(referer.GetLeftPart(UriPartial.Authority), out var refererOrigin))
            return refererOrigin;

        return null;
    }

    private static bool TryOrigin(string? raw, out string origin)
    {
        origin = "";
        if (string.IsNullOrWhiteSpace(raw)) return false;
        if (!Uri.TryCreate(raw.Trim(), UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
        origin = uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        return origin.Length > 0;
    }
}
