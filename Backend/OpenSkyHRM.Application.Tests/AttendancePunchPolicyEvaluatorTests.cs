using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class AttendancePunchPolicyEvaluatorTests
{
    private sealed class FakeSettings(string mode) : ISystemSettingService
    {
        public Task<string?> GetAsync(string key) =>
            Task.FromResult<string?>(key == AttendanceCheckInModes.SettingKey ? mode : null);

        public Task<Dictionary<string, string>> GetAllAsync() =>
            Task.FromResult(new Dictionary<string, string> { [AttendanceCheckInModes.SettingKey] = mode });

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

    private static async Task<(AppDbContext Db, Employee Employee, AttendancePlace BuPlace, Location Location)> SeedAsync()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new TestClock());

        var location = new Location { Id = Guid.NewGuid(), Name = "HQ", Code = "HQ", IsActive = true };
        var businessUnit = new BusinessUnit { Id = Guid.NewGuid(), Name = "Retail", Code = "RTL", IsActive = true };
        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = "Ops",
            Code = "OPS",
            BusinessUnitId = businessUnit.Id,
        };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = "User",
            EmployeeCode = "EMP-000001",
            DepartmentId = department.Id,
            LocationId = location.Id,
            BusinessUnitId = businessUnit.Id,
            JoinDate = DateTime.UtcNow.Date,
        };
        var buPlace = new AttendancePlace
        {
            Id = Guid.NewGuid(),
            Name = "Retail",
            Code = "BU-RTL",
            Kind = AttendancePlaceKind.BusinessUnit,
            BusinessUnitId = businessUnit.Id,
            GeofenceEnabled = true,
            GeofenceRadiusMeters = 100,
            Latitude = 6.9271m,
            Longitude = 79.8612m,
            IsActive = true,
        };

        db.AddRange(location, businessUnit, department, employee, buPlace);
        await db.SaveChangesAsync();
        return (db, employee, buPlace, location);
    }

    [Fact]
    public async Task BusinessUnitQr_RequiresQrPayload()
    {
        var (db, employee, _, _) = await SeedAsync();
        var dto = new PunchRequestDto
        {
            BusinessUnitId = employee.BusinessUnitId,
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AttendancePunchPolicyEvaluator.EvaluateAsync(
                db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto));

        Assert.Contains("QR code is required", ex.Message);
    }

    [Fact]
    public async Task BusinessUnitQr_AcceptsLocationQrWithoutBusinessUnit()
    {
        var (db, employee, _, location) = await SeedAsync();
        var dto = new PunchRequestDto
        {
            QrPayload = "{\"type\":\"opensky-hrm-attendance-location\"}",
            LocationId = location.Id,
        };

        var policy = await AttendancePunchPolicyEvaluator.EvaluateAsync(
            db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto);

        Assert.Null(policy.ResolvedPlace);
    }

    [Fact]
    public async Task BusinessUnitQr_StillRequiresBusinessUnitForBuQrWhenEmployeeHasNone()
    {
        var (db, employee, _, _) = await SeedAsync();
        employee.BusinessUnitId = null;
        await db.SaveChangesAsync();

        var dto = new PunchRequestDto
        {
            QrPayload = "{\"type\":\"opensky-hrm-attendance-bu\"}",
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AttendancePunchPolicyEvaluator.EvaluateAsync(
                db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto));

        Assert.Contains("Business unit is required", ex.Message);
    }

    [Fact]
    public async Task Hybrid_RequiresGpsInsideBusinessUnitPlace()
    {
        var (db, employee, _, _) = await SeedAsync();
        var dto = new PunchRequestDto
        {
            QrPayload = "opensky-test",
            BusinessUnitId = employee.BusinessUnitId,
            Latitude = 7.5m,
            Longitude = 80.5m,
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AttendancePunchPolicyEvaluator.EvaluateAsync(
                db, new FakeSettings(AttendanceCheckInModes.Hybrid), employee.Id, dto));

        Assert.Contains("within", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BusinessUnitQr_RejectsBusinessUnitMismatch()
    {
        var (db, employee, _, _) = await SeedAsync();
        var otherBuId = Guid.NewGuid();
        var dto = new PunchRequestDto
        {
            QrPayload = "{\"type\":\"opensky-hrm-attendance-bu\"}",
            BusinessUnitId = otherBuId,
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AttendancePunchPolicyEvaluator.EvaluateAsync(
                db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto));

        Assert.Contains("different business unit", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BusinessUnitQr_RejectsLocationMismatch()
    {
        var (db, employee, _, _) = await SeedAsync();
        var otherLocationId = Guid.NewGuid();
        var dto = new PunchRequestDto
        {
            QrPayload = "{\"type\":\"opensky-hrm-attendance-location\"}",
            LocationId = otherLocationId,
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AttendancePunchPolicyEvaluator.EvaluateAsync(
                db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto));

        Assert.Contains("different location", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BusinessUnitQr_AcceptsMatchingBusinessUnitQr()
    {
        var (db, employee, _, _) = await SeedAsync();
        var dto = new PunchRequestDto
        {
            QrPayload = "{\"type\":\"opensky-hrm-attendance-bu\"}",
            BusinessUnitId = employee.BusinessUnitId,
        };

        var policy = await AttendancePunchPolicyEvaluator.EvaluateAsync(
            db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto);

        Assert.Null(policy.ResolvedPlace);
    }

    [Fact]
    public void ValidateEmployeeMatchesScannedQr_RejectsWrongBusinessUnit()
    {
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            BusinessUnitId = Guid.NewGuid(),
            LocationId = Guid.NewGuid(),
        };
        var dto = new PunchRequestDto
        {
            QrPayload = "{\"type\":\"opensky-hrm-attendance-bu\"}",
            BusinessUnitId = Guid.NewGuid(),
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            AttendancePunchPolicyEvaluator.ValidateEmployeeMatchesScannedQr(employee, dto));

        Assert.Contains("different business unit", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task OpenMode_SkipsPolicyChecks()
    {
        var (db, employee, _, _) = await SeedAsync();
        var dto = new PunchRequestDto();

        var policy = await AttendancePunchPolicyEvaluator.EvaluateAsync(
            db, new FakeSettings(AttendanceCheckInModes.Open), employee.Id, dto);

        Assert.Null(policy.ResolvedPlace);
    }

    [Fact]
    public async Task WebSource_SkipsQrAndGeofencePolicy()
    {
        var (db, employee, _, _) = await SeedAsync();
        var dto = new PunchRequestDto { Type = "in", Source = "Web" };

        var policy = await AttendancePunchPolicyEvaluator.EvaluateAsync(
            db, new FakeSettings(AttendanceCheckInModes.BusinessUnitQr), employee.Id, dto);

        Assert.Null(policy.ResolvedPlace);
    }
}
