using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.DTOs.Auth;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class LicensingService : ILicensingService
{
    public const string EffectiveModulesCacheKey = "licensing:effective-module-codes";

    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly ILogger<LicensingService> _logger;

    public LicensingService(AppDbContext db, IMemoryCache cache, ILogger<LicensingService> logger)
    {
        _db = db;
        _cache = cache;
        _logger = logger;
    }

    public void InvalidateCache() => _cache.Remove(EffectiveModulesCacheKey);

    public async Task<IReadOnlyList<string>> GetEffectiveModuleCodesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var list = await _cache.GetOrCreateAsync(EffectiveModulesCacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await ComputeEffectiveModuleCodesAsync(cancellationToken);
            });
            return list ?? new List<string>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Licensing data is unavailable (run database migrations). Sign-in continues with no module filter.");
            return new List<string>();
        }
    }

    public async Task<LicensingSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var sub = await _db.InstanceSubscriptions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.InstanceKey == InstanceSubscription.DefaultInstanceKey && !s.IsDeleted, cancellationToken);

            var modules = (await GetEffectiveModuleCodesAsync(cancellationToken)).ToList();

            if (sub == null)
            {
                return new LicensingSummaryDto
                {
                    PlanName = "",
                    Status = "Unknown",
                    LicensedModules = modules
                };
            }

            return new LicensingSummaryDto
            {
                PlanName = sub.PlanName,
                Status = sub.Status.ToString(),
                ValidFrom = sub.ValidFrom,
                ValidUntil = sub.ValidUntil,
                LicensedModules = modules
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load licensing summary.");
            return new LicensingSummaryDto
            {
                PlanName = "",
                Status = "Unknown",
                LicensedModules = new List<string>()
            };
        }
    }

    public async Task<bool> IsModuleLicensedAsync(string moduleCode, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(moduleCode)) return false;
        var codes = await GetEffectiveModuleCodesAsync(cancellationToken);
        return codes.Contains(moduleCode, StringComparer.Ordinal);
    }

    public async Task<List<AvailableModuleDto>> GetLicensedModulesForRoleAssignmentAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var effective = await GetEffectiveModuleCodesAsync(cancellationToken);
            var set = effective.ToHashSet(StringComparer.Ordinal);
            return await _db.LicensedModules
                .AsNoTracking()
                .Where(m => !m.IsDeleted && m.IsActive && set.Contains(m.Code))
                .OrderBy(m => m.Category)
                .ThenBy(m => m.SortOrder)
                .ThenBy(m => m.DisplayName)
                .Select(m => new AvailableModuleDto { Module = m.Code, Label = m.DisplayName })
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load licensed modules for role assignment.");
            return new List<AvailableModuleDto>();
        }
    }

    public async Task<LicensingAdminDto> GetAdminStateAsync(CancellationToken cancellationToken = default)
    {
        var sub = await GetOrThrowSubscriptionAsync(cancellationToken);
        var modules = await _db.LicensedModules
            .AsNoTracking()
            .Where(m => !m.IsDeleted && m.IsActive)
            .OrderBy(m => m.Category)
            .ThenBy(m => m.SortOrder)
            .ThenBy(m => m.DisplayName)
            .ToListAsync(cancellationToken);

        var entByModuleId = await _db.InstanceModuleEntitlements
            .Where(e => e.InstanceSubscriptionId == sub.Id && !e.IsDeleted)
            .ToDictionaryAsync(e => e.LicensedModuleId, cancellationToken);

        var dtos = modules.Select(m =>
        {
            entByModuleId.TryGetValue(m.Id, out var ent);
            var enabled = m.IsRequired || ent == null || ent.IsEnabled;
            return new LicensedModuleAdminDto
            {
                Id = m.Id,
                Code = m.Code,
                DisplayName = m.DisplayName,
                Category = m.Category,
                SortOrder = m.SortOrder,
                IsRequired = m.IsRequired,
                IsActive = m.IsActive,
                IsEnabled = enabled
            };
        }).ToList();

        return new LicensingAdminDto
        {
            Subscription = MapSubscription(sub),
            Modules = dtos
        };
    }

    public async Task UpdateEntitlementsAsync(UpdateModuleEntitlementsDto dto, CancellationToken cancellationToken = default)
    {
        var sub = await GetOrThrowSubscriptionAsync(cancellationToken);
        var enabledSet = new HashSet<string>(
            dto.EnabledOptionalModuleCodes ?? new List<string>(),
            StringComparer.Ordinal);

        var modules = await _db.LicensedModules
            .Where(m => !m.IsDeleted && m.IsActive)
            .ToListAsync(cancellationToken);

        var required = modules.Where(m => m.IsRequired).Select(m => m.Code).ToHashSet(StringComparer.Ordinal);
        foreach (var code in enabledSet)
        {
            if (required.Contains(code))
                throw new InvalidOperationException($"Module '{code}' is required and cannot be toggled.");
        }

        var entitlements = await _db.InstanceModuleEntitlements
            .Where(e => e.InstanceSubscriptionId == sub.Id && !e.IsDeleted)
            .ToListAsync(cancellationToken);

        var entByModuleId = entitlements.ToDictionary(e => e.LicensedModuleId);

        foreach (var mod in modules)
        {
            if (!entByModuleId.TryGetValue(mod.Id, out var ent))
            {
                ent = new InstanceModuleEntitlement
                {
                    InstanceSubscriptionId = sub.Id,
                    LicensedModuleId = mod.Id
                };
                _db.InstanceModuleEntitlements.Add(ent);
                entByModuleId[mod.Id] = ent;
            }

            if (mod.IsRequired)
                ent.IsEnabled = true;
            else
                ent.IsEnabled = enabledSet.Contains(mod.Code);
        }

        await _db.SaveChangesAsync(cancellationToken);
        InvalidateCache();
    }

    public async Task<InstanceSubscriptionDto> UpdateSubscriptionAsync(UpdateInstanceSubscriptionDto dto, CancellationToken cancellationToken = default)
    {
        var sub = await GetOrThrowSubscriptionAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(dto.Status) &&
            Enum.TryParse<SubscriptionStatus>(dto.Status, true, out var st))
            sub.Status = st;

        if (!string.IsNullOrWhiteSpace(dto.PlanName))
            sub.PlanName = dto.PlanName.Trim();

        if (dto.ValidFrom.HasValue)
            sub.ValidFrom = dto.ValidFrom.Value;

        sub.ValidUntil = dto.ValidUntil;
        sub.Notes = dto.Notes;
        sub.MaxEmployees = dto.MaxEmployees;

        await _db.SaveChangesAsync(cancellationToken);
        InvalidateCache();
        return MapSubscription(sub);
    }

    private async Task<List<string>> ComputeEffectiveModuleCodesAsync(CancellationToken cancellationToken)
    {
        try
        {
            var sub = await _db.InstanceSubscriptions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.InstanceKey == InstanceSubscription.DefaultInstanceKey && !s.IsDeleted, cancellationToken);

            if (sub == null)
                return new List<string>();

            var modules = await _db.LicensedModules
                .AsNoTracking()
                .Where(m => !m.IsDeleted && m.IsActive)
                .ToListAsync(cancellationToken);

            var entitlements = await _db.InstanceModuleEntitlements
                .AsNoTracking()
                .Where(e => e.InstanceSubscriptionId == sub.Id && !e.IsDeleted)
                .ToDictionaryAsync(e => e.LicensedModuleId, e => e.IsEnabled, cancellationToken);

            var result = new HashSet<string>(StringComparer.Ordinal);

            if (sub.Status == SubscriptionStatus.Suspended)
            {
                foreach (var m in modules.Where(x => x.IsRequired))
                    result.Add(m.Code);
                return result.OrderBy(x => x, StringComparer.Ordinal).ToList();
            }

            foreach (var m in modules)
            {
                if (m.IsRequired)
                {
                    result.Add(m.Code);
                    continue;
                }

                if (!entitlements.TryGetValue(m.Id, out var on))
                    on = true;

                if (on)
                    result.Add(m.Code);
            }

            return result.OrderBy(x => x, StringComparer.Ordinal).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Could not read licensing tables (apply EF migrations: AddLicensingTables). Sign-in continues with no module filter.");
            return new List<string>();
        }
    }

    private async Task<InstanceSubscription> GetOrThrowSubscriptionAsync(CancellationToken cancellationToken)
    {
        var sub = await _db.InstanceSubscriptions
            .FirstOrDefaultAsync(s => s.InstanceKey == InstanceSubscription.DefaultInstanceKey && !s.IsDeleted, cancellationToken)
            ?? throw new InvalidOperationException("No instance subscription found. Run database migrations and licensing seed.");
        return sub;
    }

    private static InstanceSubscriptionDto MapSubscription(InstanceSubscription sub) => new()
    {
        Id = sub.Id,
        InstanceKey = sub.InstanceKey,
        Status = sub.Status.ToString(),
        PlanName = sub.PlanName,
        ValidFrom = sub.ValidFrom,
        ValidUntil = sub.ValidUntil,
        Notes = sub.Notes,
        MaxEmployees = sub.MaxEmployees
    };
}
