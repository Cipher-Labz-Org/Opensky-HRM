using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class AiConversationConfiguration : IEntityTypeConfiguration<AiConversation>
{
    public void Configure(EntityTypeBuilder<AiConversation> builder)
    {
        builder.ToTable("AiConversations");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => new { x.UserId, x.UpdatedAt });
        builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AiMessageConfiguration : IEntityTypeConfiguration<AiMessage>
{
    public void Configure(EntityTypeBuilder<AiMessage> builder)
    {
        builder.ToTable("AiMessages");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Role).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Content).HasMaxLength(16000).IsRequired();
        builder.Property(x => x.MetadataJson).HasMaxLength(8000);
        builder.HasIndex(x => new { x.ConversationId, x.CreatedAt });
        builder.HasOne(x => x.Conversation).WithMany(c => c.Messages).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AiMessageFeedbackConfiguration : IEntityTypeConfiguration<AiMessageFeedback>
{
    public void Configure(EntityTypeBuilder<AiMessageFeedback> builder)
    {
        builder.ToTable("AiMessageFeedbacks");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.MessageId, x.UserId }).IsUnique();
        builder.HasOne(x => x.Message).WithMany().HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AiToolAuditLogConfiguration : IEntityTypeConfiguration<AiToolAuditLog>
{
    public void Configure(EntityTypeBuilder<AiToolAuditLog> builder)
    {
        builder.ToTable("AiToolAuditLogs");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ToolName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.ArgsRedactedJson).HasMaxLength(4000).IsRequired();
        builder.Property(x => x.ResultSummary).HasMaxLength(500).IsRequired();
        builder.HasIndex(x => new { x.UserId, x.CreatedAt });
        builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
