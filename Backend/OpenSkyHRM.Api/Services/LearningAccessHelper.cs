using System.Security.Claims;

namespace OpenSkyHRM.Api.Services;

public static class LearningAccessHelper
{
    public static bool CanManageLearningCatalog(ClaimsPrincipal user)
    {
        if (user.IsInRole("ADMIN"))
            return true;

        var perms = user.FindAll("permission").Select(c => c.Value).ToList();
        return perms.Any(static p =>
            p.StartsWith("Learning:", StringComparison.OrdinalIgnoreCase) &&
            (p.Contains(":Create:All", StringComparison.OrdinalIgnoreCase) ||
             p.Contains(":Update:All", StringComparison.OrdinalIgnoreCase) ||
             p.Contains(":Delete:All", StringComparison.OrdinalIgnoreCase)));
    }
}
