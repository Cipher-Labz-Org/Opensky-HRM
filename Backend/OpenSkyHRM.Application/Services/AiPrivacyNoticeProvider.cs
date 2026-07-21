using OpenSkyHRM.Application.Common;

namespace OpenSkyHRM.Application.Services;

public static class AiPrivacyNoticeProvider
{
    public static string BuildNotice(OpenAiPrivacySnapshot snapshot) =>
        $"""
        OpenSky AI — Privacy Notice

        What this feature does
        OpenSky AI answers HR questions by calling read-only tools in OpenSky HRM. Your questions and summarized HR data may be sent to an external language model to generate a response.

        AI provider
        Provider: {snapshot.Provider}
        Region: {snapshot.Region ?? "Not specified — configure under Policy & Settings"}
        Employee names in AI requests: {(snapshot.AllowPersonalNamesInLlm ? "Enabled" : "Disabled (recommended for GDPR)")}

        Data retention
        Chat history: {snapshot.ChatRetentionDays} days
        Tool audit logs: {snapshot.AuditRetentionDays} days

        Your rights (GDPR)
        - Access: export your AI chat history from the OpenSky AI panel
        - Erasure: delete all your AI history from the OpenSky AI panel
        - Restrict processing: contact your HR administrator to disable OpenSky AI for your organization

        Administrator responsibilities
        - Sign a Data Processing Agreement with your AI provider (Microsoft Azure OpenAI or OpenAI)
        - Complete a Data Protection Impact Assessment before production use
        - For EU production, use Azure OpenAI in an EU region and keep personal names disabled

        Data sent to the AI provider may include: your question text, your role/scope, aggregated HR metrics, and (if enabled) employee identifiers from tool results. OpenSky does not send your full HR database.
        """;
}
