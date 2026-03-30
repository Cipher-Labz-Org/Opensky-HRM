namespace OpenSkyHRM.Domain;

/// <summary>
/// Current wall-clock time in the configured business timezone for <c>timestamp without time zone</c> columns.
/// </summary>
public interface IBusinessClock
{
    DateTime Now { get; }
}
