namespace OpenSkyHRM.Persistence.Auditing;

/// <summary>Request-scoped identity for attributing EF changes to a signed-in user.</summary>
public interface ICurrentAuditUser
{
    Guid? UserId { get; }
    string? UserName { get; }
}
