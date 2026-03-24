using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/{employeeId:guid}/benefit")]
public class EmployeeBenefitsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmployeeBenefitsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var benefit = await _db.EmployeeBenefits
            .FirstOrDefaultAsync(b => b.EmployeeId == employeeId);

        if (benefit is null)
            return Ok(new BenefitDto
            {
                EmployeeId = employeeId,
                InsuranceProvider = null,
                CoverageExtendedMedical = false,
                CoverageDental = false,
                CoverageVision = false,
                SpousalCoverage = false,
                DependentsCovered = false,
            });

        return Ok(MapToDto(benefit));
    }

    [HttpPut]
    public async Task<IActionResult> Upsert(Guid employeeId, [FromBody] BenefitRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var benefit = await _db.EmployeeBenefits
            .FirstOrDefaultAsync(b => b.EmployeeId == employeeId);

        if (benefit is null)
        {
            benefit = new EmployeeBenefit { EmployeeId = employeeId };
            _db.EmployeeBenefits.Add(benefit);
        }

        benefit.InsuranceProvider = req.InsuranceProvider;
        benefit.CoverageExtendedMedical = req.CoverageExtendedMedical;
        benefit.CoverageDental = req.CoverageDental;
        benefit.CoverageVision = req.CoverageVision;
        benefit.SpousalCoverage = req.SpousalCoverage;
        benefit.DependentsCovered = req.DependentsCovered;

        await _db.SaveChangesAsync();
        return Ok(MapToDto(benefit));
    }

    private static BenefitDto MapToDto(EmployeeBenefit b) => new()
    {
        Id = b.Id,
        EmployeeId = b.EmployeeId,
        InsuranceProvider = b.InsuranceProvider,
        CoverageExtendedMedical = b.CoverageExtendedMedical,
        CoverageDental = b.CoverageDental,
        CoverageVision = b.CoverageVision,
        SpousalCoverage = b.SpousalCoverage,
        DependentsCovered = b.DependentsCovered,
    };
}

public class BenefitDto
{
    public Guid? Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string? InsuranceProvider { get; set; }
    public bool CoverageExtendedMedical { get; set; }
    public bool CoverageDental { get; set; }
    public bool CoverageVision { get; set; }
    public bool SpousalCoverage { get; set; }
    public bool DependentsCovered { get; set; }
}

public class BenefitRequest
{
    public string? InsuranceProvider { get; set; }
    public bool CoverageExtendedMedical { get; set; }
    public bool CoverageDental { get; set; }
    public bool CoverageVision { get; set; }
    public bool SpousalCoverage { get; set; }
    public bool DependentsCovered { get; set; }
}
