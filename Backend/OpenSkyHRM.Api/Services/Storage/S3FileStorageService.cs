using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Options;

namespace OpenSkyHRM.Api.Services.Storage;

public sealed class S3FileStorageService : IFileStorageService, IDisposable
{
    private readonly FileStorageOptions _options;
    private readonly IWebHostEnvironment _env;
    private readonly IAmazonS3 _s3;
    private readonly ILogger<S3FileStorageService> _logger;

    public S3FileStorageService(
        IOptions<FileStorageOptions> options,
        IWebHostEnvironment env,
        ILogger<S3FileStorageService> logger)
    {
        _options = options.Value;
        _env = env;
        _logger = logger;

        if (string.IsNullOrWhiteSpace(_options.BucketName))
            throw new InvalidOperationException("FileStorage:BucketName is required when Provider is S3.");

        if (string.IsNullOrWhiteSpace(_options.CompanyFolder))
            throw new InvalidOperationException(
                "FileStorage:CompanyFolder is required when Provider is S3 (e.g. mbkh, gamma, opensky).");

        var region = RegionEndpoint.GetBySystemName(_options.Region);
        if (!string.IsNullOrWhiteSpace(_options.AccessKeyId) && !string.IsNullOrWhiteSpace(_options.SecretAccessKey))
        {
            _s3 = new AmazonS3Client(_options.AccessKeyId, _options.SecretAccessKey, region);
        }
        else
        {
            _s3 = new AmazonS3Client(region);
        }

        _logger.LogInformation(
            "S3 file storage enabled: s3://{Bucket}/{Prefix}/{Root}/{Company}/",
            _options.BucketName,
            FileStoragePathHelper.SanitizeSegment(_options.KeyPrefix),
            FileStoragePathHelper.SanitizeSegment(_options.RootFolder),
            FileStoragePathHelper.SanitizeSegment(_options.ResolvedCompanyFolder));
    }

    public bool UsesRemoteStorage => true;

    public string BuildLogicalPath(string category, string fileName) =>
        FileStoragePathHelper.BuildLogicalPath(category, fileName);

    public async Task SaveAsync(
        string logicalPath,
        Stream content,
        string? contentType = null,
        CancellationToken cancellationToken = default)
    {
        var key = FileStoragePathHelper.ToObjectKey(_options, logicalPath);
        using var memory = new MemoryStream();
        await content.CopyToAsync(memory, cancellationToken);
        memory.Position = 0;

        try
        {
            var request = new PutObjectRequest
            {
                BucketName = _options.BucketName,
                Key = key,
                InputStream = memory,
                ContentType = contentType ?? GuessContentType(logicalPath),
                AutoCloseStream = false,
            };
            request.Headers.ContentLength = memory.Length;
            await _s3.PutObjectAsync(request, cancellationToken);
            _logger.LogInformation(
                "Saved file: logical={LogicalPath} s3://{Bucket}/{Key}",
                logicalPath,
                _options.BucketName,
                key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "S3 put failed for s3://{Bucket}/{Key}; saving on this server instead.",
                _options.BucketName,
                key);
            memory.Position = 0;
            await SaveLocalAsync(logicalPath, memory, cancellationToken);
        }
    }

    public async Task<StoredFileReadResult?> OpenReadAsync(
        string logicalPath,
        CancellationToken cancellationToken = default)
    {
        foreach (var key in ResolveReadKeys(logicalPath))
        {
            try
            {
                var response = await _s3.GetObjectAsync(_options.BucketName, key, cancellationToken);
                _logger.LogInformation(
                    "Opened file: logical={LogicalPath} s3://{Bucket}/{Key}",
                    logicalPath,
                    _options.BucketName,
                    key);
                return new StoredFileReadResult
                {
                    Stream = response.ResponseStream,
                    ContentType = response.Headers.ContentType ?? GuessContentType(logicalPath),
                };
            }
            catch (AmazonS3Exception ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.NotFound
                || ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                // try next key / local disk
            }
        }

        return OpenLocalRead(logicalPath);
    }

    public async Task<bool> ExistsAsync(string logicalPath, CancellationToken cancellationToken = default)
    {
        foreach (var key in ResolveReadKeys(logicalPath))
        {
            try
            {
                await _s3.GetObjectMetadataAsync(_options.BucketName, key, cancellationToken);
                return true;
            }
            catch (AmazonS3Exception ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.NotFound
                || ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                // try next key / local disk
            }
        }

        return LocalReadPaths(logicalPath).Any(File.Exists);
    }

    public async Task DeleteAsync(string logicalPath, CancellationToken cancellationToken = default)
    {
        foreach (var key in ResolveReadKeys(logicalPath))
        {
            try
            {
                await _s3.DeleteObjectAsync(_options.BucketName, key, cancellationToken);
                _logger.LogInformation("Deleted s3://{Bucket}/{Key}", _options.BucketName, key);
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // already gone
            }
        }
    }

    public async Task EnsureCompanyFoldersAsync(CancellationToken cancellationToken = default)
    {
        var folderKeys = new List<string> { FileStoragePathHelper.BuildCompanyFolderKey(_options, string.Empty) };
        foreach (var subfolder in FileStorageCategories.CompanySubfolders)
            folderKeys.Add(FileStoragePathHelper.BuildCompanyFolderKey(_options, subfolder));

        var created = 0;
        foreach (var folderKey in folderKeys)
        {
            try
            {
                if (await S3FolderExistsAsync(folderKey, cancellationToken))
                    continue;

                await _s3.PutObjectAsync(new PutObjectRequest
                {
                    BucketName = _options.BucketName,
                    Key = folderKey,
                    ContentBody = string.Empty,
                    ContentType = "application/x-directory",
                }, cancellationToken);
                created++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Could not ensure S3 folder s3://{Bucket}/{Key}.",
                    _options.BucketName,
                    folderKey);
            }
        }

