using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/biometric")]
public class BiometricController : ControllerBase
{
    private readonly IBiometricService _service;

    public BiometricController(IBiometricService service)
    {
        _service = service;
    }

    [HttpGet("devices")]
    public async Task<IActionResult> GetDevices() =>
        Ok(await _service.GetAllDevicesAsync());

    [HttpGet("devices/{id:guid}")]
    public async Task<IActionResult> GetDevice(Guid id)
    {
        var device = await _service.GetDeviceByIdAsync(id);
        return device == null ? NotFound() : Ok(device);
    }

    [HttpPost("devices")]
    public async Task<IActionResult> CreateDevice([FromBody] CreateBiometricDeviceDto dto)
    {
        var result = await _service.CreateDeviceAsync(dto);
        return CreatedAtAction(nameof(GetDevice), new { id = result.Id }, result);
    }

    [HttpPut("devices/{id:guid}")]
    public async Task<IActionResult> UpdateDevice(Guid id, [FromBody] UpdateBiometricDeviceDto dto)
    {
        var result = await _service.UpdateDeviceAsync(id, dto);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("devices/{id:guid}")]
    public async Task<IActionResult> DeleteDevice(Guid id)
    {
        var ok = await _service.DeleteDeviceAsync(id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("import")]
    public async Task<IActionResult> ImportPunches([FromBody] ImportPunchesRequest request)
    {
        try
        {
            var result = await _service.ImportPunchesAsync(request.DeviceId, request.FileName, request.Rows);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("import-history")]
    public async Task<IActionResult> GetImportHistory([FromQuery] Guid? deviceId = null) =>
        Ok(await _service.GetImportHistoryAsync(deviceId));
}

public class ImportPunchesRequest
{
    public Guid DeviceId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public List<PunchImportRowDto> Rows { get; set; } = new();
}
