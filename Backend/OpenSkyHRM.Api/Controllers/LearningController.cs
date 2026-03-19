using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LearningController : ControllerBase
{
    private readonly ILearningService _learningService;
    public LearningController(ILearningService learningService) { _learningService = learningService; }

    [HttpGet("courses")]
    public async Task<IActionResult> GetCourses()
        => Ok(await _learningService.GetCoursesAsync());

    [HttpGet("skills")]
    public async Task<IActionResult> GetSkills()
        => Ok(await _learningService.GetSkillsAsync());

    [HttpGet("skill-matrix")]
    public async Task<IActionResult> GetSkillMatrix([FromQuery] Guid? employeeId = null)
        => Ok(await _learningService.GetSkillMatrixAsync(employeeId));
}
