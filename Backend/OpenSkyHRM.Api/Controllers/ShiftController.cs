using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ShiftController : ControllerBase
{
    private readonly IShiftService _shiftService;
    private readonly AppDbContext _db;

    public ShiftController(IShiftService shiftService, AppDbContext db)
    {
        _shiftService = shiftService;
        _db = db;
    }

    /// <summary>
    /// Only users with full People scope (ADMIN or People:Update:All) can manage shifts.
    /// </summary>
    private async Task<bool> CanManageShiftsAsync()
    {
        if (User.IsInRole("ADMIN")) return true;
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        return allowedIds == null; // null = All scope
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        return Ok(await _shiftService.GetAllAsync(includeInactive));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var shift = await _shiftService.GetByIdAsync(id);
        return shift is null ? NotFound() : Ok(shift);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateShiftPatternDto dto)
    {
        if (!await CanManageShiftsAsync())
            return Forbid();
        try
        {
            var result = await _shiftService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShiftPatternDto dto)
    {
        if (!await CanManageShiftsAsync())
            return Forbid();
        try
        {
            var result = await _shiftService.UpdateAsync(id, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!await CanManageShiftsAsync())
            return Forbid();
        try
        {
            var deleted = await _shiftService.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
