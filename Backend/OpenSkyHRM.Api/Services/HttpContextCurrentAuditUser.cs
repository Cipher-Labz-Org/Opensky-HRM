using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using OpenSkyHRM.Persistence.Auditing;

namespace OpenSkyHRM.Api.Services;

public sealed class HttpContextCurrentAuditUser : ICurrentAuditUser
{
    private readonly IHttpContextAccessor _http;

    public HttpContextCurrentAuditUser(IHttpContextAccessor http) => _http = http;

    public Guid? UserId
    {
        get
        {
            var user = _http.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
                return null;
            var sub = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public string? UserName => _http.HttpContext?.User.FindFirstValue("username");
}
