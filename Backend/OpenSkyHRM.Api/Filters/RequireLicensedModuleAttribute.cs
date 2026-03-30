using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Filters;

/// <summary>
/// Returns 403 when the instance does not license this module (after authentication).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireLicensedModuleAttribute : Attribute, IAsyncAuthorizationFilter
{
    public string ModuleCode { get; }

    public RequireLicensedModuleAttribute(string moduleCode)
    {
        ModuleCode = moduleCode;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
            return;

        var licensing = context.HttpContext.RequestServices.GetRequiredService<ILicensingService>();
        if (await licensing.IsModuleLicensedAsync(ModuleCode, context.HttpContext.RequestAborted))
            return;

        context.Result = new ObjectResult(new { code = "MODULE_NOT_LICENSED", module = ModuleCode })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
}
