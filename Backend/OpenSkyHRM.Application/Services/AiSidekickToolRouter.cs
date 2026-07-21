using System.Text.RegularExpressions;

namespace OpenSkyHRM.Application.Services;

public static class AiSidekickToolRouter
{
    private static readonly (Regex Pattern, string ToolName)[] Routes =
    [
        (new Regex(@"\b(employees without supervisors?|without supervisors?|no direct supervisor|missing supervisor|lack(s)? (a )?supervisor|unassigned supervisor|reporting gaps?)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_employees_without_supervisors"),
        (new Regex(@"\b(headcount|how many employees|how many employee|employee count|staff count|workforce size|total number of employees|number of employees|employees in the system|employees by department|distribution by department|department breakdown|employees per department)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_org_headcount"),
        (new Regex(@"\b(birthday|birthdays)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_upcoming_birthdays"),
        (new Regex(@"\b(my leave balance|leave balance|remaining leave|annual leave left)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_my_leave_balance"),
        (new Regex(@"\b(pending approval|approvals pending|leave requests? to approve|need(s)? my approval)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_pending_approvals"),
        (new Regex(@"\b(vacant positions?|unfilled positions?|empty positions?|org structure vacancies|positions without incumbents?)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_vacant_positions"),
        (new Regex(@"\b(recruitment pipeline|open requisitions?|hiring pipeline|job vacancies|hiring vacancies)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_recruitment_pipeline"),
        (new Regex(@"\b(on leave today|who is on leave|employees on leave today|people on leave today|out on leave)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_employees_on_leave_today"),
        (new Regex(@"\b(new hires?|recent hires?|recently joined|joined recently|new joiners?)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_recent_new_hires"),
        (new Regex(@"\b(probation ending|probation end|probation period ending|end of probation)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_upcoming_probation_end"),
        (new Regex(@"\b(payroll batch|payroll status|payroll batches|salary run|pay run status)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_payroll_batch_status"),
        (new Regex(@"\b(onboarding tasks?|pending onboarding|incomplete onboarding)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_pending_onboarding_tasks"),
        (new Regex(@"\b(offboarding|employees leaving|exit process|termination in progress)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_active_offboarding_summary"),
        (new Regex(@"\b(overdue training|training overdue|late training|past due training)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_overdue_training"),
        (new Regex(@"\b(expiring documents?|visa expir|passport expir|license expir|certification expir|document expiry)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_expiring_documents"),
        (new Regex(@"\b(appraisal reviews?|performance reviews?|pending appraisals?|reviews? to complete)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_pending_appraisal_reviews"),
        (new Regex(@"\b(attendance summary|attendance today|who is (in|out|present|absent))\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_attendance_summary"),
        (new Regex(@"\b(team leave|leave requests? for my team)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled), "get_team_leave_requests"),
    ];

    public static string? InferPreferredTool(string? message, IReadOnlyCollection<string> availableToolNames)
    {
        if (string.IsNullOrWhiteSpace(message) || availableToolNames.Count == 0)
            return null;

        foreach (var (pattern, toolName) in Routes)
        {
            if (!availableToolNames.Contains(toolName))
                continue;
            if (pattern.IsMatch(message))
                return toolName;
        }

        return null;
    }
}
