using OpenSkyHRM.Application.Services;

using OpenSkyHRM.Domain;

using OpenSkyHRM.Domain.Enums;

using Xunit;



namespace OpenSkyHRM.Application.Tests;



public class CasualLeaveNewHireAccrualTests

{

    [Fact]

    public void ShopOfficeCasual_Disabled_JoiningYear_IsZero()

    {

        var join = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join,

            2026,

            asOf,

            CasualLeaveNewHireAccrualSettings.Disabled,

            employmentType: nameof(EmploymentType.FullTimeProbation));

        Assert.Equal(0m, entitled);

    }



    [Fact]

    public void ShopOfficeCasual_Enabled_HalfDayPerCompletedMonthUntilPermanency()

    {

        var join = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc);

        var opts = new CasualLeaveNewHireAccrualOptions(Enabled: true);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join, 2026, asOf, opts, employmentType: nameof(EmploymentType.FullTimeProbation));

        Assert.Equal(2m, entitled);

    }



    [Fact]

    public void ShopOfficeCasual_Enabled_UsesJoinThroughPermanencyNotCalendarCap()

    {

        var join = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var perm = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 9, 30, 0, 0, 0, DateTimeKind.Utc);

        var opts = new CasualLeaveNewHireAccrualOptions(Enabled: true);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join, 2026, asOf, opts, perm, employmentType: nameof(EmploymentType.FullTimeProbation));

        Assert.Equal(4.5m, entitled);

    }



    [Fact]

    public void ShopOfficeCasual_SecondCalendarYear_AlwaysSeven()

    {

        var join = new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join, 2026, asOf, CasualLeaveNewHireAccrualSettings.Disabled);

        Assert.Equal(7m, entitled);

    }



    [Fact]

    public void ShopOfficeCasual_AfterPermanency_ProRatedSevenEvenWhenAccrualDisabled()

    {

        var join = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        var perm = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join, 2026, asOf, CasualLeaveNewHireAccrualSettings.Disabled, perm);

        Assert.Equal(3.5m, entitled);

    }



    [Fact]

    public void ShopOfficeCasual_NoManualPermanency_NoPostPermanencyCasualEvenIfProbationEndSet()

    {

        var join = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        var probationEnd = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join,

            2026,

            asOf,

            CasualLeaveNewHireAccrualSettings.Disabled,

            dateOfPermanency: null,

            probationEndDate: probationEnd,

            employmentType: nameof(EmploymentType.FullTimePermanent));

        Assert.Equal(0m, entitled);

    }



    [Fact]

    public void ShopOfficeCasual_Enabled_StopsHalfDayAccrualAtPermanency()

    {

        var join = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var perm = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc);

        var asOf = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        var opts = new CasualLeaveNewHireAccrualOptions(Enabled: true);

        var entitled = LeaveEntitlementService.CalculateShopOfficeCasual(

            join, 2026, asOf, opts, perm, employmentType: nameof(EmploymentType.FullTimeProbation));

        Assert.Equal(6.75m, entitled);

    }

}

