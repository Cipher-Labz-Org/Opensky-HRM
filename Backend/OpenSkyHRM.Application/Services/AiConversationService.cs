using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AiConversationService : IAiConversationService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly AppDbContext _db;

    public AiConversationService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AiConversationSummaryDto>> ListConversationsAsync(Guid userId, CancellationToken ct = default)
    {
        return await _db.Set<AiConversation>().AsNoTracking()
            .Where(c => !c.IsDeleted && c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .Take(30)
            .Select(c => new AiConversationSummaryDto
            {
                Id = c.Id,
                Title = c.Title,
                UpdatedAt = c.UpdatedAt ?? c.CreatedAt,
            })
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<AiMessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        var conv = await _db.Set<AiConversation>().AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId && !c.IsDeleted, ct);
        if (conv == null)
            throw new InvalidOperationException("Conversation not found.");

        var messages = await _db.Set<AiMessage>().AsNoTracking()
            .Where(m => !m.IsDeleted && m.ConversationId == conversationId && m.Role != "tool")
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

        return messages.Select(MapMessage).ToList();
    }

    public async Task DeleteConversationAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        var conv = await _db.Set<AiConversation>()
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId && !c.IsDeleted, ct);
        if (conv == null)
            throw new InvalidOperationException("Conversation not found.");

        conv.IsDeleted = true;
        conv.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task SetFeedbackAsync(Guid userId, Guid messageId, int rating, CancellationToken ct = default)
    {
        if (rating is not (1 or -1))
            throw new InvalidOperationException("Rating must be +1 or -1.");

        var message = await _db.Set<AiMessage>()
            .Include(m => m.Conversation)
            .FirstOrDefaultAsync(m => m.Id == messageId && !m.IsDeleted, ct);
        if (message == null || message.Conversation.UserId != userId)
            throw new InvalidOperationException("Message not found.");

        var existing = await _db.Set<AiMessageFeedback>()
            .FirstOrDefaultAsync(f => f.MessageId == messageId && f.UserId == userId && !f.IsDeleted, ct);

        if (existing == null)
        {
            _db.Set<AiMessageFeedback>().Add(new AiMessageFeedback
            {
                MessageId = messageId,
                UserId = userId,
                Rating = rating,
            });
        }
        else
        {
            existing.Rating = rating;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    internal async Task<AiConversation> GetOrCreateConversationAsync(Guid userId, Guid? conversationId, string firstMessage, CancellationToken ct)
    {
        if (conversationId.HasValue)
        {
            var existing = await _db.Set<AiConversation>()
                .FirstOrDefaultAsync(c => c.Id == conversationId.Value && c.UserId == userId && !c.IsDeleted, ct);
            if (existing != null)
                return existing;
        }

        var title = firstMessage.Length > 60 ? firstMessage[..57] + "..." : firstMessage;
        var conv = new AiConversation { UserId = userId, Title = title };
        _db.Set<AiConversation>().Add(conv);
        await _db.SaveChangesAsync(ct);
        return conv;
    }

    internal async Task<AiMessage> AddMessageAsync(Guid conversationId, string role, string content, object? metadata, CancellationToken ct)
    {
        var msg = new AiMessage
        {
            ConversationId = conversationId,
            Role = role,
            Content = content,
            MetadataJson = metadata == null ? null : JsonSerializer.Serialize(metadata, JsonOpts),
        };
        _db.Set<AiMessage>().Add(msg);

        var conv = await _db.Set<AiConversation>().FirstAsync(c => c.Id == conversationId, ct);
        conv.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return msg;
    }

    internal async Task<IReadOnlyList<AiMessage>> GetRecentMessagesAsync(Guid conversationId, int limit, CancellationToken ct)
    {
        return await _db.Set<AiMessage>().AsNoTracking()
            .Where(m => !m.IsDeleted && m.ConversationId == conversationId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);
    }

    internal async Task<int> CountUserMessagesTodayAsync(Guid userId, CancellationToken ct)
    {
        var start = DateTime.UtcNow.Date;
        return await _db.Set<AiMessage>().AsNoTracking()
            .Where(m => !m.IsDeleted && m.Role == "user"
                        && m.Conversation.UserId == userId
                        && m.CreatedAt >= start)
            .CountAsync(ct);
    }

    private static AiMessageDto MapMessage(AiMessage m)
    {
        var suggestions = Array.Empty<string>();
        if (!string.IsNullOrWhiteSpace(m.MetadataJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(m.MetadataJson);
                if (doc.RootElement.TryGetProperty("suggestedActions", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    suggestions = arr.EnumerateArray()
                        .Where(x => x.ValueKind == JsonValueKind.String)
                        .Select(x => x.GetString() ?? "")
                        .Where(x => x.Length > 0)
                        .ToArray();
                }
            }
            catch { /* ignore */ }
        }

        return new AiMessageDto
        {
            Id = m.Id,
            Role = m.Role,
            Content = m.Content,
            CreatedAt = m.CreatedAt,
            SuggestedActions = suggestions,
        };
    }
}
