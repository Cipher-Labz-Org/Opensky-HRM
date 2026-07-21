using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

public static class OrganizationSeeder
{
    private const string PlaceholderWorkEmailDomain = "@employee.noemail.opensky.hrm";
    public static async Task SeedAsync(AppDbContext context)
    {
        if (!await context.Departments.AnyAsync())
            await SeedOrganizationStructureAsync(context);

        await EnsureSampleEmployeesIfEmptyAsync(context);
    }

    /// <summary>
    /// Clears auto-generated placeholder work emails so optional email stays empty when none was provided.
    /// </summary>
    public static async Task RepairNullEmployeeEmailsAsync(AppDbContext context)
    {
        var placeholders = await context.Employees
            .Where(e => e.Email != null && EF.Functions.ILike(e.Email, $"%{PlaceholderWorkEmailDomain}%"))
            .ToListAsync();

        if (placeholders.Count == 0)
            return;

        foreach (var employee in placeholders)
            employee.Email = null;

        await context.SaveChangesAsync();
    }

    private static async Task SeedOrganizationStructureAsync(AppDbContext context)
    {
        // Business Units
        var buRetail = new BusinessUnit { Name = "Retail Operations", Code = "BU-RET", Description = "Retail and store operations" };
        var buManuf = new BusinessUnit { Name = "Manufacturing", Code = "BU-MFG", Description = "Manufacturing and production" };
        var buHQ = new BusinessUnit { Name = "Head Office", Code = "BU-HQ", Description = "Corporate headquarters" };
        var buLogistics = new BusinessUnit { Name = "Logistics", Code = "BU-LOG", Description = "Supply chain and logistics" };

        context.BusinessUnits.AddRange(buRetail, buManuf, buHQ, buLogistics);
        await context.SaveChangesAsync();

        // Locations
        var locHQ = new Location { Name = "Head Office - Colombo", Code = "LOC-CMB", City = "Colombo", Country = "Sri Lanka", Address = "42 Galle Road, Colombo 03" };
        var locFactory = new Location { Name = "Factory - Biyagama", Code = "LOC-BIY", City = "Biyagama", Country = "Sri Lanka", Address = "12 Export Processing Zone" };
        var locWarehouse = new Location { Name = "Warehouse - Kelaniya", Code = "LOC-KEL", City = "Kelaniya", Country = "Sri Lanka", Address = "88 Kandy Road" };

        context.Locations.AddRange(locHQ, locFactory, locWarehouse);

        // Grades
        var grades = new[]
        {
            new Grade { Name = "Executive", Code = "G1", Level = 1, Description = "C-Suite and Directors" },
            new Grade { Name = "Senior Manager", Code = "G2", Level = 2, Description = "Senior management level" },
            new Grade { Name = "Manager", Code = "G3", Level = 3, Description = "Mid-management level" },
            new Grade { Name = "Senior Officer", Code = "G4", Level = 4, Description = "Senior individual contributor" },
            new Grade { Name = "Officer", Code = "G5", Level = 5, Description = "Standard individual contributor" },
            new Grade { Name = "Associate", Code = "G6", Level = 6, Description = "Entry level" },
        };
        context.Grades.AddRange(grades);

        // Departments
        var deptHR = new Department { Name = "Human Resources", Code = "DEPT-HR" };
        var deptFinance = new Department { Name = "Finance", Code = "DEPT-FIN" };
        var deptIT = new Department { Name = "Information Technology", Code = "DEPT-IT" };
        var deptOps = new Department { Name = "Operations", Code = "DEPT-OPS" };
        var deptSales = new Department { Name = "Sales & Marketing", Code = "DEPT-SAL" };
        var deptLegal = new Department { Name = "Legal & Compliance", Code = "DEPT-LEG" };

        foreach (var d in new[] { deptHR, deptFinance, deptIT, deptOps, deptSales, deptLegal })
            d.BusinessUnitId = buHQ.Id;

        context.Departments.AddRange(deptHR, deptFinance, deptIT, deptOps, deptSales, deptLegal);

        // Job Titles
        var jtCEO = new JobTitle { Title = "Chief Executive Officer", Code = "JT-CEO" };
        var jtCFO = new JobTitle { Title = "Chief Financial Officer", Code = "JT-CFO" };
        var jtHRD = new JobTitle { Title = "HR Director", Code = "JT-HRD" };
        var jtAcct = new JobTitle { Title = "Senior Accountant", Code = "JT-ACCT" };
        var jtDev = new JobTitle { Title = "Software Engineer", Code = "JT-DEV" };
        var jtOps = new JobTitle { Title = "Operations Manager", Code = "JT-OPS" };

        context.JobTitles.AddRange(jtCEO, jtCFO, jtHRD, jtAcct, jtDev, jtOps);

        await context.SaveChangesAsync();

        // Positions
        var posCEO = new Position { Title = "CEO", Code = "POS-001", DepartmentId = deptOps.Id, LocationId = locHQ.Id, JobTitleId = jtCEO.Id, IsVacant = false };
        var posHRD = new Position { Title = "HR Director", Code = "POS-002", DepartmentId = deptHR.Id, LocationId = locHQ.Id, JobTitleId = jtHRD.Id, IsVacant = false };
        var posSrAcct = new Position { Title = "Senior Accountant", Code = "POS-003", DepartmentId = deptFinance.Id, LocationId = locHQ.Id, JobTitleId = jtAcct.Id, IsVacant = false };

        context.Positions.AddRange(posCEO, posHRD, posSrAcct);
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Ensures demo employees exist even when org structure was created separately (departments already present).
    /// Safe to run on every startup (idempotent).
    /// </summary>
    public static async Task EnsureSampleEmployeesIfEmptyAsync(AppDbContext context)
    {
        if (await context.Employees.AnyAsync())
            return;

        var deptOps = await context.Departments.FirstOrDefaultAsync(d => d.Code == "DEPT-OPS")
            ?? await context.Departments.OrderBy(d => d.Name).FirstOrDefaultAsync();
        var deptHr = await context.Departments.FirstOrDefaultAsync(d => d.Code == "DEPT-HR")
            ?? deptOps;
        var deptFin = await context.Departments.FirstOrDefaultAsync(d => d.Code == "DEPT-FIN")
            ?? deptOps;

        if (deptOps == null)
            return;

        var loc = await context.Locations.OrderBy(l => l.Name).FirstOrDefaultAsync();
        var bu = await context.BusinessUnits.OrderBy(b => b.Name).FirstOrDefaultAsync();

        var grades = await context.Grades.OrderBy(g => g.Level).ToListAsync();
        var gradeExec = grades.FirstOrDefault();
        var gradeMgr = grades.Skip(1).FirstOrDefault() ?? gradeExec;
        var gradeOff = grades.Skip(3).FirstOrDefault() ?? gradeMgr;

        var jtCeo = await context.JobTitles.FirstOrDefaultAsync(j => j.Code == "JT-CEO")
            ?? await context.JobTitles.OrderBy(j => j.Title).FirstOrDefaultAsync();
        var jtHrd = await context.JobTitles.FirstOrDefaultAsync(j => j.Code == "JT-HRD")
            ?? await context.JobTitles.OrderBy(j => j.Title).Skip(1).FirstOrDefaultAsync()
            ?? jtCeo;
        var jtAcct = await context.JobTitles.FirstOrDefaultAsync(j => j.Code == "JT-ACCT")
            ?? await context.JobTitles.OrderBy(j => j.Title).Skip(2).FirstOrDefaultAsync()
            ?? jtCeo;

        if (jtCeo == null)
            return;

        var posCeo = await context.Positions.FirstOrDefaultAsync(p => p.Code == "POS-001");
        var posHrd = await context.Positions.FirstOrDefaultAsync(p => p.Code == "POS-002");
        var posAcct = await context.Positions.FirstOrDefaultAsync(p => p.Code == "POS-003");

        var empCEO = new Employee
        {
            EmployeeCode = "EMP-0001",
            FirstName = "Kamal",
            LastName = "Perera",
            Email = "kamal.perera@openskyhrm.com",
            Phone = "+94771234567",
            DateOfBirth = new DateTime(1975, 3, 15, 0, 0, 0, DateTimeKind.Utc),
            Gender = Gender.Male,
            JoinDate = new DateTime(2015, 1, 10, 0, 0, 0, DateTimeKind.Utc),
            Status = "Active",
            EmploymentType = "FullTimePermanent",
            DepartmentId = deptOps.Id,
            BusinessUnitId = bu?.Id,
            PositionId = posCeo?.Id,
            LocationId = loc?.Id,
            GradeId = gradeExec?.Id,
            JobTitleId = jtCeo.Id,
        };

        var empHRD = new Employee
        {
            EmployeeCode = "EMP-0002",
            FirstName = "Nimal",
            LastName = "Fernando",
            Email = "nimal.fernando@openskyhrm.com",
            Phone = "+94772345678",
            DateOfBirth = new DateTime(1980, 7, 22, 0, 0, 0, DateTimeKind.Utc),
            Gender = Gender.Male,
            JoinDate = new DateTime(2016, 4, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = "Active",
            EmploymentType = "FullTimePermanent",
            DepartmentId = deptHr?.Id ?? deptOps.Id,
            BusinessUnitId = bu?.Id,
            PositionId = posHrd?.Id,
            LocationId = loc?.Id,
            GradeId = gradeMgr?.Id,
            JobTitleId = jtHrd!.Id,
            ManagerId = empCEO.Id,
        };

        var empAcct = new Employee
        {
            EmployeeCode = "EMP-001284",
            FirstName = "Amaya",
            LastName = "Jayawardena",
            Email = "amaya.jayawardena@openskyhrm.com",
            Phone = "+94773456789",
            DateOfBirth = new DateTime(1990, 11, 5, 0, 0, 0, DateTimeKind.Utc),
            Gender = Gender.Female,
            JoinDate = new DateTime(2019, 9, 15, 0, 0, 0, DateTimeKind.Utc),
            Status = "Active",
            EmploymentType = "FullTimePermanent",
            DepartmentId = deptFin?.Id ?? deptOps.Id,
            BusinessUnitId = bu?.Id,
            PositionId = posAcct?.Id,
            LocationId = loc?.Id,
            GradeId = gradeOff?.Id,
            JobTitleId = jtAcct!.Id,
            ManagerId = empCEO.Id,
        };

        context.Employees.Add(empCEO);
        await context.SaveChangesAsync();

        context.Employees.AddRange(empHRD, empAcct);
        await context.SaveChangesAsync();
    }
}
