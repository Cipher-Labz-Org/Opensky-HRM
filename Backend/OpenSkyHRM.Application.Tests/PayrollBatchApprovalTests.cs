using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class PayrollBatchApprovalTests
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

    private static (AppDbContext Db, PayrollService Svc, PayrollCalculationEngine Engine) CreateSut()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new TestClock());
        var settings = new FakeSettings();
        return (db, new PayrollService(db, settings), new PayrollCalculationEngine(db, settings));
    }

    private static PayrollBatch SeedBatch(AppDbContext db, BatchStatus status)
    {
        var employeeId = Guid.NewGuid();
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-001",
            Month = 9,
            Year = 2026,
            EffectiveFrom = new DateTime(2026, 9, 1),
            EffectiveTo = new DateTime(2026, 9, 30),
            ProcessType = PayrollProcessType.Salary,
            Status = status,
            EmployeeCount = 1,
        };
        db.PayrollBatches.Add(batch);
        db.PayStatements.Add(new PayStatement
        {
            Id = Guid.NewGuid(),
            BatchId = batch.Id,
            EmployeeId = employeeId,
            Month = 9,
            Year = 2026,
            Status = PayStatementStatus.Draft,
        });
        db.SaveChanges();
        return batch;
    }

    [Fact]
    public async Task ReviewBatchAsync_OnlyFromCalculated()
    {
        var (db, svc, _) = CreateSut();
        var batch = SeedBatch(db, BatchStatus.Draft);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.ReviewBatchAsync(batch.Id, "reviewer"));
        Assert.Contains("Calculated", ex.Message);

        batch.Status = BatchStatus.Calculated;
        await db.SaveChangesAsync();

        var result = await svc.ReviewBatchAsync(batch.Id, "reviewer");
        Assert.NotNull(result);
        Assert.Equal(nameof(BatchStatus.Reviewed), result.Status);
        Assert.Equal("reviewer", result.ReviewedBy);
        Assert.NotNull(result.ReviewedAt);
    }

    [Fact]
    public async Task ApproveBatchAsync_FromCalculatedOrReviewed()
    {
        var (db, svc, _) = CreateSut();
        var calculated = SeedBatch(db, BatchStatus.Calculated);

        var fromCalculated = await svc.ApproveBatchAsync(calculated.Id, "hr.manager");
        Assert.NotNull(fromCalculated);
        Assert.Equal(nameof(BatchStatus.Finalized), fromCalculated.Status);
        Assert.Equal("hr.manager", fromCalculated.ApprovedBy);
        Assert.Equal("hr.manager", fromCalculated.ReviewedBy);
        Assert.NotNull(fromCalculated.ApprovedAt);

        var reviewed = SeedBatch(db, BatchStatus.Calculated);
        await svc.ReviewBatchAsync(reviewed.Id, "reviewer");
        var fromReviewed = await svc.ApproveBatchAsync(reviewed.Id, "hr.manager");
        Assert.NotNull(fromReviewed);
        Assert.Equal(nameof(BatchStatus.Finalized), fromReviewed.Status);
        Assert.Equal("hr.manager", fromReviewed.ApprovedBy);
        Assert.Equal("reviewer", fromReviewed.ReviewedBy);
    }

    [Fact]
    public async Task ReturnBatchToCalculatedAsync_AllowsRecalculate()
    {
        var (db, svc, engine) = CreateSut();
        var batch = SeedBatch(db, BatchStatus.Reviewed);
        batch.ReviewedBy = "reviewer";
        batch.ReviewedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var beforeReturn = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            engine.CalculateBatchAsync(batch.Id));
        Assert.Contains("cannot be recalculated", beforeReturn.Message);

        var returned = await svc.ReturnBatchToCalculatedAsync(batch.Id);
        Assert.NotNull(returned);
        Assert.Equal(nameof(BatchStatus.Calculated), returned.Status);
        Assert.Null(returned.ReviewedBy);
        Assert.Null(returned.ReviewedAt);

        var afterReturn = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            engine.CalculateBatchAsync(batch.Id));
        Assert.DoesNotContain("cannot be recalculated", afterReturn.Message);
        Assert.Contains("No employees selected", afterReturn.Message);
    }

    [Fact]
    public async Task FinalizeBatchAsync_OnlyFromApproved_LocksStatements()
    {
        var (db, svc, _) = CreateSut();
        var batch = SeedBatch(db, BatchStatus.Approved);

        var result = await svc.FinalizeBatchAsync(batch.Id);

        Assert.NotNull(result);
        Assert.Equal(nameof(BatchStatus.Finalized), result.Status);
        var statement = await db.PayStatements.SingleAsync(s => s.BatchId == batch.Id);
        Assert.Equal(PayStatementStatus.Finalized, statement.Status);
    }

    [Fact]
    public async Task ApproveBatchAsync_LocksPayStatementsAsFinalized()
    {
        var (db, svc, _) = CreateSut();
        var batch = SeedBatch(db, BatchStatus.Calculated);

        var result = await svc.ApproveBatchAsync(batch.Id, "hr.manager");
        Assert.Equal(nameof(BatchStatus.Finalized), result!.Status);
        var statement = await db.PayStatements.SingleAsync(s => s.BatchId == batch.Id);
        Assert.Equal(PayStatementStatus.Finalized, statement.Status);
    }

    [Fact]
    public async Task GetStatementsByBatchAsync_ReturnsDraftSalaryLines()
    {
        var (db, svc, _) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "HR", Code = "HR" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP001",
            FirstName = "Ada",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-003",
            Month = 9,
            Year = 2026,
            EffectiveFrom = new DateTime(2026, 9, 1),
            EffectiveTo = new DateTime(2026, 9, 30),
            ProcessType = PayrollProcessType.Salary,
            Status = BatchStatus.Calculated,
        };
        var statement = new PayStatement
        {
            BatchId = batch.Id,
            EmployeeId = employee.Id,
            Month = 9,
            Year = 2026,
            BasicPay = 100_000m,
            TotalEarnings = 100_000m,
            GrossPay = 100_000m,
            NetPay = 92_000m,
            Status = PayStatementStatus.Draft,
            Lines =
            {
                new PayStatementLine
                {
                    ComponentId = Guid.NewGuid(),
                    ComponentName = "Basic Salary",
                    ComponentCode = "BASIC",
                    Type = "Earning",
                    Amount = 100_000m,
                    SortOrder = 10,
                },
            },
        };
        db.Departments.Add(dept);
        db.Employees.Add(employee);
        db.PayrollBatches.Add(batch);
        db.PayStatements.Add(statement);
        await db.SaveChangesAsync();

        var result = await svc.GetStatementsByBatchAsync(batch.Id);
        Assert.Single(result);
        Assert.Equal("Ada Perera", result[0].EmployeeName);
        Assert.Contains(result[0].Lines, l => l.ComponentCode == "BASIC" && l.Amount == 100_000m);
    }

    [Fact]
    public async Task CalculateBatchAsync_LoadsEmployeeSalaryOntoPayslip()
    {
        var (db, svc, engine) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "HR", Code = "HR" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP001",
            FirstName = "Ada",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-003",
            Month = 9,
            Year = 2026,
            EffectiveFrom = new DateTime(2026, 9, 1),
            EffectiveTo = new DateTime(2026, 9, 30),
            ProcessType = PayrollProcessType.Salary,
            Status = BatchStatus.Draft,
            SelectedEmployeeIds = System.Text.Json.JsonSerializer.Serialize(new List<Guid> { employee.Id }),
        };
        db.Departments.Add(dept);
        db.Employees.Add(employee);
        db.PayrollBatches.Add(batch);
        await db.SaveChangesAsync();

        await OpenSkyHRM.Persistence.Seeders.PayrollComponentSeeder.EnsureAsync(db);
        var basic = await db.CompensationComponents.SingleAsync(c => c.Code == "BASIC");
        db.EmployeeCompensations.Add(new EmployeeCompensation
        {
            EmployeeId = employee.Id,
            ComponentId = basic.Id,
            Amount = 100_000m,
            EffectiveFrom = new DateTime(2020, 1, 1),
            IsActive = true,
        });
        await db.SaveChangesAsync();

        await engine.CalculateBatchAsync(batch.Id);

        var slips = await svc.GetStatementsByBatchAsync(batch.Id);
        Assert.Single(slips);
        Assert.Equal(100_000m, slips[0].BasicPay);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "BASIC" && l.Amount == 100_000m);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "EPF_EE" && l.Amount == 8_000m);
    }

    [Fact]
    public async Task CalculateBatchAsync_WithoutSalary_Throws()
    {
        var (db, _, engine) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "HR", Code = "HR" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP001",
            FirstName = "Ada",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-003",
            Month = 9,
            Year = 2026,
            EffectiveFrom = new DateTime(2026, 9, 1),
            EffectiveTo = new DateTime(2026, 9, 30),
            ProcessType = PayrollProcessType.Salary,
            Status = BatchStatus.Draft,
            SelectedEmployeeIds = System.Text.Json.JsonSerializer.Serialize(new List<Guid> { employee.Id }),
        };
        db.Departments.Add(dept);
        db.Employees.Add(employee);
        db.PayrollBatches.Add(batch);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => engine.CalculateBatchAsync(batch.Id));
        Assert.Contains("EMP001", ex.Message);
    }
}
