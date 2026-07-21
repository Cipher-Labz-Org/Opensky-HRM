using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public sealed class AiDataRetentionService : IAiDataRetentionService
{
    private readonly AppDbContext _db;
    private readonly OpenAiSettingsResolver _settings;

    public AiDataRetentionService(AppDbContext db, OpenAiSettingsResolver settings)
    {
        _db = db;
        _settings = settings;
    }

    public async Task<int> PurgeExpiredConversationsAsync(CancellationToken ct = default)
    {
        var days = await _settings.GetChatRetentionDaysAsync(ct);
        var cutoff = DateTime.UtcNow.AddDays(-days);

        var expiredConvIds = await _db.Set<AiConversation>()
            .Where(c => !c.IsDeleted && (c.UpdatedAt ?? c.CreatedAt) < cutoff)
            .Select(c => c.Id)
            .ToListAsync(ct);

        if (expiredConvIds.Count == 0)
            return 0;

        var messages = await _db.Set<AiMessage>()
            .Where(m => expiredConvIds.Contains(m.ConversationId))
            .ToListAsync(ct);
        _db.Set<AiMessage>().RemoveRange(messages);

        var feedbackMessageIds = messages.Select(m => m.Id).ToList();
        var feedbacks = await _db.Set<AiMessageFeedback>()
            .Where(f => feedbackMessageIds.Contains(f.MessageId))
            .ToListAsync(ct);
        _db.Set<AiMessageFeedback>().RemoveRange(feedbacks);

        var convs = await _db.Set<AiConversation>()
            .Where(c => expiredConvIds.Contains(c.Id))
            .ToListAsync(ct);
        _db.Set<AiConversation>().RemoveRange(convs);

        await _db.SaveChangesAsync(ct);
        return expiredConvIds.Count;
    }

    public async Task<int> PurgeExpiredAuditLogsAsync(CancellationToken ct = default)
    {
        var days = await _settings.GetAuditRetentionDaysAsync(ct);
        var cutoff = DateTime.UtcNow.AddDays(-days);

        var expired = await _db.Set<AiToolAuditLog>()
            .Where(l => l.CreatedAt < cutoff)
            .ToListAsync(ct);

        if (expired.Count == 0)
            return 0;

        _db.Set<AiToolAuditLog>().RemoveRange(expired);
        await _db.SaveChangesAsync(ct);
        return expired.Count;
    }

    public async Task DeleteAllUserDataAsync(Guid userId, CancellationToken ct = default)
    {
        var convIds = await _db.Set<AiConversation>()
            .Where(c => c.UserId == userId)
            .Select(c => c.Id)
            .ToListAsync(ct);

        if (convIds.Count == 0)
            return;

        var messages = await _db.Set<AiMessage>()
            .Where(m => convIds.Contains(m.ConversationId))
            .ToListAsync(ct);
        var messageIds = messages.Select(m => m.Id).ToList();

        var feedbacks = await _db.Set<AiMessageFeedback>()
            .Where(f => f.UserId == userId || messageIds.Contains(f.MessageId))
            .ToListAsync(ct);
        _db.Set<AiMessageFeedback>().RemoveRange(feedbacks);
        _db.Set<AiMessage>().RemoveRange(messages);

        var convs = await _db.Set<AiConversation>()
            .Where(c => c.UserId == userId)
            .ToListAsync(ct);
        _db.Set<AiConversation>().RemoveRange(convs);

        await _db.SaveChangesAsync(ct);
    }

    public async Task<object> ExportUserDataAsync(Guid userId, CancellationToken ct = default)
    {
        var conversations = await _db.Set<AiConversation>().AsNoTracking()
            .Where(c => c.UserId == userId && !c.IsDeleted)
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.CreatedAt,
                UpdatedAt = c.UpdatedAt ?? c.CreatedAt,
            })
            .ToListAsync(ct);

        var convIds = conversations.Select(c => c.Id).ToList();
        var messages = await _db.Set<AiMessage>().AsNoTracking()
            .Where(m => convIds.Contains(m.ConversationId) && !m.IsDeleted && m.Role != "tool")
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.ConversationId,
                m.Role,
                m.Content,
                m.CreatedAt,
            })
            .ToListAsync(ct);

        var auditLogs = await _db.Set<AiToolAuditLog>().AsNoTracking()
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .Take(500)
            .Select(l => new
            {
                l.ToolName,
                l.ResultSummary,
                l.CreatedAt,
            })
            .ToListAsync(ct);

        return new
        {
            exportedAt = DateTime.UtcNow,
            userId,
            conversationCount = conversations.Count,
            conversations,
            messages,
            toolAuditSample = auditLogs,
        };
    }
}
