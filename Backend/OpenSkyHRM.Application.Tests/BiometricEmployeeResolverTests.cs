using OpenSkyHRM.Application.Services;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class BiometricEmployeeResolverTests
{
    [Fact]
    public void SpreadsheetLookup_PrefersEmployeeCodeSuffixOverAnotherEmployeesFingerprintPin()
    {
        var byCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var byFp = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        BiometricEmployeeResolver.IndexSpreadsheetLookups(byCode, byFp, "EMP-0322", null, "code-holder");
        BiometricEmployeeResolver.IndexSpreadsheetLookups(byCode, byFp, "EMP-0999", "322", "fingerprint-holder");

        Assert.Equal("code-holder", byCode["322"]);
        Assert.False(byFp.ContainsKey("322"));
    }

    [Fact]
    public void SpreadsheetLookup_UsesFingerprintWhenItDoesNotCollideWithACode()
    {
        var byCode = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var byFp = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        BiometricEmployeeResolver.IndexSpreadsheetLookups(byCode, byFp, "EMP-1001", "5544", "pin-holder");

        Assert.Equal("pin-holder", byFp["5544"]);
    }
}
