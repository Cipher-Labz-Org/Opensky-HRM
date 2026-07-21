using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class OpenAiChatClientTests
{
    [Fact]
    public async Task BuildRequestUrl_OpenAI_UsesPublicEndpoint()
    {
        var settings = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()));
        var client = new OpenAiChatClient(settings, null!, null!);

        var (url, useApiKeyHeader) = await client.BuildRequestUrlAsync(OpenAiProvider.OpenAI);

        Assert.Equal("https://api.openai.com/v1/chat/completions", url);
        Assert.False(useApiKeyHeader);
    }

    [Fact]
    public async Task BuildRequestUrl_Azure_UsesDeploymentUrl()
    {
        var settings = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()
        {
            [OpenAiSettingsResolver.AzureEndpointSetting] = "https://test.openai.azure.com",
            [OpenAiSettingsResolver.AzureDeploymentSetting] = "gpt-4o-mini",
        }));
        var client = new OpenAiChatClient(settings, null!, null!);

        var (url, useApiKeyHeader) = await client.BuildRequestUrlAsync(OpenAiProvider.AzureOpenAI);

        Assert.Contains("test.openai.azure.com", url);
        Assert.Contains("deployments/gpt-4o-mini", url);
        Assert.True(useApiKeyHeader);
    }
}

public class AiLlmPayloadSanitizerTests
{
    [Fact]
    public async Task SanitizeToolPayload_StripsEmail_AndRedactsNames_WhenDisabled()
    {
        var settings = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()
        {
            [OpenAiSettingsResolver.AllowPersonalNamesSetting] = "false",
        }));
        var sanitizer = new AiLlmPayloadSanitizer(settings);

        var json = """{"name":"Jane Doe","employeeCode":"EMP-001","email":"jane@example.com","total":3}""";
        var result = await sanitizer.SanitizeToolPayloadAsync(json);

        Assert.DoesNotContain("jane@example.com", result, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Jane Doe", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("EMP-001", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SanitizeToolPayload_KeepsNames_WhenEnabled()
    {
        var settings = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()
        {
            [OpenAiSettingsResolver.AllowPersonalNamesSetting] = "true",
        }));
        var sanitizer = new AiLlmPayloadSanitizer(settings);

        var json = """{"name":"Jane Doe","email":"jane@example.com"}""";
        var result = await sanitizer.SanitizeToolPayloadAsync(json);

        Assert.Contains("Jane Doe", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SanitizeSystemPrompt_RemovesUserNameLine_WhenNamesDisabled()
    {
        var settings = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()));
        var sanitizer = new AiLlmPayloadSanitizer(settings);

        var prompt = "You are OpenSky AI.\n\nUser: Jane Admin\nRoles: ADMIN";
        var result = await sanitizer.SanitizeSystemPromptAsync(prompt);

        Assert.DoesNotContain("Jane Admin", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Roles: ADMIN", result, StringComparison.OrdinalIgnoreCase);
    }
}

public class ApiKeyProtectorLogicTests
{
    [Fact]
    public void IsProtected_DetectsPlaintextSkPrefix()
    {
        var protector = new FakeApiKeyProtector();
        Assert.False(protector.IsProtected("sk-test-key"));
        Assert.True(protector.IsProtected("CfDJ8-protected-value"));
    }

    private sealed class FakeApiKeyProtector : IApiKeyProtector
    {
        public string Protect(string plaintext) => "CfDJ8-" + plaintext;
        public string Unprotect(string stored) => stored["CfDJ8-".Length..];
        public bool IsProtected(string stored) =>
            !string.IsNullOrWhiteSpace(stored)
            && !stored.StartsWith("sk-", StringComparison.Ordinal)
            && stored.StartsWith("CfDJ8-", StringComparison.Ordinal);
    }
}

public class OpenAiSettingsResolverGdprTests
{
    [Fact]
    public async Task GetChatRetentionDays_DefaultsTo90()
    {
        var resolver = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()));
        Assert.Equal(90, await resolver.GetChatRetentionDaysAsync());
    }

    [Fact]
    public async Task GetAllowPersonalNamesInLlm_DefaultsFalse()
    {
        var resolver = new OpenAiSettingsResolver(new ConfigurationBuilder().Build(), new FakeSystemSettingService(new()));
        Assert.False(await resolver.GetAllowPersonalNamesInLlmAsync());
    }
}

internal sealed class FakeSystemSettingService : ISystemSettingService
{
    private readonly Dictionary<string, string> _values;
    public FakeSystemSettingService(Dictionary<string, string> values) => _values = values;
    public Task<string?> GetAsync(string key) => Task.FromResult(_values.TryGetValue(key, out var v) ? v : null);
    public Task SetAsync(string key, string value) { _values[key] = value; return Task.CompletedTask; }
    public Task<Dictionary<string, string>> GetAllAsync() => Task.FromResult(_values);
    public Task<string> GenerateNextEmployeeCodeAsync() => Task.FromResult("EMP-001");
}
