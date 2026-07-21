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
[Route("api/employees/{employeeId:guid}/bank-accounts")]
public class BankAccountsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public BankAccountsController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var items = await _db.BankAccounts
            .Where(b => b.EmployeeId == employeeId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new BankAccountDto
            {
                Id = b.Id,
                EmployeeId = b.EmployeeId,
                AccountNumber = b.AccountNumber,
                BankName = b.BankName,
                AccountType = b.AccountType,
                BankCode = b.BankCode,
                BranchCode = b.BranchCode,
                BranchLocation = b.BranchLocation,
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] BankAccountRequest? req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        if (req is null)
            return BadRequest(new { message = "Request body is required." });

        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        try
        {
            ValidateBankAccountRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var item = MapRequestToEntity(employeeId, req);
        _db.BankAccounts.Add(item);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            return MapSaveException(ex);
        }

        return Ok(MapToDto(item));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid id, [FromBody] BankAccountRequest? req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        if (req is null)
            return BadRequest(new { message = "Request body is required." });

        var item = await _db.BankAccounts
            .FirstOrDefaultAsync(b => b.Id == id && b.EmployeeId == employeeId);
        if (item is null) return NotFound();

        try
        {
            ValidateBankAccountRequest(req);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        ApplyRequest(item, req);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            return MapSaveException(ex);
        }

        return Ok(MapToDto(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid id)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var item = await _db.BankAccounts
            .FirstOrDefaultAsync(b => b.Id == id && b.EmployeeId == employeeId);
        if (item is null) return NotFound();

        item.IsDeleted = true;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            return MapSaveException(ex);
        }

        return NoContent();
    }

    private static BankAccount MapRequestToEntity(Guid employeeId, BankAccountRequest req) => new()
    {
        EmployeeId = employeeId,
        AccountNumber = req.AccountNumber.Trim(),
        BankName = TrimOrNull(req.BankName),
        AccountType = string.IsNullOrWhiteSpace(req.AccountType) ? "Checking" : req.AccountType.Trim(),
        BankCode = TrimOrNull(req.BankCode),
        BranchCode = TrimOrNull(req.BranchCode),
        BranchLocation = TrimOrNull(req.BranchLocation),
    };

    private static void ApplyRequest(BankAccount item, BankAccountRequest req)
    {
        item.AccountNumber = req.AccountNumber.Trim();
        item.BankName = TrimOrNull(req.BankName);
        item.AccountType = string.IsNullOrWhiteSpace(req.AccountType) ? "Checking" : req.AccountType.Trim();
        item.BankCode = TrimOrNull(req.BankCode);
        item.BranchCode = TrimOrNull(req.BranchCode);
        item.BranchLocation = TrimOrNull(req.BranchLocation);
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private IActionResult MapSaveException(DbUpdateException ex)
    {
        var detail = ex.InnerException?.Message ?? ex.Message;
        Console.WriteLine($"ERROR: Bank account save failed: {detail}");

        if (detail.Contains("Amount", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("BankAccounts", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(500, new
            {
                message = "Bank account could not be saved because the database schema is out of date. Restart the API so migrations/schema repair can run, or contact support.",
            });
        }

        if (_env.IsDevelopment())
            return BadRequest(new { message = detail });

        return StatusCode(500, new { message = "Could not save bank account. Please try again or contact support." });
    }

    private static BankAccountDto MapToDto(BankAccount b) => new()
    {
        Id = b.Id,
        EmployeeId = b.EmployeeId,
        AccountNumber = b.AccountNumber,
        BankName = b.BankName,
        AccountType = b.AccountType,
        BankCode = b.BankCode,
        BranchCode = b.BranchCode,
        BranchLocation = b.BranchLocation,
    };

    private static void ValidateBankAccountRequest(BankAccountRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.AccountNumber))
            throw new InvalidOperationException("Account number is required.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(req.AccountNumber.Trim(), @"^\d+$"))
            throw new InvalidOperationException("Account number must contain numbers only.");
    }
}

public class BankAccountDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string AccountNumber { get; set; } = string.Empty;
    public string? BankName { get; set; }
    public string AccountType { get; set; } = "Checking";
    public string? BankCode { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchLocation { get; set; }
}

public class BankAccountRequest
{
    public string AccountNumber { get; set; } = string.Empty;
    public string? BankName { get; set; }
    public string AccountType { get; set; } = "Checking";
    public string? BankCode { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchLocation { get; set; }
}
