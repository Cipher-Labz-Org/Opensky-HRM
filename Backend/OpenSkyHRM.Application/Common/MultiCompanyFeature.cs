using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Common;

public static class MultiCompanyFeature
{
    public const string ActiveSettingKey = "MultiCompanyFeatureActive";

    public static async Task<bool> IsActiveAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        var row = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == ActiveSettingKey, cancellationToken);
        if (string.IsNullOrWhiteSpace(row?.Value)) return false;

        var value = row.Value.Trim();
        return value.Equals("true", StringComparison.OrdinalIgnoreCase)
               || value.Equals("1", StringComparison.OrdinalIgnoreCase)
               || value.Equals("yes", StringComparison.OrdinalIgnoreCase);
    }
}
