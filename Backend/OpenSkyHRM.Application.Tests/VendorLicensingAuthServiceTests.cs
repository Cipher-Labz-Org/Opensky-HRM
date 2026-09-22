using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Options;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Persistence;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class VendorLicensingAuthServiceTests
{
    private sealed class TestClock : IBusinessClock
    {
        public DateTime Now => DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

        public bool TryParseDeviceTimestamp(string? input, out DateTime localWall)
        {
            localWall = default;
            if (string.IsNullOrWhiteSpace(input) || !DateTime.TryParse(input, out var parsed))
                return false;
            localWall = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
            return true;
        }

        public DateTime ToBusinessLocal(DateTime utcInstant) =>
            DateTime.SpecifyKind(utcInstant, DateTimeKind.Unspecified);
    }

    private static VendorLicensingAuthService CreateSut()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options, new TestClock());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "OpenSkyHRM-Test-Key-256bit-ChangeMe!!",
                ["Jwt:Issuer"] = "OpenSkyHRM",
                ["Jwt:Audience"] = "OpenSkyHRM",
            })
            .Build();
        return new VendorLicensingAuthService(
            Microsoft.Extensions.Options.Options.Create(new VendorLicensingOptions
            {
                Username = "Superadmin@gmail.com",
                Password = "HRADMIN123@",
                TokenExpiresInMinutes = 60,
                MaxFailedAttempts = 8,
                LockoutMinutes = 10,
            }),
            config,
            new MemoryCache(new MemoryCacheOptions()),
            db);
    }

    [Fact]
    public async Task LoginAsync_Accepts_Configured_Credentials()
    {
        var svc = CreateSut();
        var result = await svc.LoginAsync(new VendorLicensingLoginDto
        {
            Username = "Superadmin@gmail.com",
            Password = "HRADMIN123@",
        }, "test");

        Assert.False(string.IsNullOrWhiteSpace(result.Token));
        Assert.True(result.ExpiresAt > DateTime.UtcNow);
    }

    [Fact]
    public async Task LoginAsync_Rejects_Wrong_Password()
    {
        var svc = CreateSut();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.LoginAsync(new VendorLicensingLoginDto
            {
                Username = "Superadmin@gmail.com",
                Password = "wrong",
            }, "test"));
    }
}
