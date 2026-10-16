using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class EmploymentTypeRulesTests
{
    [Theory]
    [InlineData("Freelance", true)]
    [InlineData("Freelancer", true)]
    [InlineData("freelance", true)]
    [InlineData(" FREELANCER ", true)]
    [InlineData("Free-Lancer", true)]
    [InlineData("FullTimePermanent", false)]
    [InlineData("Fulltime", false)]
    [InlineData(null, false)]
    public void SkipsProvidentFund_recognizes_freelance_variants(string? employmentType, bool expected)
    {
        Assert.Equal(expected, EmploymentTypeRules.SkipsProvidentFund(employmentType));
    }

    [Fact]
    public void SkipsProvidentFund_uses_catalog_codes()
    {
        var rows = new List<(string Code, string Name)>
        {
            ("FL-01", "Freelancer"),
            ("FullTimePermanent", "Full-Time Permanent"),
        };
        var catalog = EmploymentTypeRules.CollectFreelanceEmploymentCodes(rows);

        Assert.True(EmploymentTypeRules.SkipsProvidentFund("FL-01", catalog, rows));
        Assert.True(EmploymentTypeRules.SkipsProvidentFund("Freelancer", catalog, rows));
        Assert.False(EmploymentTypeRules.SkipsProvidentFund("FullTimePermanent", catalog, rows));
    }
}
