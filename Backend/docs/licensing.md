# Per-instance licensing

## Model

- One **customer per database**. `InstanceSubscription` uses `InstanceKey = "default"` (single row).
- **`LicensedModule`**: catalog of sellable modules (`Code` matches RBAC module names and API enforcement).
- **`InstanceModuleEntitlement`**: per-module `IsEnabled` flags for that subscription.
- **Required modules** (`LicensedModule.IsRequired`): always included in effective entitlements and cannot be turned off via the API. They are defined in [`LicensingSeeder`](../OpenSkyHRM.Persistence/Seeders/LicensingSeeder.cs) (currently `Dashboard`, `People`, `Settings`, `Billing`).

## Behavior

- **Active / Trial**: effective modules = required ∪ optional modules with `IsEnabled`.
- **Suspended**: effective modules = **required only** (optional modules are hidden/disabled regardless of entitlements).
- **Caching**: effective module codes are cached for five minutes; updates invalidate the cache.

## Migration and seeding

1. Apply EF migrations (adds `LicensedModules`, `InstanceSubscriptions`, `InstanceModuleEntitlements`).
2. On API startup, when the database is available, [`LicensingSeeder.EnsureAsync`](../OpenSkyHRM.Persistence/Seeders/LicensingSeeder.cs) runs in **all** environments: it creates the catalog and default subscription if missing, and adds entitlements for any new catalog modules. Existing installs therefore keep **all modules enabled** until an admin changes entitlements.

## API enforcement

Controllers that serve a licensed area use [`RequireLicensedModule`](../OpenSkyHRM.Api/Filters/RequireLicensedModuleAttribute.cs). Unlicensed calls return **403** with body `{ "code": "MODULE_NOT_LICENSED", "module": "<Code>" }`. `LicensingController` and `AuthController` are not module-gated so sign-in and licensing management stay reachable.

## Tests

[`OpenSkyHRM.Application.Tests`](../OpenSkyHRM.Application.Tests/LicensingServiceTests.cs) covers required-module validation, suspended effective set, and turning off an optional module.
