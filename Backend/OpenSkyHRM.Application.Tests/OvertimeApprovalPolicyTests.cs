using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Services;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class OvertimeApprovalPolicyTests
{
    private static readonly Guid Employee = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid Supervisor = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid HrPerson = Guid.Parse("55555555-5555-5555-5555-555555555555");

    private static ReportingGraph Graph()
    {
        var graph = new ReportingGraph();
        graph.ParentsByEmployee[Employee] = [Supervisor];
        graph.ChildrenBySupervisor[Supervisor] = [Employee];
        graph.PrimarySupervisorByEmployee[Employee] = Supervisor;
        return graph;
    }

    private static OvertimeNopayResultDto PendingRow(bool hasSupervisor = true) => new()
    {
        EmployeeId = Employee,
        OvertimeHours = 2,
        PreOtHours = 0,
        PostOtHours = 2,
        HasSupervisor = hasSupervisor,
        SupervisorId = hasSupervisor ? Supervisor : null,
        OtStatus = hasSupervisor ? "PendingApproval" : "SupervisorNotAssigned",
    };

    [Fact]
    public void Supervisor_CanApprove_PendingTeamOt()
    {
        Assert.True(AttendanceService.CanActingEmployeeApproveOt(PendingRow(), Supervisor, Graph()));
    }

    [Fact]
    public void UnrelatedPerson_CannotApprove_WithoutHrOverride()
    {
        Assert.False(AttendanceService.CanActingEmployeeApproveOt(PendingRow(), HrPerson, Graph()));
    }

    [Fact]
    public void HrOverride_CanApprove_WhenSupervisorHasNot()
    {
        Assert.True(AttendanceService.CanActingEmployeeApproveOt(PendingRow(), HrPerson, Graph(), hrCanOverride: true));
    }

    [Fact]
    public void HrOverride_CanApprove_WhenSupervisorNotAssigned()
    {
        Assert.True(AttendanceService.CanActingEmployeeApproveOt(PendingRow(hasSupervisor: false), HrPerson, Graph(), hrCanOverride: true));
    }

    [Fact]
    public void Supervisor_CannotApprove_WhenSupervisorNotAssigned()
    {
        Assert.False(AttendanceService.CanActingEmployeeApproveOt(PendingRow(hasSupervisor: false), Supervisor, Graph()));
    }

    [Fact]
    public void HrOverride_CannotApprove_OwnOvertime()
    {
        var own = PendingRow();
        own.EmployeeId = HrPerson;
        Assert.False(AttendanceService.CanActingEmployeeApproveOt(own, HrPerson, Graph(), hrCanOverride: true));
    }

    [Fact]
    public void HrOverride_CannotApprove_AlreadyApproved()
    {
        var approved = PendingRow();
        approved.OtStatus = "Approved";
        Assert.False(AttendanceService.CanActingEmployeeApproveOt(approved, HrPerson, Graph(), hrCanOverride: true));
    }

    [Fact]
    public void HrOverride_CanReapprove_OutdatedApproved()
    {
        var outdated = PendingRow();
        outdated.OtStatus = "Approved";
        outdated.OvertimeHoursOutdated = true;
        Assert.True(AttendanceService.CanActingEmployeeApproveOt(outdated, HrPerson, Graph(), hrCanOverride: true));
    }

    [Fact]
    public void HrOverride_CanApprove_WithoutLinkedEmployee()
    {
        Assert.True(AttendanceService.CanActingEmployeeApproveOt(PendingRow(), null, Graph(), hrCanOverride: true));
    }
}
