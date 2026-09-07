using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Confirmed APIT year-to-date totals for one employee and one tax year (1 March–end of February).
/// </summary>
public class EmployeeApitYearBalance : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    /// <summary>Calendar year that contains 1 March of this year of assessment (e.g. 2025 = Y/A 2025/26).</summary>
    public int TaxYearStartYear { get; set; }
    public decimal CumulativeTaxable { get; set; }
    public decimal CumulativeApit { get; set; }

    public Employee Employee { get; set; } = null!;
}
