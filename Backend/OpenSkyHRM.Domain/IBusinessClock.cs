namespace OpenSkyHRM.Domain;

/// <summary>
/// Current wall-clock time in the configured business timezone for <c>timestamp without time zone</c> columns.
/// </summary>
public interface IBusinessClock
{
    DateTime Now { get; }

    /// <summary>
    /// Parses a device timestamp (no offset) as business-local wall time.
    /// </summary>
    bool TryParseDeviceTimestamp(string? input, out DateTime localWall);

    /// <summary>Converts a UTC instant to business-local wall time (Unspecified kind).</summary>
    DateTime ToBusinessLocal(DateTime utcInstant);
}
