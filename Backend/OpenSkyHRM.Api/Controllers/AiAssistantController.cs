using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/ai-assistant")]
public class AiAssistantController : ControllerBase
{
    private readonly IAiAssistantService _assistant;
    private readonly IAiConversationService _conversations;
    private readonly IAiDataRetentionService _retention;
    private readonly OpenAiSettingsResolver _openAi;
    private readonly ILicensingService _licensing;
    private readonly AppDbContext _db;

    public AiAssistantController(
        IAiAssistantService assistant,
        IAiConversationService conversations,
        IAiDataRetentionService retention,
        OpenAiSettingsResolver openAi,
        ILicensingService licensing,
        AppDbContext db)
    {
        _assistant = assistant;
        _conversations = conversations;
        _retention = retention;
        _openAi = openAi;
        _licensing = licensing;
        _db = db;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var user = await BuildUserContextAsync();
        return Ok(await _assistant.GetStatusAsync(user));
    }

    [HttpGet("conversations")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> ListConversations()
    {
        var userId = GetUserId();
        return Ok(await _conversations.ListConversationsAsync(userId));
    }

    [HttpGet("conversations/{id:guid}/messages")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> GetMessages(Guid id)
    {
        try
        {
            return Ok(await _conversations.GetMessagesAsync(GetUserId(), id));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("chat")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request)
    {
        try
        {
            var user = await BuildUserContextAsync();
            return Ok(await _assistant.ChatAsync(user, request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("messages/{messageId:guid}/feedback")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> SetFeedback(Guid messageId, [FromBody] AiMessageFeedbackDto dto)
    {
        try
        {
            await _conversations.SetFeedbackAsync(GetUserId(), messageId, dto.Rating);
            return Ok(new { saved = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("conversations/{id:guid}")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> DeleteConversation(Guid id)
    {
        try
        {
            await _conversations.DeleteConversationAsync(GetUserId(), id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("privacy")]
    public async Task<IActionResult> GetPrivacyNotice()
    {
        var snapshot = await _openAi.GetPrivacySnapshotAsync();
        return Ok(new AiPrivacyNoticeDto
        {
            Notice = AiPrivacyNoticeProvider.BuildNotice(snapshot),
            Provider = snapshot.Provider,
            Region = snapshot.Region,
            ChatRetentionDays = snapshot.ChatRetentionDays,
            AuditRetentionDays = snapshot.AuditRetentionDays,
            AllowPersonalNamesInLlm = snapshot.AllowPersonalNamesInLlm,
        });
    }

    [HttpGet("my-data/export")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> ExportMyData()
    {
        var data = await _retention.ExportUserDataAsync(GetUserId());
        return Ok(data);
    }

    [HttpDelete("my-data")]
    [RequireLicensedModule("AiAssistant")]
    public async Task<IActionResult> DeleteMyData()
    {
        await _retention.DeleteAllUserDataAsync(GetUserId());
        return NoContent();
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(sub, out var id))
            throw new InvalidOperationException("Invalid user identity.");
        return id;
    }

    private async Task<AiUserContext> BuildUserContextAsync()
    {
        var userId = GetUserId();
        Guid? employeeId = Guid.TryParse(User.FindFirstValue("employeeId"), out var eid) ? eid : null;
        var licensedModules = (await _licensing.GetEffectiveModuleCodesAsync()).ToList();

        var dbUser = await _db.Users.AsNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r!.Permissions)
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

        var roles = dbUser?.UserRoles
            .Select(ur => ur.Role?.Code)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? ReadRoleCodes(User).ToList();

        if (roles.Count == 0)
            roles = ReadRoleCodes(User).ToList();

        var permissions = dbUser?.UserRoles
            .SelectMany(ur => ur.Role?.Permissions.Where(p => !p.IsDeleted) ?? [])
            .Select(p => $"{p.Module}:{p.Action}:{p.Scope}")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? User.FindAll("permission").Select(c => c.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        if (!employeeId.HasValue && dbUser?.EmployeeId != null)
            employeeId = dbUser.EmployeeId;

        var employeeName = dbUser?.Employee != null
            ? $"{dbUser.Employee.FirstName} {dbUser.Employee.LastName}".Trim()
            : User.FindFirstValue("employeeName");

        return new AiUserContext
        {
            UserId = userId,
            EmployeeId = employeeId,
            Username = dbUser?.Username ?? User.FindFirstValue("username") ?? User.Identity?.Name ?? "User",
            EmployeeName = employeeName,
            Roles = roles,
            Permissions = permissions,
            LicensedModules = licensedModules,
        };
    }

    private static IReadOnlyList<string> ReadRoleCodes(ClaimsPrincipal user)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in user.FindAll(ClaimTypes.Role).Concat(user.FindAll("role")))
        {
            if (!string.IsNullOrWhiteSpace(claim.Value))
                roles.Add(claim.Value);
        }

        if (user.IsInRole("ADMIN"))
            roles.Add("ADMIN");

        return roles.ToList();
    }
}
