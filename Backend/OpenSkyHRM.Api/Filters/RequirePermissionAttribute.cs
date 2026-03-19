using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace OpenSkyHRM.Api.Filters;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequirePermissionAttribute : Attribute, IAuthorizationFilter
{
    private readonly string _module;
    private readonly string _action;

    public RequirePermissionAttribute(string module, string action)
    {
        _module = module;
        _action = action;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (!user.Identity?.IsAuthenticated ?? true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var permissions = user.Claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value)
            .ToList();

        var hasPermission = permissions.Any(p =>
        {
            var parts = p.Split(':');
            if (parts.Length < 2) return false;
            return parts[0] == _module && parts[1] == _action;
        });

        if (!hasPermission)
        {
            context.Result = new ForbidResult();
        }
    }
}
