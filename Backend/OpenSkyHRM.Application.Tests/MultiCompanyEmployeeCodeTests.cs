using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class MultiCompanyEmployeeCodeTests
{
    [Fact]
    public async Task ValidateEmployeeCodeAvailableAsync_UsesMultiCompanyMessageWhenSettingActive()
    {
        await using var db = CreateDb();
        db.SystemSettings.Add(new SystemSetting { Key = MultiCompanyFeature.ActiveSettingKey, Value = "true" });
        db.Employees.Add(new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "E100",
            FirstName = "A",
            LastName = "B",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = Guid.NewGuid(),
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            EmployeeUniqueness.ValidateEmployeeCodeAvailableAsync(db, null, "E100"));

        Assert.Contains("multiple company setup", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("unique ID", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options, new TestClock());
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
}
