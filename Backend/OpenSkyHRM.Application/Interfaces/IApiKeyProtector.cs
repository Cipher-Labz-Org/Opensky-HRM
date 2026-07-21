namespace OpenSkyHRM.Application.Interfaces;

/// <summary>Encrypts/decrypts sensitive system setting values (e.g. OpenAI API key).</summary>
public interface IApiKeyProtector
{
    string Protect(string plaintext);
    string Unprotect(string stored);
    bool IsProtected(string stored);
}
