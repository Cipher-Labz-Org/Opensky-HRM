using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Services;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class AttendanceQrTokenServiceTests
{
    private static AttendanceQrTokenService CreateService() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "OpenSkyHRM-Test-Key-256bit-ChangeMe!!",
            })
            .Build());

    [Fact]
    public void Validate_AcceptsLocationQrPayload()
    {
        var service = CreateService();
        var locationId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var issued = service.IssueLocationQr(locationId, "Factory", "Factory1");

        var result = service.Validate(issued.Payload);

        Assert.True(result.Valid);
        Assert.Equal("Location", result.Kind);
        Assert.Equal(locationId, result.LocationId);
        Assert.Null(result.BusinessUnitId);
    }

    [Fact]
    public void Validate_AcceptsBusinessUnitQrPayload()
    {
        var service = CreateService();
        var businessUnitId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var issued = service.IssueBusinessUnitQr(businessUnitId, "Retail", "RTL");

        var result = service.Validate(issued.Payload);

        Assert.True(result.Valid);
        Assert.Equal("BusinessUnit", result.Kind);
        Assert.Equal(businessUnitId, result.BusinessUnitId);
        Assert.Null(result.LocationId);
    }

    [Fact]
    public void Validate_DoesNotTreatLocationQrAsBusinessUnit()
    {
        var service = CreateService();
        var locationId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var issued = service.IssueLocationQr(locationId, "Site A", "SITE-A");

        var result = service.Validate(issued.Payload);

        Assert.True(result.Valid);
        Assert.NotEqual("BusinessUnit", result.Kind);
        Assert.DoesNotContain("business unit", result.Message ?? "", StringComparison.OrdinalIgnoreCase);
    }
}
