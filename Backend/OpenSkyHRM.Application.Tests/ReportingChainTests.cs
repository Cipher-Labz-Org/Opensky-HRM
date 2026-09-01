using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class ReportingChainTests
{
    private static readonly Guid Head = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Supervisor = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Employee = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid Other = Guid.Parse("44444444-4444-4444-4444-444444444444");

    private static Dictionary<Guid, Guid> Chain() => new()
    {
        [Employee] = Supervisor,
        [Supervisor] = Head,
    };

    [Fact]
    public void DirectSupervisor_IsInChain()
    {
        Assert.True(ReportingChain.IsInSupervisorChain(Chain(), Employee, Supervisor));
    }

    [Fact]
    public void SupervisorsSupervisor_IsInChain()
    {
        Assert.True(ReportingChain.IsInSupervisorChain(Chain(), Employee, Head));
    }

    [Fact]
    public void UnrelatedPerson_IsNotInChain()
    {
        Assert.False(ReportingChain.IsInSupervisorChain(Chain(), Employee, Other));
    }

    [Fact]
    public void Employee_CannotApproveOwnOvertime()
    {
        Assert.False(ReportingChain.IsInSupervisorChain(Chain(), Employee, Employee));
    }

    [Fact]
    public void Cycle_DoesNotLoopForever()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var map = new Dictionary<Guid, Guid> { [a] = b, [b] = a };
        Assert.False(ReportingChain.IsInSupervisorChain(map, a, Guid.NewGuid()));
    }

    [Fact]
    public void Descendants_IncludeSkipLevelReports()
    {
        var ids = ReportingChain.GetDescendantIds(Chain(), Head);
        Assert.Contains(Supervisor, ids);
        Assert.Contains(Employee, ids);
        Assert.DoesNotContain(Head, ids);
        Assert.DoesNotContain(Other, ids);
    }

    [Fact]
    public void DirectSupervisor_Descendants_AreImmediateReportsOnly()
    {
        var ids = ReportingChain.GetDescendantIds(Chain(), Supervisor);
        Assert.Contains(Employee, ids);
        Assert.DoesNotContain(Head, ids);
        Assert.DoesNotContain(Supervisor, ids);
    }

    [Fact]
    public void IndirectReport_IsIncludedInDescendants()
    {
        var graph = new ReportingGraph();
        graph.ParentsByEmployee[Employee] = [Supervisor];
        graph.ChildrenBySupervisor[Supervisor] = [Employee];
        graph.ParentsByEmployee[Supervisor] = [Head];
        graph.ChildrenBySupervisor[Head] = [Supervisor];

        Assert.True(ReportingChain.IsInSupervisorChain(graph, Employee, Head));
        Assert.Contains(Employee, ReportingChain.GetDescendantIds(graph, Head));
        Assert.Contains(Employee, ReportingChain.GetDescendantIds(graph, Supervisor));
    }
}
