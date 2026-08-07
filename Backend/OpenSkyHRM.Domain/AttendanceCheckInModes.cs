namespace OpenSkyHRM.Domain;

/// <summary>Company-wide attendance check-in policy (SystemSettings key AttendanceCheckInMode).</summary>
public static class AttendanceCheckInModes
{
    public const string SettingKey = "AttendanceCheckInMode";

    public const string Open = "Open";
    public const string LocationGeofence = "LocationGeofence";
    public const string BusinessUnitQr = "BusinessUnitQr";
    public const string BusinessUnitGeofence = "BusinessUnitGeofence";
    public const string Hybrid = "Hybrid";

    public static bool IsValid(string? mode) =>
        mode is Open or LocationGeofence or BusinessUnitQr or BusinessUnitGeofence or Hybrid;

    public static string Normalize(string? mode) =>
        IsValid(mode) ? mode! : BusinessUnitQr;
}
