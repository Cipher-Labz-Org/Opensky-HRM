using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Filters;

/// <summary>
/// Returns 403 when none of the listed modules is licensed for this instance.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireLicensedModuleAnyAttribute : Attribute, IAsyncAuthorizationFilter
{
    public string[] ModuleCodes { get; }

    public RequireLicensedModuleAnyAttribute(params string[] moduleCodes)
    {
        ModuleCodes = moduleCodes ?? Array.Empty<string>();
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
            return;

        var licensing = context.HttpContext.RequestServices.GetRequiredService<ILicensingService>();
        foreach (var code in ModuleCodes)
        {
            if (string.IsNullOrWhiteSpace(code)) continue;
            if (await licensing.IsModuleLicensedAsync(code, context.HttpContext.RequestAborted))
                return;
        }

        context.Result = new ObjectResult(new
        {
            code = "MODULE_NOT_LICENSED",
            module = string.Join(',', ModuleCodes.Where(c => !string.IsNullOrWhiteSpace(c)))
        })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
}
