using OpenSkyHRM.Application.Services;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class GeofenceValidatorTests
{
    [Fact]
    public void IsWithinRadius_ReturnsTrue_WhenPunchIsAtCenter()
    {
        Assert.True(GeofenceValidator.IsWithinRadius(6.9271m, 79.8612m, 6.9271m, 79.8612m, 20));
    }

    [Fact]
    public void IsWithinRadius_ReturnsFalse_WhenPunchIsFarAway()
    {
        Assert.False(GeofenceValidator.IsWithinRadius(7.5m, 80.5m, 6.9271m, 79.8612m, 20));
    }

    [Fact]
    public void ValidateGeoFields_RequiresCoordinates_WhenGeofenceEnabled()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            GeofenceValidator.ValidateGeoFields(true, 20, null, null));
        Assert.Contains("Latitude and longitude", ex.Message);
    }
}
