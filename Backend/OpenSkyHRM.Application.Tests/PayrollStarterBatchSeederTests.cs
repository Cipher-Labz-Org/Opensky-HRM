using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class PayrollStarterBatchSeederTests
{
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

    [Fact]
    public async Task EnsureStarterBatchAsync_CreatesDraftBatchWhenNoneExist()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new TestClock());

        var dept = new Department { Id = Guid.NewGuid(), Name = "Ops", Code = "OPS" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP-000001",
            FirstName = "Anton",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        db.Departments.Add(dept);
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        await PayrollComponentSeeder.EnsureAsync(db);
        var basic = await db.CompensationComponents.SingleAsync(c => c.Code == "BASIC");
        db.EmployeeCompensations.Add(new EmployeeCompensation
        {
            EmployeeId = employee.Id,
            ComponentId = basic.Id,
            Amount = 30_000m,
            EffectiveFrom = new DateTime(2025, 1, 1),
            IsActive = true,
        });
        await db.SaveChangesAsync();

        await PayrollSeeder.EnsureStarterBatchAsync(db);

        var batch = await db.PayrollBatches.SingleAsync();
        Assert.Equal(BatchStatus.Draft, batch.Status);
        Assert.Equal(PayrollProcessType.Salary, batch.ProcessType);
        Assert.Equal(1, batch.EmployeeCount);
        Assert.Contains(employee.Id.ToString(), batch.SelectedEmployeeIds);
        Assert.True(batch.EffectiveFrom.Day == 1);
    }

    [Fact]
    public async Task EnsureStarterBatchAsync_IsIdempotent()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new TestClock());

        var dept = new Department { Id = Guid.NewGuid(), Name = "Ops", Code = "OPS" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP-000002",
            FirstName = "Ada",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        db.Departments.Add(dept);
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        await PayrollSeeder.EnsureStarterBatchAsync(db);
        await PayrollSeeder.EnsureStarterBatchAsync(db);

        Assert.Equal(1, await db.PayrollBatches.CountAsync());
    }
}
