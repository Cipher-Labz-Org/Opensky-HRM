namespace OpenSkyHRM.Api.Services;

internal static class RbacScopeHelper
{
    internal static int Rank(string? scope) => scope switch
    {
        "All" => 3,
        "Team" => 2,
        "Own" => 1,
        _ => 0,
    };

    internal static string Normalize(string? scope) =>
        scope switch
        {
            "All" or "Team" or "Own" => scope,
            _ => "None",
        };

    /// <summary>Picks the broadest RBAC scope (All &gt; Team &gt; Own &gt; None).</summary>
    internal static string MaxScope(string? a, string? b)
    {
        var na = Normalize(a);
        var nb = Normalize(b);
        return Rank(na) >= Rank(nb) ? na : nb;
    }
}
