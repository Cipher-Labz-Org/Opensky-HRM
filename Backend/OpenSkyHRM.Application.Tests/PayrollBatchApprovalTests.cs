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
        Assert.Contains("No employees selected", beforeReturn.Message);

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
    public async Task CalculateBatchAsync_FromReviewed_UsesEmployeeSalaryAndClearsReview()
    {
        var (db, svc, engine) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "ADMIN", Code = "ADMIN" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP-000022",
            FirstName = "Sumali",
            LastName = "Liyana",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-006",
            Month = 9,
            Year = 2026,
            EffectiveFrom = new DateTime(2026, 9, 1),
            EffectiveTo = new DateTime(2026, 9, 30),
            ProcessType = PayrollProcessType.Salary,
            Status = BatchStatus.Reviewed,
            ReviewedBy = "reviewer",
            ReviewedAt = DateTime.UtcNow,
            SelectedEmployeeIds = System.Text.Json.JsonSerializer.Serialize(new List<Guid> { employee.Id }),
        };
        db.Departments.Add(dept);
        db.Employees.Add(employee);
        db.PayrollBatches.Add(batch);
        await db.SaveChangesAsync();

        await OpenSkyHRM.Persistence.Seeders.PayrollComponentSeeder.EnsureAsync(db);
        var basic = await db.CompensationComponents.SingleAsync(c => c.Code == "BASIC");
        var poya = await db.CompensationComponents.SingleAsync(c => c.Code == PayrollPoyaComponent.DefaultCode);
        db.EmployeeCompensations.AddRange(
            new EmployeeCompensation
            {
                EmployeeId = employee.Id,
                ComponentId = basic.Id,
                Amount = 44_500m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            },
            new EmployeeCompensation
            {
                EmployeeId = employee.Id,
                ComponentId = poya.Id,
                Amount = 1_483.33m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            });
        await db.SaveChangesAsync();

        await engine.CalculateBatchAsync(batch.Id);

        var updatedBatch = await db.PayrollBatches.SingleAsync(b => b.Id == batch.Id);
        Assert.Equal(BatchStatus.Calculated, updatedBatch.Status);
        Assert.Null(updatedBatch.ReviewedBy);
        Assert.Null(updatedBatch.ReviewedAt);

        var slips = await svc.GetStatementsByBatchAsync(batch.Id);
        Assert.Single(slips);
        Assert.Equal(45_983.33m, slips[0].GrossPay);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "BASIC" && l.Amount == 44_500m);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "POYA" && l.Amount == 1_483.33m);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "EPF_EE" && l.Amount == 3_678.67m);
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
    public async Task CalculateBatchAsync_IncludesAllFixedEarningsOnPayslip()
    {
        var (db, svc, engine) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "HR", Code = "HR" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP-000022",
            FirstName = "Sumali",
            LastName = "Liyana",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-005",
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
        db.CompensationComponents.Add(new CompensationComponent
        {
            Name = "Other Allowance",
            Code = "FX001",
            Type = ComponentType.Earning,
            Category = ComponentCategory.Fixed,
            SortOrder = 25,
            IsTaxable = true,
            IsEpfApplicable = true,
            IsEtfApplicable = true,
            IsActive = true,
        });
        await db.SaveChangesAsync();
        var fx001 = await db.CompensationComponents.SingleAsync(c => c.Code == "FX001");

        db.EmployeeCompensations.AddRange(
            new EmployeeCompensation
            {
                EmployeeId = employee.Id,
                ComponentId = basic.Id,
                Amount = 44_500m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            },
            new EmployeeCompensation
            {
                EmployeeId = employee.Id,
                ComponentId = fx001.Id,
                Amount = 58_500m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            });
        await db.SaveChangesAsync();

        await engine.CalculateBatchAsync(batch.Id);

        var slips = await svc.GetStatementsByBatchAsync(batch.Id);
        Assert.Single(slips);
        Assert.Equal(103_000m, slips[0].GrossPay);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "BASIC" && l.Amount == 44_500m);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "FX001" && l.Amount == 58_500m);
    }

    [Fact]
    public async Task CalculateBatchAsync_IncludesBatchNullDeductionEvenWhenCategoryVariable()
    {
        var (db, svc, engine) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "HR", Code = "HR" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP003",
            FirstName = "Ada",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-006",
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
        var advance = await db.CompensationComponents.SingleAsync(c => c.Code == "ADVANCE");
        advance.Category = ComponentCategory.Variable;

        db.EmployeeCompensations.AddRange(
            new EmployeeCompensation
            {
                EmployeeId = employee.Id,
                ComponentId = basic.Id,
                Amount = 50_000m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            },
            new EmployeeCompensation
            {
                EmployeeId = employee.Id,
                ComponentId = advance.Id,
                Amount = 5_000m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            });
        await db.SaveChangesAsync();

        await engine.CalculateBatchAsync(batch.Id);

        var slips = await svc.GetStatementsByBatchAsync(batch.Id);
        Assert.Single(slips);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "ADVANCE" && l.Amount == 5_000m);
        Assert.Equal(41_000m, slips[0].NetPay);
    }

    [Fact]
    public async Task CalculateBatchAsync_StillCalculatesEtfWhenOnlyEpfFlagSet()
    {
        var (db, svc, engine) = CreateSut();
        var dept = new Department { Id = Guid.NewGuid(), Name = "HR", Code = "HR" };
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = "EMP002",
            FirstName = "Ada",
            LastName = "Perera",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = dept.Id,
        };
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            BatchCode = "SAL-2026-09-004",
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
        basic.IsEpfApplicable = true;
        basic.IsEtfApplicable = false;
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
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "EPF_EE" && l.Amount == 8_000m);
        Assert.Contains(slips[0].Lines, l => l.ComponentCode == "ETF_ER" && l.Amount == 3_000m);
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
