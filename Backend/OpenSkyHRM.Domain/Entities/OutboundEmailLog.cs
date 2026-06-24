using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>Audit record for each outbound transactional email attempt.</summary>
public class OutboundEmailLog : BaseEntity
{
    /// <summary>E.g. LeaveApplication, RecruitmentOffer.</summary>
    public string Category { get; set; } = string.Empty;

    public string RecipientEmail { get; set; } = string.Empty;
    public string? RecipientName { get; set; }
    public string Subject { get; set; } = string.Empty;

    /// <summary>Sent, Failed, or SkippedNotConfigured.</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>SendGrid, Smtp, or None.</summary>
    public string Provider { get; set; } = string.Empty;

    public int? HttpStatusCode { get; set; }
    public string? FromEmail { get; set; }

    /// <summary>Provider error body or exception message (truncated when stored).</summary>
    public string? ErrorDetail { get; set; }

    /// <summary>
    /// When true, <see cref="BaseEntity.CreatedAt"/> is UTC wall clock; when false (legacy rows), it is already Sri Lanka local time.
    /// </summary>
    public bool CreatedAtIsUtc { get; set; }
}
