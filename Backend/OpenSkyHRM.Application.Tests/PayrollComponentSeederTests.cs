using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class PayrollComponentSeederTests
{
    private sealed class FakeSettings : ISystemSettingService
    {
        public Task<string?> GetAsync(string key) => Task.FromResult<string?>(null);
        public Task<Dictionary<string, string>> GetAllAsync() => Task.FromResult(new Dictionary<string, string>());
        public Task SetAsync(string key, string value) => Task.CompletedTask;
        public Task<string> GenerateNextEmployeeCodeAsync() => Task.FromResult("EMP-000001");
    }

    private sealed class TestClock : IBusinessClock
    {
        public DateTime Now => DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

        public bool TryParseDeviceTimestamp(string? input, out DateTime localWall)
        {
            localWall = default;
            return false;
        }

        public DateTime ToBusinessLocal(DateTime utcInstant) =>
            DateTime.SpecifyKind(utcInstant, DateTimeKind.Unspecified);
    }

    private static (AppDbContext Db, PayrollService Svc) CreateSut()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new TestClock());
        return (db, new PayrollService(db, new FakeSettings()));
    }

    [Fact]
    public async Task EnsureAsync_SeedsDefaultCatalog()
    {
        var (db, _) = CreateSut();

        await PayrollComponentSeeder.EnsureAsync(db);

        var codes = await db.CompensationComponents.Select(c => c.Code).ToListAsync();
        Assert.Contains("BASIC", codes);
        Assert.Contains("POYA", codes);
        Assert.Contains("OT", codes);
        Assert.Contains("EPF_EE", codes);
        Assert.Contains("APIT", codes);

        var taxMode = await db.SystemSettings.FindAsync("Payroll_APIT_TaxMode");
        Assert.NotNull(taxMode);
        Assert.Equal("Exact", taxMode.Value);
    }

    [Fact]
    public async Task GetComponentsAsync_RestoresSoftDeletedCatalog()
    {
        var (db, svc) = CreateSut();
        await PayrollComponentSeeder.EnsureAsync(db);

        foreach (var component in db.CompensationComponents)
            component.IsDeleted = true;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        Assert.Empty(await db.CompensationComponents.ToListAsync());

        var list = await svc.GetComponentsAsync();

        Assert.Contains(list, c => c.Code == "BASIC");
        Assert.Contains(list, c => c.Code == "POYA");
        Assert.True(list.Count >= 15);
    }

    [Fact]
    public async Task GetComponentsAsync_PreservesUserDisabledEpfEtf()
    {
        var (db, svc) = CreateSut();
        await PayrollComponentSeeder.EnsureAsync(db);

        var ta = await db.CompensationComponents.SingleAsync(c => c.Code == "TA");
        var updated = await svc.UpdateComponentAsync(ta.Id, new OpenSkyHRM.Application.DTOs.Payroll.UpdateComponentDto
        {
            Name = ta.Name,
            Code = ta.Code,
            Type = ta.Type.ToString(),
            Category = ta.Category.ToString(),
            IsTaxable = ta.IsTaxable,
            IsEpfApplicable = false,
            IsEtfApplicable = false,
            IsStatutory = ta.IsStatutory,
            Description = ta.Description,
            FormulaExpression = ta.FormulaExpression,
            DependsOnComponentCode = ta.DependsOnComponentCode,
            SortOrder = ta.SortOrder,
            IsEmployerContribution = ta.IsEmployerContribution,
            IsActive = ta.IsActive,
        });

        Assert.NotNull(updated);
        Assert.False(updated.IsEpfApplicable);
        Assert.False(updated.IsEtfApplicable);

        db.ChangeTracker.Clear();
        var list = await svc.GetComponentsAsync();
        var reloaded = Assert.Single(list, c => c.Code == "TA");
        Assert.False(reloaded.IsEpfApplicable);
        Assert.False(reloaded.IsEtfApplicable);
    }
}
