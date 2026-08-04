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
    private readonly IAmazonS3 _s3;
    private readonly ILogger<S3FileStorageService> _logger;

    public S3FileStorageService(IOptions<FileStorageOptions> options, ILogger<S3FileStorageService> logger)
    {
        _options = options.Value;
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

        var request = new PutObjectRequest
        {
            BucketName = _options.BucketName,
            Key = key,
            InputStream = memory,
            ContentType = contentType ?? GuessContentType(logicalPath),
        };

        await _s3.PutObjectAsync(request, cancellationToken);
        _logger.LogInformation(
            "Saved file: logical={LogicalPath} s3://{Bucket}/{Key}",
            logicalPath,
            _options.BucketName,
            key);
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
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // try legacy key layout
            }
        }

        return null;
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
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // try legacy key layout
            }
        }

        return false;
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

    public void Dispose() => _s3.Dispose();

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
