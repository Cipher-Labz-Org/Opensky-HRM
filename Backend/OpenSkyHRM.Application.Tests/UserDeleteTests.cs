using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class UserDeleteTests
{
    [Fact]
    public void ArchiveUsername_AppendsUserIdSuffix()
    {
        var id = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        var archived = UserUniqueness.ArchiveUsername(id, "testone");
        Assert.Contains(".archived.", archived, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("testone", archived, StringComparison.OrdinalIgnoreCase);
        Assert.True(archived.Length <= 100);
    }

    [Fact]
    public void ArchiveEmail_KeepsNonEmptyValue()
    {
        var id = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        var archived = UserUniqueness.ArchiveEmail(id, "testone@example.com");
        Assert.Contains("@", archived);
        Assert.True(archived.Length <= 255);
    }
}
