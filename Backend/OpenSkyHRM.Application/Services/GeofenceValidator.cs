namespace OpenSkyHRM.Application.Services;

public static class GeofenceValidator
{
    public static void ValidateGeoFields(bool geofenceEnabled, int geofenceRadiusMeters, decimal? latitude, decimal? longitude)
    {
        var radius = geofenceRadiusMeters <= 0 ? 20 : geofenceRadiusMeters;
        if (radius is < 1 or > 1000)
            throw new InvalidOperationException("Geofence radius must be between 1 and 1000 meters.");

        if (geofenceEnabled)
        {
            if (!latitude.HasValue || !longitude.HasValue)
                throw new InvalidOperationException("Latitude and longitude are required when geofence is enabled.");
        }

        if (latitude.HasValue && latitude is < -90 or > 90)
            throw new InvalidOperationException("Latitude must be between -90 and 90.");
        if (longitude.HasValue && longitude is < -180 or > 180)
            throw new InvalidOperationException("Longitude must be between -180 and 180.");
    }

    public static int NormalizeRadius(int geofenceRadiusMeters) =>
        geofenceRadiusMeters <= 0 ? 20 : geofenceRadiusMeters;

    public static bool IsWithinRadius(
        decimal punchLat,
        decimal punchLng,
        decimal centerLat,
        decimal centerLng,
        int radiusMeters)
    {
        var distance = HaversineMeters(
            (double)punchLat, (double)punchLng,
            (double)centerLat, (double)centerLng);
        return distance <= radiusMeters;
    }

    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusM = 6371000;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2))
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusM * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;
}
