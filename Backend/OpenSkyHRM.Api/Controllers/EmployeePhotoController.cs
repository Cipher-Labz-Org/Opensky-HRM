using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModuleAny("People", "Employee360")]
[Route("api/employees/{employeeId:guid}/photo")]
public class EmployeePhotoController : ControllerBase
{
    private readonly IEmployeeService _employeeService;
    private readonly AppDbContext _db;
    private readonly IFileStorageService _files;

    public EmployeePhotoController(
        IEmployeeService employeeService,
        AppDbContext db,
        IFileStorageService files)
    {
        _employeeService = employeeService;
        _db = db;
        _files = files;
    }

    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid employeeId, CancellationToken cancellationToken)
    {
        if (!await CanUpdateEmployeePhotoAsync(employeeId))
            return Forbid();

        IFormCollection form;
        try
        {
            form = await Request.ReadFormAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Invalid multipart upload: {ex.Message}" });
        }

        var file = form.Files.GetFile("file") ?? form.Files.GetFile("File") ?? form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest(new { error = "Only JPEG, PNG, WebP and GIF images are allowed." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { error = "File size must be less than 5 MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var fileName = $"{employeeId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{ext}";
        var imageUrl = _files.BuildLogicalPath("photos", fileName);

        await using (var stream = file.OpenReadStream())
        {
            await _files.SaveAsync(imageUrl, stream, file.ContentType, cancellationToken);
        }

        var result = await _employeeService.UpdateProfileImageAsync(employeeId, imageUrl);
        if (result is null)
            return NotFound(new { message = "Employee not found." });

        return Ok(new { profileImageUrl = imageUrl });
    }

    private async Task<bool> CanUpdateEmployeePhotoAsync(Guid employeeId)
    {
        if (await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return true;

        var linkedEmployeeId = User.FindFirst("employeeId")?.Value;
        return Guid.TryParse(linkedEmployeeId, out var ownId) && ownId == employeeId;
    }
}
