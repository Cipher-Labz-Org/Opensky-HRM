using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/system-settings")]
public class SystemSettingsController : ControllerBase
{
    private readonly ISystemSettingService _service;

    public SystemSettingsController(ISystemSettingService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        return Ok(await _service.GetAllAsync());
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var value = await _service.GetAsync(key);
        if (value is null) return NotFound();
        return Ok(new { key, value });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] UpdateSettingDto dto)
    {
        await _service.SetAsync(key, dto.Value);
        return Ok(new { key, value = dto.Value });
    }

    [HttpGet("next-employee-code")]
    public async Task<IActionResult> GetNextEmployeeCode()
    {
        var code = await _service.GenerateNextEmployeeCodeAsync();
        return Ok(new { code });
    }
}

public record UpdateSettingDto(string Value);
