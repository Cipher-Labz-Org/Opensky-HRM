using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Auditing;

/// <summary>Writes <see cref="AuditLog"/> rows for People Hub entity changes (create, update, soft-delete).</summary>
public sealed class PeopleHubAuditSaveChangesInterceptor : SaveChangesInterceptor
{
    public const string PeopleModule = "People";

    private readonly ICurrentAuditUser _currentUser;
    private readonly IBusinessClock _clock;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    private static readonly HashSet<Type> AuditedEntityTypes =
    [
        typeof(Employee),
        typeof(EmployeeAttachment),
        typeof(EmployeeSupervisor),
        typeof(EmergencyContact),
        typeof(Dependent),
        typeof(Education),
        typeof(EmployeeSkill),
        typeof(EmployeeLanguage),
        typeof(EmployeeBenefit),
        typeof(Immigration),
        typeof(ImmigrationDocument),
        typeof(WorkExperience),
        typeof(BankAccount),
        typeof(EmployeeCompensation),
        typeof(SalaryRevision),
        typeof(EmployeeCertification),
        typeof(TrainingAssignment),
    ];

    private static readonly HashSet<string> SkipOnUpdateOnly =
    [
        nameof(BaseEntity.UpdatedAt),
    ];

    public PeopleHubAuditSaveChangesInterceptor(ICurrentAuditUser currentUser, IBusinessClock clock)
    {
        _currentUser = currentUser;
        _clock = clock;
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        AppendAuditEntries(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        AppendAuditEntries(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void AppendAuditEntries(DbContext? context)
    {
        if (context is not AppDbContext db) return;

        var userId = _currentUser.UserId;
        var userName = _currentUser.UserName;

        foreach (var entry in db.ChangeTracker.Entries()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                     .ToList())
        {
            if (entry.Entity is AuditLog)
                continue;

            if (!AuditedEntityTypes.Contains(entry.Metadata.ClrType))
                continue;

            var audit = BuildLog(entry, userId, userName);
            if (audit is null)
                continue;

            db.AuditLogs.Add(audit);
        }
    }

    private AuditLog? BuildLog(EntityEntry entry, Guid? userId, string? userName)
    {
        var now = _clock.Now;
        var entityName = entry.Metadata.ClrType.Name;
        var idProp = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
        var entityId = idProp?.CurrentValue ?? idProp?.OriginalValue;
        var entityIdStr = entityId?.ToString() ?? "";

        var subjectEmployeeId = ResolveSubjectEmployeeId(entry.Entity);

        switch (entry.State)
        {
            case EntityState.Added:
                return new AuditLog
                {
                    Module = PeopleModule,
                    SubjectEmployeeId = subjectEmployeeId,
                    EntityName = entityName,
                    EntityId = entityIdStr,
                    Action = "Create",
                    OldValues = null,
                    NewValues = SerializeScalars(entry, EntityState.Added, forOriginal: false),
                    UserId = userId?.ToString(),
                    UserName = userName,
                    CreatedAt = now,
                    Timestamp = now,
                };

            case EntityState.Deleted:
                return new AuditLog
                {
                    Module = PeopleModule,
                    SubjectEmployeeId = subjectEmployeeId,
                    EntityName = entityName,
                    EntityId = entityIdStr,
                    Action = "Delete",
                    OldValues = SerializeScalars(entry, EntityState.Deleted, forOriginal: true),
                    NewValues = null,
                    UserId = userId?.ToString(),
                    UserName = userName,
                    CreatedAt = now,
                    Timestamp = now,
                };

            case EntityState.Modified:
                var isSoftDelete = entry.Entity is BaseEntity
                                   && entry.Property(nameof(BaseEntity.IsDeleted)).IsModified
                                   && entry.Property(nameof(BaseEntity.IsDeleted)).CurrentValue is true
                                   && entry.Property(nameof(BaseEntity.IsDeleted)).OriginalValue is false;

                if (isSoftDelete)
                {
                    return new AuditLog
                    {
                        Module = PeopleModule,
                        SubjectEmployeeId = subjectEmployeeId,
                        EntityName = entityName,
                        EntityId = entityIdStr,
                        Action = "Delete",
                        OldValues = SerializeModifiedBefore(entry),
                        NewValues = SerializeScalars(entry, EntityState.Modified, forOriginal: false, onlyIsDeleted: true),
                        UserId = userId?.ToString(),
                        UserName = userName,
                        Timestamp = DateTime.UtcNow,
                    };
                }

                var changesNew = SerializeModifiedDiff(entry);
                if (string.IsNullOrEmpty(changesNew))
                    return null;

                var changesOld = SerializeModifiedDiffOriginal(entry);
                return new AuditLog
                {
                    Module = PeopleModule,
                    SubjectEmployeeId = subjectEmployeeId,
                    EntityName = entityName,
                    EntityId = entityIdStr,
                    Action = "Update",
                    OldValues = changesOld,
                    NewValues = changesNew,
                    UserId = userId?.ToString(),
                    UserName = userName,
                    CreatedAt = now,
                    Timestamp = now,
                };

            default:
                return null;
        }
    }

    private static Guid? ResolveSubjectEmployeeId(object entity)
    {
        if (entity is Employee e)
            return e.Id;

        var p = entity.GetType().GetProperty("EmployeeId");
        if (p?.GetValue(entity) is Guid g)
            return g;
        return null;
    }

    private static string? SerializeScalars(EntityEntry entry, EntityState state, bool forOriginal, bool onlyIsDeleted = false)
    {
        var dict = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var prop in entry.Properties)
        {
            if (prop.Metadata.IsPrimaryKey())
                continue;

            if (onlyIsDeleted && !string.Equals(prop.Metadata.Name, nameof(BaseEntity.IsDeleted), StringComparison.Ordinal))
                continue;

            object? val = state switch
            {
                EntityState.Deleted => forOriginal ? prop.OriginalValue : prop.CurrentValue,
                EntityState.Added => prop.CurrentValue,
                EntityState.Modified => prop.CurrentValue,
                _ => prop.CurrentValue,
            };

            dict[prop.Metadata.Name] = NormalizeForJson(val);
        }

        if (dict.Count == 0)
            return null;
        return JsonSerializer.Serialize(dict, JsonOpts);
    }

    private static string? SerializeModifiedBefore(EntityEntry entry)
    {
        var dict = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var prop in entry.Properties.Where(p => p.IsModified))
        {
            if (prop.Metadata.IsPrimaryKey())
                continue;
            dict[prop.Metadata.Name] = NormalizeForJson(prop.OriginalValue);
        }
        return dict.Count == 0 ? null : JsonSerializer.Serialize(dict, JsonOpts);
    }

    /// <summary>Only properties that actually changed; excludes timestamps-only churn.</summary>
    private static string? SerializeModifiedDiff(EntityEntry entry)
    {
        var changed = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var prop in entry.Properties.Where(p => p.IsModified))
        {
            if (prop.Metadata.IsPrimaryKey())
                continue;

            if (SkipOnUpdateOnly.Contains(prop.Metadata.Name))
                continue;

            if (Equals(prop.OriginalValue, prop.CurrentValue))
                continue;

            changed[prop.Metadata.Name] = NormalizeForJson(prop.CurrentValue);
        }

        if (changed.Count == 0)
            return null;
        return JsonSerializer.Serialize(changed, JsonOpts);
    }

    /// <summary>Same keys as <see cref="SerializeModifiedDiff"/> but original values (before state).</summary>
    private static string? SerializeModifiedDiffOriginal(EntityEntry entry)
    {
        var changed = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var prop in entry.Properties.Where(p => p.IsModified))
        {
            if (prop.Metadata.IsPrimaryKey())
                continue;

            if (SkipOnUpdateOnly.Contains(prop.Metadata.Name))
                continue;

            if (Equals(prop.OriginalValue, prop.CurrentValue))
                continue;

            changed[prop.Metadata.Name] = NormalizeForJson(prop.OriginalValue);
        }

        if (changed.Count == 0)
            return null;
        return JsonSerializer.Serialize(changed, JsonOpts);
    }

    private static object? NormalizeForJson(object? value)
        => value switch
        {
            DateTime dt => dt.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(dt, DateTimeKind.Utc)
                : dt.ToUniversalTime(),
            _ => value,
        };
}
