using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class LicensingServiceTests
{
    private static async Task<(AppDbContext Db, LicensingService Svc)> CreateSutAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        await LicensingSeeder.EnsureAsync(db);
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = new LicensingService(db, cache, NullLogger<LicensingService>.Instance);
        return (db, svc);
    }

    [Fact]
    public async Task UpdateEntitlementsAsync_Rejects_Enabling_Required_Module_Via_Optional_List()
    {
        var (_, svc) = await CreateSutAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.UpdateEntitlementsAsync(new UpdateModuleEntitlementsDto
            {
                EnabledOptionalModuleCodes = new List<string> { "People" }
            }));
    }

    [Fact]
    public async Task GetEffectiveModuleCodesAsync_When_Suspended_Returns_Only_Required()
    {
        var (db, svc) = await CreateSutAsync();
        var sub = await db.InstanceSubscriptions.FirstAsync(s => s.InstanceKey == InstanceSubscription.DefaultInstanceKey);
        sub.Status = SubscriptionStatus.Suspended;
        await db.SaveChangesAsync();
        svc.InvalidateCache();

        var codes = await svc.GetEffectiveModuleCodesAsync();
        Assert.Contains("Dashboard", codes);
        Assert.Contains("People", codes);
        Assert.Contains("Settings", codes);
        Assert.Contains("Billing", codes);
        Assert.DoesNotContain("Payroll", codes);
    }

    [Fact]
    public async Task UpdateEntitlementsAsync_Turns_Off_Optional_Module()
    {
        var (db, svc) = await CreateSutAsync();
        var payrollId = await db.LicensedModules.Where(m => m.Code == "Payroll").Select(m => m.Id).FirstAsync();

        await svc.UpdateEntitlementsAsync(new UpdateModuleEntitlementsDto
        {
            EnabledOptionalModuleCodes = new List<string>() // all optional off
        });
        svc.InvalidateCache();

        var ent = await db.InstanceModuleEntitlements.FirstAsync(e => e.LicensedModuleId == payrollId);
        Assert.False(ent.IsEnabled);

        var codes = await svc.GetEffectiveModuleCodesAsync();
        Assert.DoesNotContain("Payroll", codes);
    }
}
