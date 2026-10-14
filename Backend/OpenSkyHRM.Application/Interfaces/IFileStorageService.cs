namespace OpenSkyHRM.Application.Interfaces;

public interface IFileStorageService
{
    /// <summary>Whether files are stored in Amazon S3 (vs local wwwroot).</summary>
    bool UsesRemoteStorage { get; }

    /// <summary>Build a logical web path stored in the database, e.g. /uploads/photos/file.jpg.</summary>
    string BuildLogicalPath(string category, string fileName);

    Task SaveAsync(
        string logicalPath,
        Stream content,
        string? contentType = null,
        CancellationToken cancellationToken = default);

    Task<StoredFileReadResult?> OpenReadAsync(
        string logicalPath,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(string logicalPath, CancellationToken cancellationToken = default);

    Task DeleteAsync(string logicalPath, CancellationToken cancellationToken = default);

    /// <summary>
    /// Create this company's standard subfolders (Images, Branding, …) in the backing store.
    /// Idempotent and safe to call on every startup.
    /// </summary>
    Task EnsureCompanyFoldersAsync(CancellationToken cancellationToken = default);
}

public sealed class StoredFileReadResult : IAsyncDisposable
{
    public required Stream Stream { get; init; }
    public string? ContentType { get; init; }

    public ValueTask DisposeAsync()
    {
        Stream.Dispose();
        return ValueTask.CompletedTask;
    }
}
