using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services.AiTools;

namespace OpenSkyHRM.Application.Services;

public class AiToolRegistry : IAiToolRegistry
{
    private readonly IEnumerable<IAiTool> _tools;

    public AiToolRegistry(
        ExplainModuleHelpTool explainModuleHelp,
        GetOrgHeadcountTool getOrgHeadcount,
        GetPendingApprovalsTool getPendingApprovals,
        SearchEmployeesTool searchEmployees,
        GetEmployeeSummaryTool getEmployeeSummary,
        GetMyLeaveBalanceTool getMyLeaveBalance,
        GetTeamLeaveRequestsTool getTeamLeaveRequests,
        GetAttendanceSummaryTool getAttendanceSummary,
        GetRecruitmentPipelineTool getRecruitmentPipeline,
        GetUpcomingBirthdaysTool getUpcomingBirthdays,
        GetEmployeesWithoutSupervisorsTool getEmployeesWithoutSupervisors,
        GetRecentNewHiresTool getRecentNewHires,
        GetUpcomingProbationEndTool getUpcomingProbationEnd,
        GetPayrollBatchStatusTool getPayrollBatchStatus,
        GetPendingOnboardingTasksTool getPendingOnboardingTasks,
        GetActiveOffboardingSummaryTool getActiveOffboardingSummary,
        GetVacantPositionsTool getVacantPositions,
        GetEmployeesOnLeaveTodayTool getEmployeesOnLeaveToday,
        GetOverdueTrainingTool getOverdueTraining,
        GetExpiringDocumentsTool getExpiringDocuments,
        GetPendingAppraisalReviewsTool getPendingAppraisalReviews)
    {
        _tools =
        [
            explainModuleHelp,
            getOrgHeadcount,
            getPendingApprovals,
            searchEmployees,
            getEmployeeSummary,
            getMyLeaveBalance,
            getTeamLeaveRequests,
            getAttendanceSummary,
            getRecruitmentPipeline,
            getUpcomingBirthdays,
            getEmployeesWithoutSupervisors,
            getRecentNewHires,
            getUpcomingProbationEnd,
            getPayrollBatchStatus,
            getPendingOnboardingTasks,
            getActiveOffboardingSummary,
            getVacantPositions,
            getEmployeesOnLeaveToday,
            getOverdueTraining,
            getExpiringDocuments,
            getPendingAppraisalReviews,
        ];
    }

    public IReadOnlyList<IAiTool> GetAvailableTools(AiUserContext user)
    {
        var licensed = user.LicensedModules.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return _tools.Where(t => ToolIsAvailable(t, user, licensed)).ToList();
    }

    private static bool ToolIsAvailable(IAiTool tool, AiUserContext user, HashSet<string> licensed)
    {
        if (tool.RequiredModules.Count == 0)
            return true;

        if (tool.RequiredModules.Any(m => licensed.Contains(m)))
        {
            if (tool.RequiredPermissions.Count == 0)
                return true;

            return tool.RequiredPermissions.All(p =>
                user.Permissions.Any(up => string.Equals(up, p, StringComparison.OrdinalIgnoreCase)));
        }

        return false;
    }
}
