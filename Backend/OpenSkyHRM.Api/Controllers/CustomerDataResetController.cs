using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Administration")]
[RequirePermission("Administration", "Delete")]
[Route("api/admin/customer-reset")]
public class CustomerDataResetController : ControllerBase
{
    private readonly ICustomerDataResetService _resetService;
    private readonly IConfiguration _configuration;
    private const string ConfirmPhraseConfigPath = "CustomerReset:ConfirmPhrase";
    private const string DefaultConfirmPhrase = "ERASE CUSTOMER DATA";

    public CustomerDataResetController(ICustomerDataResetService resetService, IConfiguration configuration)
    {
        _resetService = resetService;
        _configuration = configuration;
    }

    public record CustomerResetRequest(
        bool DryRun,
        bool AllowInProduction,
        bool IncludeHangfire,
        string? ConfirmPhrase,
        IReadOnlyList<string>? SelectedTables);

    private string GetConfirmPhrase()
    {
        var configured = _configuration[ConfirmPhraseConfigPath];
        return string.IsNullOrWhiteSpace(configured) ? DefaultConfirmPhrase : configured;
    }

    [HttpGet("confirm-phrase")]
    public IActionResult GetConfirmPhraseEndpoint()
        => Ok(new { phrase = GetConfirmPhrase() });

    [HttpPost]
    public async Task<IActionResult> Reset([FromBody] CustomerResetRequest request, CancellationToken cancellationToken)
    {
        var providedPhrase = request.ConfirmPhrase;

        if (request.DryRun)
        {
            // Dry-run does not execute any destructive commands, but still requires auth+permission (via attributes).
            var preview = await _resetService.DryRunAsync(request.IncludeHangfire, cancellationToken);
            return Ok(new { dryRun = true, preview });
        }

        if (string.IsNullOrWhiteSpace(providedPhrase))
            return Unauthorized(new { message = "Missing confirmation phrase." });

        try
        {
            var result = await _resetService.ExecuteAsync(
                providedPhrase,
                request.AllowInProduction,
                request.IncludeHangfire,
                request.SelectedTables,
                cancellationToken);
            return Ok(new { dryRun = false, result });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

