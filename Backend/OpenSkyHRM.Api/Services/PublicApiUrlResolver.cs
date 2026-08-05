using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves an API base URL that phones on the LAN can open (never prefers localhost for QR links).
/// </summary>
public static class PublicApiUrlResolver
{
    public static bool IsLoopbackHost(string? hostOrUrl)
    {
        if (string.IsNullOrWhiteSpace(hostOrUrl)) return true;

        var value = hostOrUrl.Trim();
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
            value = uri.Host;

        if (string.Equals(value, "localhost", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(value, "127.0.0.1", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(value, "::1", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(value, "0.0.0.0", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(value, "10.0.2.2", StringComparison.OrdinalIgnoreCase))
            return true; // Android emulator host loopback — not reachable from a real phone

        return IPAddress.TryParse(value, out var ip) && IPAddress.IsLoopback(ip);
    }

    public static string Resolve(
        IConfiguration config,
        HttpRequest request,
        string? preferredBaseUrl = null)
    {
        var configured = (config["Mobile:PublicApiBaseUrl"] ?? "").Trim().TrimEnd('/');
        if (!string.IsNullOrEmpty(configured) && !IsLoopbackHost(configured))
            return configured;

        if (TryAbsoluteHttp(preferredBaseUrl, out var preferred) && !IsLoopbackHost(preferred))
            return preferred;

        var forwardedHost = request.Headers["X-Forwarded-Host"].FirstOrDefault();
        var forwardedProto = request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwardedHost) && !IsLoopbackHost(forwardedHost))
        {
            var scheme = string.IsNullOrWhiteSpace(forwardedProto) ? request.Scheme : forwardedProto;
            return $"{scheme}://{forwardedHost}".TrimEnd('/');
        }

        var requestBase = $"{request.Scheme}://{request.Host.Value}".TrimEnd('/');
        if (!IsLoopbackHost(requestBase))
            return requestBase;

        var lanIp = TryGetLanIPv4();
        if (!string.IsNullOrWhiteSpace(lanIp))
        {
            var port = request.Host.Port
                       ?? (string.Equals(request.Scheme, "https", StringComparison.OrdinalIgnoreCase) ? 443 : 80);
            // Keep explicit port for local Kestrel (e.g. :5000).
            if ((request.Scheme == "http" && port == 80) || (request.Scheme == "https" && port == 443))
                return $"{request.Scheme}://{lanIp}";
            return $"{request.Scheme}://{lanIp}:{port}";
        }

        if (!string.IsNullOrEmpty(configured))
            return configured;

        return requestBase;
    }

    private static bool TryAbsoluteHttp(string? value, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
        normalized = $"{uri.Scheme}://{uri.Authority}".TrimEnd('/');
        return true;
    }

    public static string? TryGetLanIPv4()
    {
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.OperationalStatus != OperationalStatus.Up) continue;
            if (ni.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
                continue;

            var props = ni.GetIPProperties();
            foreach (var ua in props.UnicastAddresses)
            {
                if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                if (IPAddress.IsLoopback(ua.Address)) continue;

                var ip = ua.Address.ToString();
                if (ip.StartsWith("169.254.", StringComparison.Ordinal)) continue; // APIPA
                return ip;
            }
        }

        return null;
    }
}
