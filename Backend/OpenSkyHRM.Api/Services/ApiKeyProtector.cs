using Microsoft.AspNetCore.DataProtection;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Services;

public sealed class ApiKeyProtector : IApiKeyProtector
{
    private const string Purpose = "OpenSkyHRM.OpenAI.ApiKey.v1";
    private readonly IDataProtector _protector;

    public ApiKeyProtector(IDataProtectionProvider provider) =>
        _protector = provider.CreateProtector(Purpose);

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string Unprotect(string stored) => _protector.Unprotect(stored);

    public bool IsProtected(string stored)
    {
        if (string.IsNullOrWhiteSpace(stored))
            return false;
        if (stored.StartsWith("sk-", StringComparison.Ordinal) || stored.StartsWith("sk_", StringComparison.Ordinal))
            return false;
        try
        {
            _protector.Unprotect(stored);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
