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

    public BankAccountsController(AppDbContext db) => _db = db;

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
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] BankAccountRequest req)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Create"))
            return Forbid();
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound();

        var item = new BankAccount
        {
            EmployeeId = employeeId,
            Amount = 0,
            AccountNumber = req.AccountNumber,
            BankName = req.BankName,
            AccountType = req.AccountType,
            BankCode = req.BankCode,
            BranchCode = req.BranchCode,
            BranchLocation = req.BranchLocation,
        };

        _db.BankAccounts.Add(item);
        await _db.SaveChangesAsync();
        return Ok(MapToDto(item));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid employeeId, Guid id, [FromBody] BankAccountRequest req)
    {
        var item = await _db.BankAccounts
            .FirstOrDefaultAsync(b => b.Id == id && b.EmployeeId == employeeId);
        if (item is null) return NotFound();

        item.AccountNumber = req.AccountNumber;
        item.BankName = req.BankName;
        item.AccountType = req.AccountType;
        item.BankCode = req.BankCode;
        item.BranchCode = req.BranchCode;
        item.BranchLocation = req.BranchLocation;
        await _db.SaveChangesAsync();

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
        await _db.SaveChangesAsync();
        return NoContent();
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
