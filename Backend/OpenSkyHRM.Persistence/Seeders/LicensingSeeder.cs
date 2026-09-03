using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Idempotent licensing catalog and default subscription for one-customer-per-database deployments.
/// Required modules (Dashboard, People, Settings, Billing) cannot be turned off in the application layer.
/// </summary>
public static class LicensingSeeder
{
    /// <summary>Stable IDs for seed data (migrations and runtime seed must agree).</summary>
    public static readonly Guid SubscriptionId = Guid.Parse("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d");

    public static readonly (Guid Id, string Code, string DisplayName, string Category, int Sort, bool Required)[] ModuleDefinitions =
    {
        (Guid.Parse("10000001-0000-0000-0000-000000000001"), "Dashboard", "Dashboard", "Core", 10, true),
        (Guid.Parse("10000001-0000-0000-0000-000000000002"), "People", "People Hub", "Core", 20, true),
        (Guid.Parse("10000001-0000-0000-0000-000000000003"), "Settings", "Policy & Settings", "Intelligence", 30, true),
        (Guid.Parse("10000001-0000-0000-0000-000000000004"), "Billing", "Billing", "Intelligence", 40, true),
        (Guid.Parse("10000001-0000-0000-0000-000000000010"), "Recruitment", "Recruitment", "Core", 50, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000011"), "EmployeeTasks", "Employee Tasks", "Core", 60, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000012"), "Onboarding", "Onboarding", "Core", 70, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000013"), "Offboarding", "Offboarding", "Core", 80, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000020"), "Leave", "Leave & Absence", "Workforce", 10, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000021"), "Attendance", "Time & Attendance", "Workforce", 20, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000022"), "Payroll", "Payroll", "Workforce", 30, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000023"), "Performance", "Performance Appraisal", "Workforce", 40, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000024"), "Learning", "Learning & Skills", "Workforce", 50, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000030"), "OrgStructure", "Org Structure", "Intelligence", 10, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000031"), "Analytics", "Analytics & Reports", "Intelligence", 20, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000041"), "AiAssistant", "OpenSky AI", "Intelligence", 25, false),
        (Guid.Parse("10000001-0000-0000-0000-000000000040"), "Administration", "Administration", "Administration", 10, false),
    };

    public static async Task EnsureAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var existingModuleIds = await context.LicensedModules
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        var existingIdSet = existingModuleIds.ToHashSet();

        foreach (var m in ModuleDefinitions)
        {
            if (existingIdSet.Contains(m.Id))
            {
                var row = await context.LicensedModules
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(x => x.Id == m.Id, cancellationToken);
                if (row != null)
                {
                    row.Code = m.Code;
                    row.DisplayName = m.DisplayName;
                    row.Category = m.Category;
                    row.SortOrder = m.Sort;
                    row.IsRequired = m.Required;
                    row.IsActive = true;
                    row.IsDeleted = false;
                }
                continue;
            }

            var existingByCode = await context.LicensedModules
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Code == m.Code, cancellationToken);
            if (existingByCode != null)
            {
                existingByCode.DisplayName = m.DisplayName;
                existingByCode.Category = m.Category;
                existingByCode.SortOrder = m.Sort;
                existingByCode.IsRequired = m.Required;
                existingByCode.IsActive = true;
                existingByCode.IsDeleted = false;
                continue;
            }

            context.LicensedModules.Add(new LicensedModule
            {
                Id = m.Id,
                Code = m.Code,
                DisplayName = m.DisplayName,
                Category = m.Category,
                SortOrder = m.Sort,
                IsRequired = m.Required,
                IsActive = true
            });
        }

        await context.SaveChangesAsync(cancellationToken);

        if (!await context.InstanceSubscriptions.AnyAsync(cancellationToken))
        {
            var sub = new InstanceSubscription
            {
                Id = SubscriptionId,
                InstanceKey = InstanceSubscription.DefaultInstanceKey,
                Status = SubscriptionStatus.Active,
                PlanName = "Full",
                ValidFrom = DateTime.UtcNow
            };
            context.InstanceSubscriptions.Add(sub);

            var moduleIds = await context.LicensedModules.Select(x => x.Id).ToListAsync(cancellationToken);
            foreach (var mid in moduleIds)
            {
                context.InstanceModuleEntitlements.Add(new InstanceModuleEntitlement
                {
                    InstanceSubscriptionId = sub.Id,
                    LicensedModuleId = mid,
                    IsEnabled = true
                });
            }
        }
        else
        {
            var sub = await context.InstanceSubscriptions
                .Include(s => s.ModuleEntitlements)
                .FirstAsync(s => s.InstanceKey == InstanceSubscription.DefaultInstanceKey, cancellationToken);

            var existing = sub.ModuleEntitlements.Select(e => e.LicensedModuleId).ToHashSet();
            var allModules = await context.LicensedModules.Where(m => m.IsActive && !m.IsDeleted).ToListAsync(cancellationToken);
            foreach (var mod in allModules)
            {
                if (existing.Contains(mod.Id)) continue;
                context.InstanceModuleEntitlements.Add(new InstanceModuleEntitlement
                {
                    InstanceSubscriptionId = sub.Id,
                    LicensedModuleId = mod.Id,
                    IsEnabled = true
                });
            }
        }

        await EnsureWorkforceModulesEntitledAsync(context, cancellationToken);
    }

    /// <summary>
    /// Ensures Performance Appraisal and Learning appear in the sidebar (module row active + entitlement enabled).
    /// </summary>
    public static async Task EnsureWorkforceModulesEntitledAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var codes = new[] { "Performance", "Learning" };
        var modules = await context.LicensedModules
            .IgnoreQueryFilters()
            .Where(m => codes.Contains(m.Code))
            .ToListAsync(cancellationToken);

        foreach (var def in ModuleDefinitions.Where(m => codes.Contains(m.Code)))
        {
            if (modules.Any(m => m.Code == def.Code)) continue;
            var created = new LicensedModule
            {
                Id = def.Id,
                Code = def.Code,
                DisplayName = def.DisplayName,
                Category = def.Category,
                SortOrder = def.Sort,
                IsRequired = def.Required,
                IsActive = true,
            };
            context.LicensedModules.Add(created);
            modules.Add(created);
        }

        foreach (var mod in modules)
        {
            mod.IsActive = true;
            mod.IsDeleted = false;
        }

        var subs = await context.InstanceSubscriptions
            .Include(s => s.ModuleEntitlements)
            .Where(s => !s.IsDeleted && s.InstanceKey == InstanceSubscription.DefaultInstanceKey)
            .ToListAsync(cancellationToken);

        foreach (var sub in subs)
        {
            foreach (var mod in modules)
            {
                var ent = sub.ModuleEntitlements.FirstOrDefault(e => e.LicensedModuleId == mod.Id && !e.IsDeleted);
                if (ent == null)
                {
                    context.InstanceModuleEntitlements.Add(new InstanceModuleEntitlement
                    {
                        InstanceSubscriptionId = sub.Id,
                        LicensedModuleId = mod.Id,
                        IsEnabled = true,
                    });
                }
                else
                {
                    ent.IsEnabled = true;
                    ent.IsDeleted = false;
                }
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Dev/local alias — kept for callers that already reference this name.
    /// </summary>
    public static Task EnsureDevWorkforceModulesAsync(AppDbContext context, CancellationToken cancellationToken = default)
        => EnsureWorkforceModulesEntitledAsync(context, cancellationToken);
}
