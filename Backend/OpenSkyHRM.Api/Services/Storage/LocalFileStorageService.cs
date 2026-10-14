using Microsoft.Extensions.Options;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Options;

namespace OpenSkyHRM.Api.Services.Storage;

public sealed class LocalFileStorageService : IFileStorageService
{
    private readonly IWebHostEnvironment _env;
    private readonly FileStorageOptions _options;
    private readonly ILogger<LocalFileStorageService> _logger;

    public LocalFileStorageService(
        IWebHostEnvironment env,
        IOptions<FileStorageOptions> options,
        ILogger<LocalFileStorageService> logger)
    {
        _env = env;
        _options = options.Value;
        _logger = logger;

        _logger.LogInformation(
            "Local file storage enabled: {Root}/uploads/{Hrm}/{Company}/",
            _env.ContentRootPath,
            FileStoragePathHelper.SanitizeSegment(_options.RootFolder),
            FileStoragePathHelper.SanitizeSegment(_options.ResolvedCompanyFolder));
    }

    public bool UsesRemoteStorage => false;

    public string BuildLogicalPath(string category, string fileName) =>
        FileStoragePathHelper.BuildLogicalPath(category, fileName);

    public async Task SaveAsync(
        string logicalPath,
        Stream content,
        string? contentType = null,
        CancellationToken cancellationToken = default)
    {
        var physicalPath = ResolveWritePath(logicalPath);
        var directory = Path.GetDirectoryName(physicalPath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);

        await using var fileStream = new FileStream(
            physicalPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true);
        await content.CopyToAsync(fileStream, cancellationToken);
        _logger.LogInformation(
            "Saved file: logical={LogicalPath} physical={PhysicalPath}",
            logicalPath,
            physicalPath);
    }

    public Task<StoredFileReadResult?> OpenReadAsync(
        string logicalPath,
        CancellationToken cancellationToken = default)
    {
        foreach (var physicalPath in ResolveReadPaths(logicalPath))
        {
            if (!File.Exists(physicalPath)) continue;

            _logger.LogInformation(
                "Opened file: logical={LogicalPath} physical={PhysicalPath}",
                logicalPath,
                physicalPath);

            Stream stream = new FileStream(
                physicalPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 81920,
                useAsync: true);

            return Task.FromResult<StoredFileReadResult?>(new StoredFileReadResult
            {
                Stream = stream,
                ContentType = GuessContentType(physicalPath),
            });
        }

        return Task.FromResult<StoredFileReadResult?>(null);
    }

    public Task<bool> ExistsAsync(string logicalPath, CancellationToken cancellationToken = default)
    {
        var found = ResolveReadPaths(logicalPath).FirstOrDefault(File.Exists);
        if (found is not null)
            _logger.LogDebug("File exists: logical={LogicalPath} physical={PhysicalPath}", logicalPath, found);

        return Task.FromResult(found is not null);
    }

    public Task DeleteAsync(string logicalPath, CancellationToken cancellationToken = default)
    {
        foreach (var physicalPath in ResolveReadPaths(logicalPath))
        {
            if (File.Exists(physicalPath))
            {
                File.Delete(physicalPath);
                _logger.LogInformation(
                    "Deleted file: logical={LogicalPath} physical={PhysicalPath}",
                    logicalPath,
                    physicalPath);
            }
        }

        return Task.CompletedTask;
    }

    public Task EnsureCompanyFoldersAsync(CancellationToken cancellationToken = default)
    {
        FileStoragePathHelper.EnsureCompanyFolders(_env.ContentRootPath, _options);
        return Task.CompletedTask;
    }

    private string ResolveWritePath(string logicalPath) =>
        FileStoragePathHelper.ToPhysicalPath(_env.ContentRootPath, _options, logicalPath);

    private IEnumerable<string> ResolveReadPaths(string logicalPath)
    {
        yield return FileStoragePathHelper.ToPhysicalPath(_env.ContentRootPath, _options, logicalPath);
        yield return FileStoragePathHelper.ToIntermediatePhysicalPath(_env.ContentRootPath, _options, logicalPath);
        if (FileStoragePathHelper.ShouldAllowLegacyFallback(_options))
            yield return FileStoragePathHelper.ToLegacyPhysicalPath(_env.ContentRootPath, logicalPath);
    }

    private static string? GuessContentType(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream",
        };
    }
}