        _logger.LogInformation(
            "Ensured company folders for '{Company}' in s3://{Bucket}/ ({Created} created, {Total} total).",
            _options.ResolvedCompanyFolder,
            _options.BucketName,
            created,
            folderKeys.Count);
    }

    private async Task<bool> S3FolderExistsAsync(string folderKey, CancellationToken cancellationToken)
    {
        // A folder "exists" if its marker object is present or any object lives under the prefix.
        try
        {
            var listing = await _s3.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = _options.BucketName,
                Prefix = folderKey,
                MaxKeys = 1,
            }, cancellationToken);
            return listing.S3Objects is { Count: > 0 };
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    /// <summary>Write, read back and delete a probe object directly in S3 (no local fallback).</summary>
    public async Task<S3ProbeResult> ProbeAsync(CancellationToken cancellationToken = default)
    {
        var key = FileStoragePathHelper.ToObjectKey(
            _options,
            FileStoragePathHelper.BuildLogicalPath("storage-probe", $"probe_{Guid.NewGuid():N}.txt"));
        var payload = $"OpenSky HRM S3 probe {DateTime.UtcNow:O}";
        var result = new S3ProbeResult { Bucket = _options.BucketName, Region = _options.Region, Key = key };
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        async Task<bool> Step(string name, Func<Task> action)
        {
            var started = stopwatch.ElapsedMilliseconds;
            try
            {
                await action();
                result.Steps.Add(new S3ProbeStep(name, true, stopwatch.ElapsedMilliseconds - started, null, null));
                return true;
            }
            catch (AmazonS3Exception ex)
            {
                result.Steps.Add(new S3ProbeStep(
                    name, false, stopwatch.ElapsedMilliseconds - started,
                    $"{(int)ex.StatusCode} {ex.ErrorCode}", ex.Message));
                return false;
            }
            catch (Exception ex)
            {
                result.Steps.Add(new S3ProbeStep(
                    name, false, stopwatch.ElapsedMilliseconds - started, ex.GetType().Name, ex.Message));
                return false;
            }
        }

        var written = await Step("write", () => _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _options.BucketName,
            Key = key,
            ContentBody = payload,
            ContentType = "text/plain",
        }, cancellationToken));

        if (written)
        {
            await Step("read", async () =>
            {
                using var response = await _s3.GetObjectAsync(_options.BucketName, key, cancellationToken);
                using var reader = new StreamReader(response.ResponseStream);
                var body = await reader.ReadToEndAsync(cancellationToken);
                if (!string.Equals(body, payload, StringComparison.Ordinal))
                    throw new InvalidOperationException("Read-back content did not match what was written.");
            });
            await Step("delete", () => _s3.DeleteObjectAsync(_options.BucketName, key, cancellationToken));
        }

        result.Ok = result.Steps.Count == 3 && result.Steps.All(s => s.Ok);
        return result;
    }

    public void Dispose() => _s3.Dispose();

    private async Task SaveLocalAsync(string logicalPath, Stream content, CancellationToken cancellationToken)
    {
        var physicalPath = FileStoragePathHelper.ToPhysicalPath(_env.ContentRootPath, _options, logicalPath);
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
            "Saved file locally after S3 failure: logical={LogicalPath} physical={PhysicalPath}",
            logicalPath,
            physicalPath);
    }

    private StoredFileReadResult? OpenLocalRead(string logicalPath)
    {
        foreach (var physicalPath in LocalReadPaths(logicalPath))
        {
            if (!File.Exists(physicalPath)) continue;
            Stream stream = new FileStream(
                physicalPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 81920,
                useAsync: true);
            return new StoredFileReadResult
            {
                Stream = stream,
                ContentType = GuessContentType(logicalPath),
            };
        }

        return null;
    }

    private IEnumerable<string> LocalReadPaths(string logicalPath)
    {
        yield return FileStoragePathHelper.ToPhysicalPath(_env.ContentRootPath, _options, logicalPath);
        yield return FileStoragePathHelper.ToIntermediatePhysicalPath(_env.ContentRootPath, _options, logicalPath);
        if (FileStoragePathHelper.ShouldAllowLegacyFallback(_options))
            yield return FileStoragePathHelper.ToLegacyPhysicalPath(_env.ContentRootPath, logicalPath);
    }

    private IEnumerable<string> ResolveReadKeys(string logicalPath)
    {
        yield return FileStoragePathHelper.ToObjectKey(_options, logicalPath);
        yield return FileStoragePathHelper.ToIntermediateObjectKey(_options, logicalPath);
        if (FileStoragePathHelper.ShouldAllowLegacyFallback(_options))
            yield return FileStoragePathHelper.ToLegacyObjectKey(_options, logicalPath);
    }

    private static string GuessContentType(string logicalPath)
    {
        var ext = Path.GetExtension(logicalPath).ToLowerInvariant();
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

public sealed record S3ProbeStep(string Step, bool Ok, long ElapsedMs, string? ErrorCode, string? Error);

public sealed class S3ProbeResult
{
    public bool Ok { get; set; }
    public string Bucket { get; set; } = "";
    public string Region { get; set; } = "";
    public string Key { get; set; } = "";
    public List<S3ProbeStep> Steps { get; } = new();
}
