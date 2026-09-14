using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class LicensingServiceTests
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

    private static async Task<(AppDbContext Db, LicensingService Svc)> CreateSutAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options, new TestClock());
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

    [Fact]
    public async Task GetLicensedModulesForRoleAssignmentAsync_Includes_Sidebar_Menu_Rows()
    {
        var (_, svc) = await CreateSutAsync();
        var modules = await svc.GetLicensedModulesForRoleAssignmentAsync();
        var codes = modules.Select(m => m.Module).ToList();
        var labels = modules.Select(m => m.Label).ToList();

        Assert.Contains("EmployeeBio", codes);
        Assert.Contains("EmployeeActions", codes);
        Assert.Contains("Approvals", codes);
        Assert.Contains("Reports", codes);
        Assert.Contains("CompanyProfile", codes);
        Assert.Contains("EmailTemplates", codes);
        Assert.Contains("EmailDeliveryLog", codes);
        Assert.Contains("UserManagement", codes);
        Assert.Contains("Help", codes);
        Assert.Contains("Employee bio", labels);
        Assert.Contains("User Management", labels);
        Assert.Contains("Data Import / Export", labels);
        Assert.DoesNotContain(modules, m => m.Label == "Administration");
        Assert.Equal("Dashboard", codes[0]);
        Assert.Equal("Help", codes[^1]);
    }

    [Fact]
    public async Task GetLicensedModulesForRoleAssignmentAsync_Hides_Rows_When_Parent_Unlicensed()
    {
        var (_, svc) = await CreateSutAsync();
        await svc.UpdateEntitlementsAsync(new UpdateModuleEntitlementsDto
        {
            EnabledOptionalModuleCodes = new List<string>()
        });
        svc.InvalidateCache();

        var codes = (await svc.GetLicensedModulesForRoleAssignmentAsync()).Select(m => m.Module).ToList();
        Assert.Contains("Dashboard", codes);
        Assert.Contains("People", codes);
        Assert.Contains("EmployeeBio", codes);
        Assert.Contains("Settings", codes);
        Assert.Contains("CompanyProfile", codes);
        Assert.Contains("EmailTemplates", codes);
        Assert.Contains("Help", codes);
        Assert.DoesNotContain("Payroll", codes);
        Assert.DoesNotContain("Approvals", codes);
        Assert.DoesNotContain("UserManagement", codes);
        Assert.DoesNotContain("Reports", codes);
    }
}
