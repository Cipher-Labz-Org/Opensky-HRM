namespace OpenSkyHRM.Application.Options;

public class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    /// <summary>Local (wwwroot) or S3.</summary>
    public string Provider { get; set; } = "Local";

    public string BucketName { get; set; } = "";

    /// <summary>Top-level S3 prefix, e.g. Files (IAM policy: openskylabz/Files/*).</summary>
    public string KeyPrefix { get; set; } = "Files";

    /// <summary>Main project folder inside the bucket, e.g. HRM.</summary>
    public string RootFolder { get; set; } = "HRM";

    /// <summary>Per-company folder under RootFolder, e.g. mbkh or gamma. Required for S3.</summary>
    public string CompanyFolder { get; set; } = "";

    public string Region { get; set; } = "ap-southeast-1";

    public string? AccessKeyId { get; set; }

    public string? SecretAccessKey { get; set; }

    public bool UseS3 =>
        string.Equals(Provider, "S3", StringComparison.OrdinalIgnoreCase);

    /// <summary>Resolved company segment used in storage paths (defaults to "default" locally).</summary>
    public string ResolvedCompanyFolder =>
        string.IsNullOrWhiteSpace(CompanyFolder) ? "default" : CompanyFolder.Trim();
}
