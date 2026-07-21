using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Application.Services.AiTools;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class AiToolRegistryTests
{
    private static AiToolRegistry CreateRegistry() =>
        new(
            new ExplainModuleHelpTool(),
            new GetOrgHeadcountTool(null!, new PeopleScopeService(null!)),
            new GetPendingApprovalsTool(new PeopleScopeService(null!)),
            new SearchEmployeesTool(new PeopleScopeService(null!)),
            new GetEmployeeSummaryTool(new PeopleScopeService(null!)),
            new GetMyLeaveBalanceTool(null!),
            new GetTeamLeaveRequestsTool(null!, new PeopleScopeService(null!)),
            new GetAttendanceSummaryTool(null!, new PeopleScopeService(null!)),
            new GetRecruitmentPipelineTool(null!),
            new GetUpcomingBirthdaysTool(new PeopleScopeService(null!)),
            new GetEmployeesWithoutSupervisorsTool(new PeopleScopeService(null!)),
            new GetRecentNewHiresTool(new PeopleScopeService(null!)),
            new GetUpcomingProbationEndTool(new PeopleScopeService(null!)),
            new GetPayrollBatchStatusTool(null!),
            new GetPendingOnboardingTasksTool(new PeopleScopeService(null!)),
            new GetActiveOffboardingSummaryTool(null!, new PeopleScopeService(null!)),
            new GetVacantPositionsTool(),
            new GetEmployeesOnLeaveTodayTool(new PeopleScopeService(null!)),
            new GetOverdueTrainingTool(null!, new PeopleScopeService(null!)),
            new GetExpiringDocumentsTool(new PeopleScopeService(null!)),
            new GetPendingAppraisalReviewsTool(null!));

    [Fact]
    public void GetAvailableTools_Filters_By_Licensed_Module()
    {
        var registry = CreateRegistry();
        var user = new AiUserContext
        {
            LicensedModules = ["Dashboard", "Leave"],
        };

        var tools = registry.GetAvailableTools(user);
        var names = tools.Select(t => t.Name).ToHashSet();

        Assert.Contains("explain_module_help", names);
        Assert.Contains("get_pending_approvals", names);
        Assert.Contains("get_my_leave_balance", names);
        Assert.DoesNotContain("get_recruitment_pipeline", names);
        Assert.DoesNotContain("search_employees", names);
    }

    [Fact]
    public void GetAvailableTools_Includes_People_Tools_When_Licensed()
    {
        var registry = CreateRegistry();
        var user = new AiUserContext { LicensedModules = ["People", "Dashboard"] };

        var names = registry.GetAvailableTools(user).Select(t => t.Name).ToHashSet();

        Assert.Contains("search_employees", names);
        Assert.Contains("get_org_headcount", names);
    }
}

public class PeopleScopeServiceTests
{
    [Fact]
    public void ResolvePeopleScope_Admin_Returns_All()
    {
        var svc = new PeopleScopeService(null!);
        var user = new AiUserContext { Roles = ["ADMIN"] };
        Assert.Equal("All", svc.ResolvePeopleScope(user));
    }

    [Fact]
    public void ResolvePeopleScope_Team_Permission()
    {
        var svc = new PeopleScopeService(null!);
        var user = new AiUserContext
        {
            Permissions = ["People:Read:Team"],
        };
        Assert.Equal("Team", svc.ResolvePeopleScope(user));
    }

    [Fact]
    public void ResolvePeopleScope_None_Without_Permissions()
    {
        var svc = new PeopleScopeService(null!);
        var user = new AiUserContext { Permissions = [] };
        Assert.Equal("None", svc.ResolvePeopleScope(user));
    }
}

public class AiSidekickToolRouterTests
{
    [Fact]
    public void InferPreferredTool_Routes_Headcount_Questions()
    {
        var available = new HashSet<string> { "get_org_headcount", "search_employees" };
        Assert.Equal(
            "get_org_headcount",
            AiSidekickToolRouter.InferPreferredTool("Check employee distribution by department", available));
    }

    [Fact]
    public void InferPreferredTool_Routes_Supervisor_Gap_Questions()
    {
        var available = new HashSet<string> { "get_employees_without_supervisors" };
        Assert.Equal(
            "get_employees_without_supervisors",
            AiSidekickToolRouter.InferPreferredTool("How many employees are without supervisors?", available));
    }

    [Fact]
    public void InferPreferredTool_Routes_New_Hires_And_Leave_Today()
    {
        var available = new HashSet<string>
        {
            "get_recent_new_hires",
            "get_employees_on_leave_today",
            "get_overdue_training",
        };

        Assert.Equal("get_recent_new_hires", AiSidekickToolRouter.InferPreferredTool("Show recent new hires", available));
        Assert.Equal("get_employees_on_leave_today", AiSidekickToolRouter.InferPreferredTool("Who is on leave today?", available));
        Assert.Equal("get_overdue_training", AiSidekickToolRouter.InferPreferredTool("Any overdue training?", available));
    }
}

public class OpenAiSidekickSettingsTests
{
    [Fact]
    public async Task IsSidekickEnabledAsync_Returns_True_When_Configured_Even_If_Recruitment_Disabled()
    {
        var settings = new FakeSystemSettingService(new Dictionary<string, string>
        {
            [OpenAiSettingsResolver.EnabledSetting] = "false",
            [OpenAiSettingsResolver.SidekickEnabledSetting] = "true",
            [OpenAiSettingsResolver.ApiKeySetting] = "sk-test",
        });
        var config = new ConfigurationBuilder().Build();
        var resolver = new OpenAiSettingsResolver(config, settings);
        Assert.True(await resolver.IsSidekickEnabledAsync());
    }

    [Fact]
    public async Task IsSidekickEnabledAsync_Returns_False_When_Sidekick_Toggle_Off()
    {
        var settings = new FakeSystemSettingService(new Dictionary<string, string>
        {
            [OpenAiSettingsResolver.EnabledSetting] = "true",
            [OpenAiSettingsResolver.SidekickEnabledSetting] = "false",
            [OpenAiSettingsResolver.ApiKeySetting] = "sk-test",
        });
        var config = new ConfigurationBuilder().Build();
        var resolver = new OpenAiSettingsResolver(config, settings);
        Assert.False(await resolver.IsSidekickEnabledAsync());
    }

    private sealed class FakeSystemSettingService : ISystemSettingService
    {
        private readonly Dictionary<string, string> _values;
        public FakeSystemSettingService(Dictionary<string, string> values) => _values = values;
        public Task<string?> GetAsync(string key) => Task.FromResult(_values.TryGetValue(key, out var v) ? v : null);
        public Task SetAsync(string key, string value) { _values[key] = value; return Task.CompletedTask; }
        public Task<Dictionary<string, string>> GetAllAsync() => Task.FromResult(_values);
        public Task<string> GenerateNextEmployeeCodeAsync() => Task.FromResult("EMP-001");
    }
}
