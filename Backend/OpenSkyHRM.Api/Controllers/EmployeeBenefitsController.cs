using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/{employeeId:guid}")]
public class EmployeeBenefitsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmployeeBenefitsController(AppDbContext db) => _db = db;

    [HttpGet("benefits")]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();

        var items = await _db.EmployeeBenefits
            .Where(b => b.EmployeeId == employeeId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new BenefitDto
            {
                Id = b.Id,
                EmployeeId = b.EmployeeId,
                InsuranceProvider = b.InsuranceProvider,
                CoverageExtendedMedical = b.CoverageExtendedMedical,
                CoverageDental = b.CoverageDental,
                CoverageVision = b.CoverageVision,
                SpousalCoverage = b.SpousalCoverage,
                DependentsCovered = b.DependentsCovered,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("benefits")]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] BenefitRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        try
        {
            ValidateBenefitRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var benefit = new EmployeeBenefit
        {
            EmployeeId = employeeId,
            InsuranceProvider = req.InsuranceProvider!.Trim(),
            CoverageExtendedMedical = req.CoverageExtendedMedical,
            CoverageDental = req.CoverageDental,
            CoverageVision = req.CoverageVision,
            SpousalCoverage = req.SpousalCoverage,
            DependentsCovered = req.DependentsCovered,
        };

        _db.EmployeeBenefits.Add(benefit);
        await _db.SaveChangesAsync();

        return Ok(MapToDto(benefit));
    }

    [HttpPut("benefits/{id:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid id, [FromBody] BenefitRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var benefit = await _db.EmployeeBenefits
            .FirstOrDefaultAsync(b => b.Id == id && b.EmployeeId == employeeId);
        if (benefit is null) return NotFound();

        try
        {
            ValidateBenefitRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        benefit.InsuranceProvider = req.InsuranceProvider!.Trim();
        benefit.CoverageExtendedMedical = req.CoverageExtendedMedical;
        benefit.CoverageDental = req.CoverageDental;
        benefit.CoverageVision = req.CoverageVision;
        benefit.SpousalCoverage = req.SpousalCoverage;
        benefit.DependentsCovered = req.DependentsCovered;
        await _db.SaveChangesAsync();

        return Ok(MapToDto(benefit));
    }

    [HttpDelete("benefits/{id:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var benefit = await _db.EmployeeBenefits
            .FirstOrDefaultAsync(b => b.Id == id && b.EmployeeId == employeeId);
        if (benefit is null) return NotFound();

        benefit.IsDeleted = true;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("benefit")]
    public async Task<IActionResult> GetLegacy(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();

        var benefit = await _db.EmployeeBenefits
            .Where(b => b.EmployeeId == employeeId)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

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

    [HttpPut("benefit")]
    public async Task<IActionResult> UpsertLegacy(Guid employeeId, [FromBody] BenefitRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var benefit = await _db.EmployeeBenefits
            .Where(b => b.EmployeeId == employeeId)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        if (benefit is null)
        {
            benefit = new EmployeeBenefit { EmployeeId = employeeId };
            _db.EmployeeBenefits.Add(benefit);
        }

        try
        {
            ValidateBenefitRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        benefit.InsuranceProvider = req.InsuranceProvider!.Trim();
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

    private static void ValidateBenefitRequest(BenefitRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.InsuranceProvider))
            throw new InvalidOperationException("Insurance provider is required.");
        if (!req.CoverageExtendedMedical && !req.CoverageDental && !req.CoverageVision)
            throw new InvalidOperationException("At least one coverage option is required.");
    }
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
