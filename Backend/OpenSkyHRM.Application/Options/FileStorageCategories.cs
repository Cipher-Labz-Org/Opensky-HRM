namespace OpenSkyHRM.Application.Options;

/// <summary>
/// Standard subfolders created under each company (HRM/{company}/...).
/// Logical DB paths stay as /uploads/photos/...; storage maps to these folders.
/// </summary>
public static class FileStorageCategories
{
    public const string Images = "Images";
    public const string Attachments = "Attachments";
    public const string Branding = "Branding";
    public const string Immigration = "Immigration";
    public const string Leave = "Leave";
    public const string LeaveCertificates = "Leave/Certificates";
    public const string Recruitment = "Recruitment";
    public const string RecruitmentCandidates = "Recruitment/Candidates";
    public const string RecruitmentOffers = "Recruitment/Offers";
    public const string RecruitmentRequisitions = "Recruitment/Requisitions";

    /// <summary>All company subfolders ensured on startup (local) and documented for S3 layout.</summary>
    public static readonly string[] CompanySubfolders =
    [
        Images,
        Attachments,
        Branding,
        Immigration,
        LeaveCertificates,
        RecruitmentCandidates,
        RecruitmentOffers,
        RecruitmentRequisitions,
    ];

    /// <summary>Maps legacy logical category segment to the company subfolder path.</summary>
    public static string MapToStorageRelativePath(string relativeAfterUploads)
    {
        var normalized = relativeAfterUploads.Trim().Replace('\\', '/').TrimStart('/');

        if (normalized.StartsWith("photos/", StringComparison.OrdinalIgnoreCase))
            return Images + normalized["photos".Length..];

        if (normalized.StartsWith("attachments/", StringComparison.OrdinalIgnoreCase))
            return Attachments + normalized["attachments".Length..];

        if (normalized.StartsWith("branding/", StringComparison.OrdinalIgnoreCase))
            return Branding + normalized["branding".Length..];

        if (normalized.StartsWith("immigration/", StringComparison.OrdinalIgnoreCase))
            return Immigration + normalized["immigration".Length..];

        if (normalized.StartsWith("leave-certificates/", StringComparison.OrdinalIgnoreCase))
            return LeaveCertificates + normalized["leave-certificates".Length..];

        if (normalized.StartsWith("candidates/", StringComparison.OrdinalIgnoreCase))
            return RecruitmentCandidates + normalized["candidates".Length..];

        if (normalized.StartsWith("offers/", StringComparison.OrdinalIgnoreCase))
            return RecruitmentOffers + normalized["offers".Length..];

        if (normalized.StartsWith("requisitions/", StringComparison.OrdinalIgnoreCase))
            return RecruitmentRequisitions + normalized["requisitions".Length..];

        return normalized;
    }
}
