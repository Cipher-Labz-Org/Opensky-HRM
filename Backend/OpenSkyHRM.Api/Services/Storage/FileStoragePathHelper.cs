using System.Text.RegularExpressions;
using OpenSkyHRM.Application.Options;

namespace OpenSkyHRM.Api.Services.Storage;

internal static class FileStoragePathHelper
{
    private static readonly Regex SafeSegmentRegex = new(@"[^A-Za-z0-9_-]+", RegexOptions.Compiled);

    public static string BuildLogicalPath(string category, string fileName)
    {
        var normalizedCategory = category.Trim().Trim('/').Replace('\\', '/');
        var normalizedFileName = fileName.Trim().Replace('\\', '/');
        return $"/uploads/{normalizedCategory}/{normalizedFileName}";
    }

    public static string ToPhysicalPath(string contentRootPath, FileStorageOptions options, string logicalPath)
    {
        var relative = StripUploadsPrefix(NormalizeLogicalPath(logicalPath));
        var storageRelative = FileStorageCategories.MapToStorageRelativePath(relative);
        var parts = new List<string> { contentRootPath, "wwwroot", "uploads" };

        AppendRootAndCompany(parts, options);
        parts.Add(storageRelative.Replace('/', Path.DirectorySeparatorChar));

        return Path.Combine(parts.ToArray());
    }

    /// <summary>HRM/{company}/Images/... layout (current).</summary>
    public static string ToObjectKey(FileStorageOptions options, string logicalPath)
    {
        var relative = StripUploadsPrefix(NormalizeLogicalPath(logicalPath));
        var storageRelative = FileStorageCategories.MapToStorageRelativePath(relative);
        return BuildStorageKey(options, storageRelative);
    }

    /// <summary>HRM/{company}/photos/... layout (before category subfolders).</summary>
    public static string ToIntermediateObjectKey(FileStorageOptions options, string logicalPath)
    {
        var relative = StripUploadsPrefix(NormalizeLogicalPath(logicalPath));
        return BuildStorageKey(options, relative);
    }

    /// <summary>Legacy flat layout: Files/photos/file.jpg.</summary>
    public static string ToLegacyObjectKey(FileStorageOptions options, string logicalPath)
    {
        var relative = StripUploadsPrefix(NormalizeLogicalPath(logicalPath));
        var prefix = SanitizeSegment(options.KeyPrefix);
        return string.IsNullOrEmpty(prefix) ? relative : $"{prefix}/{relative}";
    }

    public static string ToLegacyPhysicalPath(string contentRootPath, string logicalPath)
    {
        var relative = StripUploadsPrefix(NormalizeLogicalPath(logicalPath));
        return Path.Combine(contentRootPath, "wwwroot", "uploads", relative.Replace('/', Path.DirectorySeparatorChar));
    }

    public static string ToIntermediatePhysicalPath(string contentRootPath, FileStorageOptions options, string logicalPath)
    {
        var relative = StripUploadsPrefix(NormalizeLogicalPath(logicalPath));
        var parts = new List<string> { contentRootPath, "wwwroot", "uploads" };

        AppendRootAndCompany(parts, options);
        parts.Add(relative.Replace('/', Path.DirectorySeparatorChar));

        return Path.Combine(parts.ToArray());
    }

    public static string NormalizeLogicalPath(string logicalPath)
    {
        var trimmed = logicalPath.Trim().Replace('\\', '/');
        return trimmed.TrimStart('/');
    }

    public static string SanitizeSegment(string value)
    {
        var trimmed = value.Trim().Trim('/').Replace('\\', '/');
        if (string.IsNullOrEmpty(trimmed)) return "default";
        return SafeSegmentRegex.Replace(trimmed, "-").Trim('-');
    }

    public static void EnsureCompanyFolders(string contentRootPath, FileStorageOptions options)
    {
        var parts = new List<string> { contentRootPath, "wwwroot", "uploads" };
        AppendRootAndCompany(parts, options);

        var companyBase = Path.Combine(parts.ToArray());
        Directory.CreateDirectory(companyBase);

        foreach (var subfolder in FileStorageCategories.CompanySubfolders)
        {
            var folderPath = Path.Combine(companyBase, subfolder.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(folderPath);
        }
    }

    /// <summary>
    /// Shared-bucket tenants must use a dedicated company folder. Legacy flat paths are only
    /// consulted when no company folder is configured (local dev / single-tenant).
    /// </summary>
    public static bool ShouldAllowLegacyFallback(FileStorageOptions options)
    {
        return string.IsNullOrWhiteSpace(options.CompanyFolder)
            || string.Equals(options.ResolvedCompanyFolder, "default", StringComparison.OrdinalIgnoreCase);
    }

    private static string StripUploadsPrefix(string normalizedPath)
    {
        if (normalizedPath.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
            return normalizedPath["uploads/".Length..];
        return normalizedPath;
    }

    private static string BuildStorageKey(FileStorageOptions options, string relativePath)
    {
        var segments = new List<string>();

        if (!string.IsNullOrWhiteSpace(options.KeyPrefix))
            segments.Add(SanitizeSegment(options.KeyPrefix));

        if (!string.IsNullOrWhiteSpace(options.RootFolder))
            segments.Add(SanitizeSegment(options.RootFolder));

        segments.Add(SanitizeSegment(options.ResolvedCompanyFolder));
        segments.Add(relativePath.Trim('/'));

        return string.Join('/', segments.Where(s => !string.IsNullOrEmpty(s)));
    }

    private static void AppendRootAndCompany(List<string> parts, FileStorageOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.RootFolder))
            parts.Add(SanitizeSegment(options.RootFolder));

        parts.Add(SanitizeSegment(options.ResolvedCompanyFolder));
    }
}
