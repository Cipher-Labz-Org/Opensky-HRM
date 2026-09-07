using OpenSkyHRM.Application.Services;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class EmployeeCodeSortTests
{
    [Fact]
    public void Compare_Puts988Before1127()
    {
        Assert.True(EmployeeCodeSort.Compare("988", "1127") < 0);
        Assert.True(EmployeeCodeSort.Compare("1127", "988") > 0);
    }

    [Fact]
    public void NumericKey_ParsesPlainAndPrefixedCodes()
    {
        Assert.Equal(988, EmployeeCodeSort.NumericKey("988"));
        Assert.Equal(1127, EmployeeCodeSort.NumericKey("1127"));
        Assert.Equal(22, EmployeeCodeSort.NumericKey("EMP-000022"));
    }
}
