namespace OpenSkyHRM.Application.Interfaces;

/// <summary>Browser site that triggered the current request, when one is available.</summary>
public interface IPublicAppUrlAccessor
{
    /// <summary>Absolute origin such as <c>https://rambank.openskyhrm.com</c> or <c>http://localhost:3001</c>.</summary>
    string? TryGetBrowserBaseUrl();
}

/// <summary>Used when no HTTP request is in scope, such as background jobs.</summary>
public sealed class NullPublicAppUrlAccessor : IPublicAppUrlAccessor
{
    public string? TryGetBrowserBaseUrl() => null;
}
