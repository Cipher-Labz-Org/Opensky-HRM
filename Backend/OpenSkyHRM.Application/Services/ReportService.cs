using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Reports;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;
    public ReportService(AppDbContext db) { _db = db; }

    public List<ReportCategoryDto> GetReportCatalog()
    {
        var catalog = new List<ReportCategoryDto>
        {
            new()
            {
                Key = "people", Name = "People & Employee", Icon = "users",
                Reports = new()
                {
                    new() { Key = "employee-master", Name = "Employee Master List", Description = "Complete employee directory with personal, job, and contact details" },
                    new() { Key = "employee-by-department", Name = "Employees by Department", Description = "Headcount breakdown by department" },
                    new() { Key = "employee-by-status", Name = "Employees by Status", Description = "Employee count grouped by employment status" },
                    new() { Key = "employee-by-location", Name = "Employees by Location", Description = "Headcount distribution across locations" },
                    new() { Key = "employee-by-grade", Name = "Employees by Grade", Description = "Employee distribution across pay grades" },
                    new() { Key = "new-joiners", Name = "New Joiners", Description = "Employees who joined within a date range" },
                    new() { Key = "terminations", Name = "Terminations / Separations", Description = "Terminated employees with reason and date" },
                    new() { Key = "birthday-list", Name = "Birthday List", Description = "Employee birthday calendar for the current month or selected month" },
                    new() { Key = "work-anniversary", Name = "Work Anniversary", Description = "Employee service anniversaries for the current month" },
                    new() { Key = "probation-due", Name = "Probation End Due", Description = "Employees whose probation is ending soon" },
                    new() { Key = "headcount-summary", Name = "Headcount Summary", Description = "Overall headcount statistics across departments and business units" },
                    new() { Key = "attachments", Name = "Employee Attachments", Description = "Attachment records by employee, type, upload date, and expiry" },
                }
            },
            new()
            {
                Key = "leave", Name = "Leave & Absence", Icon = "calendar",
                Reports = new()
                {
                    new() { Key = "leave-balance", Name = "Leave Balance Summary", Description = "Current leave balances for all employees by leave type" },
                    new() { Key = "leave-utilization", Name = "Leave Utilization", Description = "Leave days taken vs entitlement for each employee" },
                    new() { Key = "leave-requests", Name = "Leave Requests History", Description = "All leave requests with status and approval details" },
                    new() { Key = "absence-frequency", Name = "Absence Frequency", Description = "Employees ranked by number of leave instances" },
                    new() { Key = "leave-by-type", Name = "Leave by Type", Description = "Leave days taken grouped by leave type" },
                    new() { Key = "pending-approvals", Name = "Pending Leave Approvals", Description = "Leave requests awaiting supervisor approval" },
                }
            },
            new()
            {
                Key = "attendance", Name = "Time & Attendance", Icon = "clock",
                Reports = new()
                {
                    new() { Key = "daily-attendance", Name = "Attendance Register", Description = "Punch-in/out times for a selected date range" },
                    new() { Key = "monthly-attendance", Name = "Monthly Attendance Summary", Description = "Monthly attendance statistics per employee" },
                    new() { Key = "late-arrivals", Name = "Late Arrivals", Description = "Employees who arrived after the scheduled start time" },
                    new() { Key = "early-departures", Name = "Early Departures", Description = "Employees who left before the scheduled end time" },
                    new() { Key = "overtime-report", Name = "Overtime Report", Description = "Overtime hours worked by each employee" },
                    new() { Key = "absent-report", Name = "Absent / No-Punch Report", Description = "Days with no attendance record for active employees" },
                }
            },
            new()
            {
                Key = "payroll", Name = "Payroll & Compensation", Icon = "banknotes",
                Reports = new()
                {
                    new() { Key = "payroll-register", Name = "Payroll Register", Description = "Monthly payroll summary by employee with gross, deductions, net" },
                    new() { Key = "salary-register", Name = "Salary Register", Description = "Current salary details for all active employees" },
                    new() { Key = "salary-revision-history", Name = "Salary Revision History", Description = "Historical salary changes with effective dates" },
                    new() { Key = "department-cost", Name = "Department Payroll Cost", Description = "Total payroll cost broken down by department" },
                    new() { Key = "bank-transfer-list", Name = "Bank Transfer List", Description = "Bank account details for salary transfers" },
                }
            },
            new()
            {
                Key = "recruitment", Name = "Recruitment", Icon = "briefcase",
                Reports = new()
                {
                    new() { Key = "open-requisitions", Name = "Open Requisitions", Description = "Active job requisitions with vacancy counts and status" },
                    new() { Key = "candidate-pipeline", Name = "Candidate Pipeline", Description = "Candidates by stage across all requisitions" },
                    new() { Key = "time-to-fill", Name = "Time to Fill", Description = "Average days to fill positions by department" },
                    new() { Key = "recruitment-summary", Name = "Recruitment Summary", Description = "Overview of all requisitions, candidates, and offers" },
                }
            },
            new()
            {
                Key = "performance", Name = "Performance", Icon = "chart-bar",
                Reports = new()
                {
                    new() { Key = "goal-status", Name = "Goal Status", Description = "Employee goals with current status and progress" },
                    new() { Key = "review-completion", Name = "Review Completion", Description = "Performance review completion status by cycle" },
                    new() { Key = "rating-distribution", Name = "Rating Distribution", Description = "Performance rating distribution across the organization" },
                }
            },
            new()
            {
                Key = "organization", Name = "Organization", Icon = "building",
                Reports = new()
                {
                    new() { Key = "department-directory", Name = "Department Directory", Description = "All departments with employee counts and hierarchy" },
                    new() { Key = "reporting-structure", Name = "Reporting Structure", Description = "Supervisor-subordinate relationships across the organization" },
                    new() { Key = "position-vacancy", Name = "Position & Vacancy", Description = "All positions with occupancy status" },
                    new() { Key = "shift-roster", Name = "Shift & Roster Assignment", Description = "Current shift patterns and roster assignments" },
                }
            },
            new()
            {
                Key = "compliance", Name = "Compliance & Documents", Icon = "shield",
                Reports = new()
                {
                    new() { Key = "document-expiry", Name = "Document Expiry Tracker", Description = "Employee documents approaching or past expiry date" },
                    new() { Key = "immigration-status", Name = "Immigration / Visa Status", Description = "Visa and work permit details with expiry dates" },
                    new() { Key = "emergency-contacts", Name = "Emergency Contacts", Description = "Emergency contact details for all employees" },
                    new() { Key = "onboarding-status", Name = "Onboarding Status", Description = "Active onboarding tasks progress by employee" },
                    new() { Key = "offboarding-status", Name = "Offboarding Status", Description = "Active offboarding tasks progress by employee" },
                }
            },
        };

        TagReportFilterMetadata(catalog);
        return catalog;
    }

    /// <summary>Annotates catalog entries so the UI can show department and period controls only where applicable.</summary>
    private static void TagReportFilterMetadata(List<ReportCategoryDto> catalog)
    {
        void Tag(string categoryKey, string reportKey, bool department, string periodMode)
        {
            var cat = catalog.FirstOrDefault(c => c.Key == categoryKey);
            var rpt = cat?.Reports.FirstOrDefault(r => r.Key == reportKey);
            if (rpt is null) return;
            rpt.SupportsDepartmentFilter = department;
            rpt.PeriodFilterMode = periodMode;
        }

        Tag("people", "employee-master", true, "none");
        Tag("people", "employee-by-department", true, "none");
        Tag("people", "employee-by-status", true, "none");
        Tag("people", "employee-by-location", true, "none");
        Tag("people", "employee-by-grade", true, "none");
        Tag("people", "new-joiners", true, "dateRange");
        Tag("people", "terminations", true, "dateRange");
        Tag("people", "birthday-list", true, "monthOnly");
        Tag("people", "work-anniversary", true, "monthOnly");
        Tag("people", "probation-due", true, "dateRange");
        Tag("people", "headcount-summary", true, "none");
        Tag("people", "attachments", true, "dateRange");

        Tag("leave", "leave-balance", true, "none");
        Tag("leave", "leave-utilization", true, "none");
        Tag("leave", "leave-requests", true, "dateRange");
        Tag("leave", "absence-frequency", true, "dateRange");
        Tag("leave", "leave-by-type", true, "dateRange");
        Tag("leave", "pending-approvals", true, "none");

        Tag("attendance", "daily-attendance", true, "dateRange");
        Tag("attendance", "monthly-attendance", true, "yearMonth");
        Tag("attendance", "late-arrivals", true, "dateRange");
        Tag("attendance", "early-departures", true, "dateRange");
        Tag("attendance", "overtime-report", true, "yearMonth");
        Tag("attendance", "absent-report", true, "singleDate");

        Tag("payroll", "payroll-register", true, "yearMonth");
        Tag("payroll", "salary-register", true, "none");
        Tag("payroll", "salary-revision-history", true, "dateRange");
        Tag("payroll", "department-cost", true, "none");
        Tag("payroll", "bank-transfer-list", true, "none");

        Tag("recruitment", "open-requisitions", true, "dateRange");
        Tag("recruitment", "candidate-pipeline", true, "none");
        Tag("recruitment", "time-to-fill", true, "dateRange");
        Tag("recruitment", "recruitment-summary", false, "dateRange");

        Tag("performance", "goal-status", true, "dateRange");
        Tag("performance", "review-completion", true, "dateRange");
        Tag("performance", "rating-distribution", true, "none");

        Tag("organization", "department-directory", false, "none");
        Tag("organization", "reporting-structure", true, "none");
        Tag("organization", "position-vacancy", true, "none");
        Tag("organization", "shift-roster", true, "dateRange");

        Tag("compliance", "document-expiry", true, "dateRange");
        Tag("compliance", "immigration-status", true, "none");
        Tag("compliance", "emergency-contacts", true, "none");
        Tag("compliance", "onboarding-status", true, "none");
        Tag("compliance", "offboarding-status", true, "none");
    }

    public async Task<ReportResultDto> RunReportAsync(string category, string reportKey, Dictionary<string, string>? filters = null)
    {
        var fullKey = $"{category}/{reportKey}";
        return fullKey switch
        {
            "people/employee-master" => await EmployeeMasterReport(filters),
            "people/employee-by-department" => await EmployeeByDepartmentReport(filters),
            "people/employee-by-status" => await EmployeeByStatusReport(filters),
            "people/employee-by-location" => await EmployeeByLocationReport(filters),
            "people/employee-by-grade" => await EmployeeByGradeReport(filters),
            "people/new-joiners" => await NewJoinersReport(filters),
            "people/terminations" => await TerminationsReport(filters),
            "people/birthday-list" => await BirthdayListReport(filters),
            "people/work-anniversary" => await WorkAnniversaryReport(filters),
            "people/probation-due" => await ProbationDueReport(filters),
            "people/headcount-summary" => await HeadcountSummaryReport(filters),
            "people/attachments" => await EmployeeAttachmentsReport(filters),

            "leave/leave-balance" => await LeaveBalanceSummaryReport(filters),
            "leave/leave-utilization" => await LeaveUtilizationReport(filters),
            "leave/leave-requests" => await LeaveRequestsReport(filters),
            "leave/absence-frequency" => await AbsenceFrequencyReport(filters),
            "leave/leave-by-type" => await LeaveByTypeReport(filters),
            "leave/pending-approvals" => await PendingApprovalsReport(filters),

            "attendance/daily-attendance" => await DailyAttendanceReport(filters),
            "attendance/monthly-attendance" => await MonthlyAttendanceReport(filters),
            "attendance/late-arrivals" => await LateArrivalsReport(filters),
            "attendance/early-departures" => await EarlyDeparturesReport(filters),
            "attendance/overtime-report" => await OvertimeReport(filters),
            "attendance/absent-report" => await AbsentReport(filters),

            "payroll/payroll-register" => await PayrollRegisterReport(filters),
            "payroll/salary-register" => await SalaryRegisterReport(filters),
            "payroll/salary-revision-history" => await SalaryRevisionHistoryReport(filters),
            "payroll/department-cost" => await DepartmentCostReport(filters),
            "payroll/bank-transfer-list" => await BankTransferListReport(filters),

            "recruitment/open-requisitions" => await OpenRequisitionsReport(filters),
            "recruitment/candidate-pipeline" => await CandidatePipelineReport(filters),
            "recruitment/time-to-fill" => await TimeToFillReport(filters),
            "recruitment/recruitment-summary" => await RecruitmentSummaryReport(filters),

            "performance/goal-status" => await GoalStatusReport(filters),
            "performance/review-completion" => await ReviewCompletionReport(filters),
            "performance/rating-distribution" => await RatingDistributionReport(filters),

            "organization/department-directory" => await DepartmentDirectoryReport(),
            "organization/reporting-structure" => await ReportingStructureReport(filters),
            "organization/position-vacancy" => await PositionVacancyReport(filters),
            "organization/shift-roster" => await ShiftRosterReport(filters),

            "compliance/document-expiry" => await DocumentExpiryReport(filters),
            "compliance/immigration-status" => await ImmigrationStatusReport(filters),
            "compliance/emergency-contacts" => await EmergencyContactsReport(filters),
            "compliance/onboarding-status" => await OnboardingStatusReport(filters),
            "compliance/offboarding-status" => await OffboardingStatusReport(filters),

            _ => new ReportResultDto { ReportName = "Unknown Report", GeneratedAt = DateTime.UtcNow.ToString("o"), Columns = new(), Rows = new() }
        };
    }

    private ReportResultDto Build(string name, List<string> cols, List<Dictionary<string, object?>> rows) => new()
    {
        ReportName = name,
        GeneratedAt = DateTime.UtcNow.ToString("o"),
        Columns = cols,
        Rows = rows,
        TotalRows = rows.Count
    };

    private static bool TryGetDepartmentId(Dictionary<string, string>? filters, out Guid departmentId)
    {
        departmentId = default;
        return filters != null
            && filters.TryGetValue("departmentId", out var s)
            && !string.IsNullOrWhiteSpace(s)
            && Guid.TryParse(s, out departmentId);
    }

    // ========== PEOPLE ==========

    private async Task<ReportResultDto> EmployeeMasterReport(Dictionary<string, string>? filters)
    {
        var q = _db.Employees.Include(e => e.Department).Include(e => e.JobTitle)
            .Include(e => e.Location).Include(e => e.Grade).Include(e => e.BusinessUnit).AsQueryable();
        if (filters != null && filters.TryGetValue("status", out var st) && !string.IsNullOrWhiteSpace(st))
            q = q.Where(e => e.Status == st);
        else
            q = q.Where(e => e.Status != "Terminated");
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);

        var data = await q.OrderBy(e => e.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Full Name", "Email", "Phone", "Department", "Job Title", "Location", "Grade", "Business Unit", "Status", "Join Date", "Gender" };
        var rows = data.Select(e => new Dictionary<string, object?>
        {
            ["Employee Code"] = e.EmployeeCode, ["Full Name"] = e.FullName, ["Email"] = e.Email,
            ["Phone"] = e.Phone, ["Department"] = e.Department?.Name, ["Job Title"] = e.JobTitle?.Title,
            ["Location"] = e.Location?.Name, ["Grade"] = e.Grade?.Name, ["Business Unit"] = e.BusinessUnit?.Name,
            ["Status"] = e.Status, ["Join Date"] = e.JoinDate.ToString("yyyy-MM-dd"), ["Gender"] = e.Gender.ToString(),
        }).ToList();
        return Build("Employee Master List", cols, rows);
    }

    private async Task<ReportResultDto> EmployeeByDepartmentReport(Dictionary<string, string>? filters)
    {
        var q = _db.Employees.Where(e => e.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.Include(e => e.Department)
            .GroupBy(e => e.Department!.Name ?? "Unassigned")
            .Select(g => new { Department = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).ToListAsync();
        var cols = new List<string> { "Department", "Headcount" };
        var rows = data.Select(d => new Dictionary<string, object?> { ["Department"] = d.Department, ["Headcount"] = d.Count }).ToList();
        return Build("Employees by Department", cols, rows);
    }

    private async Task<ReportResultDto> EmployeeByStatusReport(Dictionary<string, string>? filters)
    {
        var q = _db.Employees.AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q
            .GroupBy(e => e.EmploymentType)
            .Select(g => new { EmploymentType = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).ToListAsync();
        var cols = new List<string> { "Employment Status", "Headcount" };
        var rows = data.Select(d => new Dictionary<string, object?> { ["Employment Status"] = d.EmploymentType, ["Headcount"] = d.Count }).ToList();
        return Build("Employees by Status", cols, rows);
    }

    private async Task<ReportResultDto> EmployeeByLocationReport(Dictionary<string, string>? filters)
    {
        var q = _db.Employees.Where(e => e.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.Include(e => e.Location)
            .GroupBy(e => e.Location != null ? e.Location.Name : "Unassigned")
            .Select(g => new { Location = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).ToListAsync();
        var cols = new List<string> { "Location", "Headcount" };
        var rows = data.Select(d => new Dictionary<string, object?> { ["Location"] = d.Location, ["Headcount"] = d.Count }).ToList();
        return Build("Employees by Location", cols, rows);
    }

    private async Task<ReportResultDto> EmployeeByGradeReport(Dictionary<string, string>? filters)
    {
        var q = _db.Employees.Where(e => e.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.Include(e => e.Grade)
            .GroupBy(e => e.Grade != null ? e.Grade.Name : "Unassigned")
            .Select(g => new { Grade = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).ToListAsync();
        var cols = new List<string> { "Grade", "Headcount" };
        var rows = data.Select(d => new Dictionary<string, object?> { ["Grade"] = d.Grade, ["Headcount"] = d.Count }).ToList();
        return Build("Employees by Grade", cols, rows);
    }

    private async Task<ReportResultDto> NewJoinersReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddDays(-30);
        var to = DateTime.UtcNow;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td;
        }
        var q = _db.Employees.Include(e => e.Department).Include(e => e.JobTitle)
            .Where(e => e.JoinDate >= from && e.JoinDate <= to).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.OrderByDescending(e => e.JoinDate).ToListAsync();
        var cols = new List<string> { "Employee Code", "Full Name", "Department", "Job Title", "Join Date", "Status" };
        var rows = data.Select(e => new Dictionary<string, object?>
        {
            ["Employee Code"] = e.EmployeeCode, ["Full Name"] = e.FullName, ["Department"] = e.Department?.Name,
            ["Job Title"] = e.JobTitle?.Title, ["Join Date"] = e.JoinDate.ToString("yyyy-MM-dd"), ["Status"] = e.Status,
        }).ToList();
        return Build("New Joiners", cols, rows);
    }

    private async Task<ReportResultDto> TerminationsReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddMonths(-6);
        var to = DateTime.UtcNow;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td;
        }
        var q = _db.Employees.Include(e => e.Department)
            .Where(e => e.Status == "Terminated" && e.TerminationDate != null && e.TerminationDate >= from && e.TerminationDate <= to).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.OrderByDescending(e => e.TerminationDate).ToListAsync();
        var cols = new List<string> { "Employee Code", "Full Name", "Department", "Termination Date", "Reason", "Note" };
        var rows = data.Select(e => new Dictionary<string, object?>
        {
            ["Employee Code"] = e.EmployeeCode, ["Full Name"] = e.FullName, ["Department"] = e.Department?.Name,
            ["Termination Date"] = e.TerminationDate?.ToString("yyyy-MM-dd"), ["Reason"] = e.TerminationReason, ["Note"] = e.TerminationNote,
        }).ToList();
        return Build("Terminations / Separations", cols, rows);
    }

    private async Task<ReportResultDto> BirthdayListReport(Dictionary<string, string>? filters)
    {
        var month = DateTime.UtcNow.Month;
        if (filters != null && filters.TryGetValue("month", out var m) && int.TryParse(m, out var mv)) month = mv;
        var q = _db.Employees.Include(e => e.Department)
            .Where(e => e.Status != "Terminated" && e.DateOfBirth.Month == month).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.OrderBy(e => e.DateOfBirth.Day).ToListAsync();
        var cols = new List<string> { "Employee Code", "Full Name", "Department", "Date of Birth", "Day" };
        var rows = data.Select(e => new Dictionary<string, object?>
        {
            ["Employee Code"] = e.EmployeeCode, ["Full Name"] = e.FullName, ["Department"] = e.Department?.Name,
            ["Date of Birth"] = e.DateOfBirth.ToString("yyyy-MM-dd"),
            ["Day"] = new DateTime(2000, month, e.DateOfBirth.Day).ToString("dddd"),
        }).ToList();
        return Build($"Birthday List - {new DateTime(2000, month, 1):MMMM}", cols, rows);
    }

    private async Task<ReportResultDto> WorkAnniversaryReport(Dictionary<string, string>? filters)
    {
        var month = DateTime.UtcNow.Month;
        if (filters != null && filters.TryGetValue("month", out var m) && int.TryParse(m, out var mv)) month = mv;
        var now = DateTime.UtcNow;
        var q = _db.Employees.Include(e => e.Department)
            .Where(e => e.Status != "Terminated" && e.JoinDate.Month == month).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.OrderBy(e => e.JoinDate.Day).ToListAsync();
        var cols = new List<string> { "Employee Code", "Full Name", "Department", "Join Date", "Years of Service" };
        var rows = data.Select(e => new Dictionary<string, object?>
        {
            ["Employee Code"] = e.EmployeeCode, ["Full Name"] = e.FullName, ["Department"] = e.Department?.Name,
            ["Join Date"] = e.JoinDate.ToString("yyyy-MM-dd"),
            ["Years of Service"] = Math.Floor((now - e.JoinDate).TotalDays / 365.25),
        }).ToList();
        return Build($"Work Anniversary - {new DateTime(2000, month, 1):MMMM}", cols, rows);
    }

    private async Task<ReportResultDto> ProbationDueReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.Date;
        var to = DateTime.UtcNow.Date.AddDays(30);
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }

        var q = _db.Employees.Include(e => e.Department)
            .Where(e => e.EmploymentType == "FullTimeProbation" && e.ProbationEndDate != null && e.ProbationEndDate >= from && e.ProbationEndDate <= to).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(e => e.DepartmentId == deptId);
        var data = await q.OrderBy(e => e.ProbationEndDate).ToListAsync();
        var cols = new List<string> { "Employee Code", "Full Name", "Department", "Join Date", "Probation End Date" };
        var rows = data.Select(e => new Dictionary<string, object?>
        {
            ["Employee Code"] = e.EmployeeCode, ["Full Name"] = e.FullName, ["Department"] = e.Department?.Name,
            ["Join Date"] = e.JoinDate.ToString("yyyy-MM-dd"), ["Probation End Date"] = e.ProbationEndDate?.ToString("yyyy-MM-dd"),
        }).ToList();
        return Build($"Probation End Due ({from:yyyy-MM-dd} to {to:yyyy-MM-dd})", cols, rows);
    }

    private async Task<ReportResultDto> HeadcountSummaryReport(Dictionary<string, string>? filters)
    {
        var all = await _db.Employees.Include(e => e.Department).Include(e => e.BusinessUnit).ToListAsync();
        var active = all.Where(e => e.Status != "Terminated").ToList();
        if (TryGetDepartmentId(filters, out var deptId))
        {
            all = all.Where(e => e.DepartmentId == deptId).ToList();
            active = active.Where(e => e.DepartmentId == deptId).ToList();
        }

        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["Metric"] = "Total Employees", ["Count"] = all.Count },
            new() { ["Metric"] = "Active Employees", ["Count"] = active.Count },
            new() { ["Metric"] = "Terminated", ["Count"] = all.Count(e => e.Status == "Terminated") },
            new() { ["Metric"] = "On Probation", ["Count"] = active.Count(e => e.EmploymentType == "FullTimeProbation") },
            new() { ["Metric"] = "Male", ["Count"] = active.Count(e => e.Gender.ToString() == "Male") },
            new() { ["Metric"] = "Female", ["Count"] = active.Count(e => e.Gender.ToString() == "Female") },
        };
        foreach (var deptGroup in active.GroupBy(e => e.Department?.Name ?? "Unassigned").OrderByDescending(g => g.Count()))
            rows.Add(new() { ["Metric"] = $"Dept: {deptGroup.Key}", ["Count"] = deptGroup.Count() });

        return Build("Headcount Summary", new List<string> { "Metric", "Count" }, rows);
    }

    private async Task<ReportResultDto> EmployeeAttachmentsReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddYears(-1).Date;
        var to = DateTime.UtcNow.Date;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }

        var q = _db.Set<EmployeeAttachment>()
            .Include(a => a.Employee).ThenInclude(e => e.Department)
            .Include(a => a.AttachmentType)
            .Where(a => !a.IsDeleted && a.CreatedAt >= from && a.CreatedAt <= to.AddDays(1).AddTicks(-1))
            .AsQueryable();

        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(a => a.Employee.DepartmentId == deptId);

        var data = await q
            .OrderByDescending(a => a.CreatedAt)
            .ThenBy(a => a.Employee.FirstName)
            .Take(2000)
            .ToListAsync();

        var cols = new List<string>
        {
            "Employee Code",
            "Employee Name",
            "Department",
            "Attachment Type",
            "File Name",
            "File Size (KB)",
            "Uploaded At",
            "Expiry Date",
            "Status",
        };

        var rows = data.Select(a =>
        {
            var status = "No Expiry";
            if (a.ExpiryDate.HasValue)
            {
                status = a.ExpiryDate.Value.Date < DateTime.UtcNow.Date
                    ? "Expired"
                    : "Active";
            }

            return new Dictionary<string, object?>
            {
                ["Employee Code"] = a.Employee.EmployeeCode,
                ["Employee Name"] = a.Employee.FullName,
                ["Department"] = a.Employee.Department?.Name,
                ["Attachment Type"] = a.AttachmentType?.Name ?? "Unspecified",
                ["File Name"] = a.FileName,
                ["File Size (KB)"] = Math.Round((decimal)a.Size / 1024m, 1),
                ["Uploaded At"] = a.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                ["Expiry Date"] = a.ExpiryDate?.ToString("yyyy-MM-dd"),
                ["Status"] = status,
            };
        }).ToList();

        return Build($"Employee Attachments ({from:yyyy-MM-dd} to {to:yyyy-MM-dd})", cols, rows);
    }

    // ========== LEAVE ==========

    private async Task<ReportResultDto> LeaveBalanceSummaryReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<LeaveBalance>()
            .Include(b => b.Employee).Include(b => b.LeaveType)
            .Where(b => !b.IsDeleted && b.Employee.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(b => b.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(b => b.Employee.FirstName).ThenBy(b => b.LeaveType.Name).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Leave Type", "Entitled", "Taken", "Balance" };
        var rows = data.Select(b => new Dictionary<string, object?>
        {
            ["Employee Code"] = b.Employee.EmployeeCode, ["Employee Name"] = b.Employee.FullName,
            ["Leave Type"] = b.LeaveType.Name, ["Entitled"] = b.Entitled, ["Taken"] = b.Used, ["Balance"] = b.Remaining,
        }).ToList();
        return Build("Leave Balance Summary", cols, rows);
    }

    private async Task<ReportResultDto> LeaveUtilizationReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<LeaveBalance>()
            .Include(b => b.Employee).Include(b => b.LeaveType)
            .Where(b => !b.IsDeleted && b.Employee.Status != "Terminated" && b.Entitled > 0).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(b => b.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(b => b.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Leave Type", "Entitled", "Taken", "Utilization %" };
        var rows = data.Select(b => new Dictionary<string, object?>
        {
            ["Employee Code"] = b.Employee.EmployeeCode, ["Employee Name"] = b.Employee.FullName,
            ["Leave Type"] = b.LeaveType.Name, ["Entitled"] = b.Entitled, ["Taken"] = b.Used,
            ["Utilization %"] = b.Entitled > 0 ? Math.Round((double)b.Used / (double)b.Entitled * 100, 1) : 0,
        }).ToList();
        return Build("Leave Utilization", cols, rows);
    }

    private async Task<ReportResultDto> LeaveRequestsReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<LeaveRequest>().Include(r => r.Employee).Include(r => r.LeaveType)
            .Where(r => !r.IsDeleted).AsQueryable();
        if (filters != null && filters.TryGetValue("status", out var st) && !string.IsNullOrWhiteSpace(st))
            q = q.Where(r => r.Status.ToString() == st);
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        if (hasRange)
            q = q.Where(r => r.EndDate >= from && r.StartDate <= to);
        var data = await q.OrderByDescending(r => r.StartDate).Take(500).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Leave Type", "From", "To", "Days", "Status", "Reason" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Employee Code"] = r.Employee.EmployeeCode, ["Employee Name"] = r.Employee.FullName,
            ["Leave Type"] = r.LeaveType.Name, ["From"] = r.StartDate.ToString("yyyy-MM-dd"),
            ["To"] = r.EndDate.ToString("yyyy-MM-dd"),             ["Days"] = r.TotalDays,
            ["Status"] = r.Status.ToString(), ["Reason"] = r.Reason,
        }).ToList();
        return Build("Leave Requests History", cols, rows);
    }

    private async Task<ReportResultDto> AbsenceFrequencyReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddDays(-30).Date;
        var to = DateTime.UtcNow.Date;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }
        var q = _db.Set<LeaveRequest>()
            .Include(r => r.Employee).ThenInclude(e => e.Department)
            .Where(r => !r.IsDeleted && (r.Status.ToString() == "Approved" || r.Status.ToString() == "PendingLevel2")
                && r.StartDate <= to && r.EndDate >= from).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        var data = await q
            .GroupBy(r => new { r.Employee.EmployeeCode, Name = r.Employee.FirstName + " " + r.Employee.LastName, Dept = r.Employee.Department!.Name })
            .Select(g => new { g.Key.EmployeeCode, g.Key.Name, g.Key.Dept, Instances = g.Count(), TotalDays = g.Sum(r => r.TotalDays) })
            .OrderByDescending(x => x.Instances).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Leave Instances", "Total Days" };
        var rows = data.Select(d => new Dictionary<string, object?>
        {
            ["Employee Code"] = d.EmployeeCode, ["Employee Name"] = d.Name, ["Department"] = d.Dept,
            ["Leave Instances"] = d.Instances, ["Total Days"] = d.TotalDays,
        }).ToList();
        return Build("Absence Frequency", cols, rows);
    }

    private async Task<ReportResultDto> LeaveByTypeReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddMonths(-12).Date;
        var to = DateTime.UtcNow.Date;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }
        var q = _db.Set<LeaveRequest>()
            .Include(r => r.LeaveType).Include(r => r.Employee)
            .Where(r => !r.IsDeleted && (r.Status.ToString() == "Approved" || r.Status.ToString() == "PendingLevel2")
                && r.StartDate <= to && r.EndDate >= from).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        var data = await q
            .GroupBy(r => r.LeaveType.Name)
            .Select(g => new { LeaveType = g.Key, Requests = g.Count(), TotalDays = g.Sum(r => r.TotalDays) })
            .OrderByDescending(x => x.TotalDays).ToListAsync();
        var cols = new List<string> { "Leave Type", "Total Requests", "Total Days" };
        var rows = data.Select(d => new Dictionary<string, object?>
        {
            ["Leave Type"] = d.LeaveType, ["Total Requests"] = d.Requests, ["Total Days"] = d.TotalDays,
        }).ToList();
        return Build("Leave by Type", cols, rows);
    }

    private async Task<ReportResultDto> PendingApprovalsReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<LeaveRequest>()
            .Include(r => r.Employee).ThenInclude(e => e.Department)
            .Include(r => r.LeaveType)
            .Where(r => !r.IsDeleted && (r.Status == Domain.Enums.ApprovalStatus.Pending || r.Status == Domain.Enums.ApprovalStatus.PendingLevel2)).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(r => r.StartDate).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Leave Type", "From", "To", "Days", "Status" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Employee Code"] = r.Employee.EmployeeCode, ["Employee Name"] = r.Employee.FullName,
            ["Department"] = r.Employee.Department?.Name, ["Leave Type"] = r.LeaveType.Name,
            ["From"] = r.StartDate.ToString("yyyy-MM-dd"), ["To"] = r.EndDate.ToString("yyyy-MM-dd"),
            ["Days"] = r.TotalDays, ["Status"] = r.Status.ToString(),
        }).ToList();
        return Build("Pending Leave Approvals", cols, rows);
    }

    // ========== ATTENDANCE ==========

    private async Task<ReportResultDto> DailyAttendanceReport(Dictionary<string, string>? filters)
    {
        var to = DateTime.UtcNow.Date;
        var from = new DateTime(to.Year, to.Month, 1);
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
            else if (filters.TryGetValue("date", out var d) && DateTime.TryParse(d, out var dd))
            {
                from = dd.Date;
                to = dd.Date;
            }
        }
        if (from > to) (from, to) = (to, from);

        var q = _db.Set<AttendanceRecord>().Include(a => a.Employee).ThenInclude(e => e.Department)
            .Where(a => !a.IsDeleted && a.Date.Date >= from && a.Date.Date <= to).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(a => a.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(a => a.Date).ThenBy(a => a.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Date", "Employee Code", "Employee Name", "Department", "Punch In", "Punch Out", "Worked Hours", "Status" };
        var rows = data.Select(a => new Dictionary<string, object?>
        {
            ["Date"] = a.Date.ToString("yyyy-MM-dd"),
            ["Employee Code"] = a.Employee.EmployeeCode, ["Employee Name"] = a.Employee.FullName,
            ["Department"] = a.Employee.Department?.Name,
            ["Punch In"] = a.PunchIn?.ToString("HH:mm"), ["Punch Out"] = a.PunchOut?.ToString("HH:mm"),
            ["Worked Hours"] = a.WorkedHours?.ToString("F2"), ["Status"] = a.Status,
        }).ToList();
        var title = from == to
            ? $"Attendance Register - {from:yyyy-MM-dd}"
            : $"Attendance Register - {from:yyyy-MM-dd} to {to:yyyy-MM-dd}";
        return Build(title, cols, rows);
    }

    private async Task<ReportResultDto> MonthlyAttendanceReport(Dictionary<string, string>? filters)
    {
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        if (filters != null)
        {
            if (filters.TryGetValue("year", out var y) && int.TryParse(y, out var yv)) year = yv;
            if (filters.TryGetValue("month", out var m) && int.TryParse(m, out var mv)) month = mv;
        }
        var q = _db.Set<AttendanceRecord>().Include(a => a.Employee)
            .Where(a => !a.IsDeleted && a.Date.Year == year && a.Date.Month == month).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(a => a.Employee.DepartmentId == deptId);
        var data = await q
            .GroupBy(a => new { a.Employee.EmployeeCode, Name = a.Employee.FirstName + " " + a.Employee.LastName })
            .Select(g => new
            {
                g.Key.EmployeeCode, g.Key.Name,
                PresentDays = g.Count(a => a.Status == "Present"),
                LateDays = g.Count(a => a.Status == "Late"),
                AbsentDays = g.Count(a => a.Status == "Absent"),
                TotalHours = g.Sum(a => (double?)(a.WorkedHours ?? 0)) ?? 0,
            }).OrderBy(x => x.Name).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Present Days", "Late Days", "Absent Days", "Total Hours" };
        var rows = data.Select(d => new Dictionary<string, object?>
        {
            ["Employee Code"] = d.EmployeeCode, ["Employee Name"] = d.Name,
            ["Present Days"] = d.PresentDays, ["Late Days"] = d.LateDays,
            ["Absent Days"] = d.AbsentDays, ["Total Hours"] = Math.Round(d.TotalHours, 1),
        }).ToList();
        return Build($"Monthly Attendance - {new DateTime(year, month, 1):MMMM yyyy}", cols, rows);
    }

    private async Task<ReportResultDto> LateArrivalsReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddDays(-30).Date;
        var to = DateTime.UtcNow.Date;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }
        var q = _db.Set<AttendanceRecord>().Include(a => a.Employee).ThenInclude(e => e.Department)
            .Where(a => !a.IsDeleted && a.Status == "Late" && a.Date >= from && a.Date <= to).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(a => a.Employee.DepartmentId == deptId);
        var data = await q.OrderByDescending(a => a.Date).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Date", "Punch In", "Status" };
        var rows = data.Select(a => new Dictionary<string, object?>
        {
            ["Employee Code"] = a.Employee.EmployeeCode, ["Employee Name"] = a.Employee.FullName,
            ["Department"] = a.Employee.Department?.Name, ["Date"] = a.Date.ToString("yyyy-MM-dd"),
            ["Punch In"] = a.PunchIn?.ToString("HH:mm"), ["Status"] = a.Status,
        }).ToList();
        return Build("Late Arrivals", cols, rows);
    }

    private async Task<ReportResultDto> EarlyDeparturesReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.AddDays(-30).Date;
        var to = DateTime.UtcNow.Date;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }
        var q = _db.Set<AttendanceRecord>().Include(a => a.Employee).ThenInclude(e => e.Department)
            .Where(a => !a.IsDeleted && a.Status == "EarlyDeparture" && a.Date >= from && a.Date <= to).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(a => a.Employee.DepartmentId == deptId);
        var data = await q.OrderByDescending(a => a.Date).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Date", "Punch Out", "Status" };
        var rows = data.Select(a => new Dictionary<string, object?>
        {
            ["Employee Code"] = a.Employee.EmployeeCode, ["Employee Name"] = a.Employee.FullName,
            ["Department"] = a.Employee.Department?.Name, ["Date"] = a.Date.ToString("yyyy-MM-dd"),
            ["Punch Out"] = a.PunchOut?.ToString("HH:mm"), ["Status"] = a.Status,
        }).ToList();
        return Build("Early Departures", cols, rows);
    }

    private async Task<ReportResultDto> OvertimeReport(Dictionary<string, string>? filters)
    {
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        if (filters != null)
        {
            if (filters.TryGetValue("year", out var y) && int.TryParse(y, out var yv)) year = yv;
            if (filters.TryGetValue("month", out var m) && int.TryParse(m, out var mv)) month = mv;
        }
        var q = _db.Set<AttendanceRecord>().Include(a => a.Employee).ThenInclude(e => e.Department)
            .Where(a => !a.IsDeleted && a.Date.Year == year && a.Date.Month == month && a.WorkedHours > 8).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(a => a.Employee.DepartmentId == deptId);
        var data = await q
            .GroupBy(a => new { a.Employee.EmployeeCode, Name = a.Employee.FirstName + " " + a.Employee.LastName, Dept = a.Employee.Department!.Name })
            .Select(g => new { g.Key.EmployeeCode, g.Key.Name, g.Key.Dept, OTDays = g.Count(), OTHours = g.Sum(a => (double?)(a.WorkedHours ?? 0) - 8) ?? 0 })
            .OrderByDescending(x => x.OTHours).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "OT Days", "OT Hours" };
        var rows = data.Select(d => new Dictionary<string, object?>
        {
            ["Employee Code"] = d.EmployeeCode, ["Employee Name"] = d.Name, ["Department"] = d.Dept,
            ["OT Days"] = d.OTDays, ["OT Hours"] = Math.Round(d.OTHours, 1),
        }).ToList();
        return Build($"Overtime Report - {new DateTime(year, month, 1):MMMM yyyy}", cols, rows);
    }

    private async Task<ReportResultDto> AbsentReport(Dictionary<string, string>? filters)
    {
        var date = DateTime.UtcNow.Date;
        if (filters != null && filters.TryGetValue("date", out var d) && DateTime.TryParse(d, out var dd)) date = dd.Date;
        var empQ = _db.Employees.Where(e => e.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            empQ = empQ.Where(e => e.DepartmentId == deptId);
        var allActive = await empQ.Select(e => new { e.Id, e.EmployeeCode, e.FirstName, e.LastName }).ToListAsync();
        var presentIds = await _db.Set<AttendanceRecord>().Where(a => !a.IsDeleted && a.Date.Date == date).Select(a => a.EmployeeId).Distinct().ToListAsync();
        var absent = allActive.Where(e => !presentIds.Contains(e.Id)).ToList();
        var cols = new List<string> { "Employee Code", "Employee Name" };
        var rows = absent.Select(e => new Dictionary<string, object?> { ["Employee Code"] = e.EmployeeCode, ["Employee Name"] = $"{e.FirstName} {e.LastName}" }).ToList();
        return Build($"Absent / No-Punch Report - {date:yyyy-MM-dd}", cols, rows);
    }

    // ========== PAYROLL ==========

    private async Task<ReportResultDto> PayrollRegisterReport(Dictionary<string, string>? filters)
    {
        var year = (int?)null;
        var month = (int?)null;
        if (filters != null)
        {
            if (filters.TryGetValue("year", out var y) && int.TryParse(y, out var yv)) year = yv;
            if (filters.TryGetValue("month", out var m) && int.TryParse(m, out var mv)) month = mv;
        }
        var q = _db.Set<PayStatement>().Include(p => p.Employee).ThenInclude(e => e.Department)
            .Where(p => !p.IsDeleted).AsQueryable();
        if (year.HasValue) q = q.Where(p => p.Year == year.Value);
        if (month.HasValue) q = q.Where(p => p.Month == month.Value);
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(p => p.Employee.DepartmentId == deptId);
        var data = await q.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month).Take(500).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Period", "Gross", "Deductions", "Net Pay" };
        var rows = data.Select(p => new Dictionary<string, object?>
        {
            ["Employee Code"] = p.Employee.EmployeeCode, ["Employee Name"] = p.Employee.FullName,
            ["Department"] = p.Employee.Department?.Name,
            ["Period"] = $"{p.Year}-{p.Month:D2}",
            ["Gross"] = p.GrossPay, ["Deductions"] = p.TotalDeductions, ["Net Pay"] = p.NetPay,
        }).ToList();
        return Build("Payroll Register", cols, rows);
    }

    private async Task<ReportResultDto> SalaryRegisterReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<EmployeeCompensation>().Include(c => c.Employee).ThenInclude(e => e.Department)
            .Include(c => c.Component)
            .Where(c => !c.IsDeleted && c.Employee.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(c => c.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(c => c.Employee.FirstName).ThenBy(c => c.Component.Name).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Component", "Amount", "Currency" };
        var rows = data.Select(c => new Dictionary<string, object?>
        {
            ["Employee Code"] = c.Employee.EmployeeCode, ["Employee Name"] = c.Employee.FullName,
            ["Department"] = c.Employee.Department?.Name, ["Component"] = c.Component.Name,
            ["Amount"] = c.Amount, ["Currency"] = c.Currency,
        }).ToList();
        return Build("Salary Register", cols, rows);
    }

    private async Task<ReportResultDto> SalaryRevisionHistoryReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var q = _db.Set<SalaryRevision>().Include(r => r.Employee).ThenInclude(e => e.Department)
            .Where(r => !r.IsDeleted).AsQueryable();
        if (hasRange)
            q = q.Where(r => r.EffectiveDate >= from && r.EffectiveDate <= to);
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        var data = await q.OrderByDescending(r => r.EffectiveDate).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Effective Date", "Previous", "Revised", "Change %" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Employee Code"] = r.Employee.EmployeeCode, ["Employee Name"] = r.Employee.FullName,
            ["Department"] = r.Employee.Department?.Name, ["Effective Date"] = r.EffectiveDate.ToString("yyyy-MM-dd"),
            ["Previous"] = r.CurrentSalary, ["Revised"] = r.ProposedSalary,
            ["Change %"] = r.CurrentSalary > 0 ? Math.Round((double)(r.ProposedSalary - r.CurrentSalary) / (double)r.CurrentSalary * 100, 1) : 0,
        }).ToList();
        return Build("Salary Revision History", cols, rows);
    }

    private async Task<ReportResultDto> DepartmentCostReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<EmployeeCompensation>()
            .Include(c => c.Employee).ThenInclude(e => e.Department)
            .Where(c => !c.IsDeleted && c.Employee.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(c => c.Employee.DepartmentId == deptId);
        var data = await q
            .GroupBy(c => c.Employee.Department!.Name ?? "Unassigned")
            .Select(g => new { Department = g.Key, TotalCost = g.Sum(c => c.Amount), EmployeeCount = g.Select(c => c.EmployeeId).Distinct().Count() })
            .OrderByDescending(x => x.TotalCost).ToListAsync();
        var cols = new List<string> { "Department", "Employee Count", "Total Monthly Cost" };
        var rows = data.Select(d => new Dictionary<string, object?>
        {
            ["Department"] = d.Department, ["Employee Count"] = d.EmployeeCount, ["Total Monthly Cost"] = d.TotalCost,
        }).ToList();
        return Build("Department Payroll Cost", cols, rows);
    }

    private async Task<ReportResultDto> BankTransferListReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<BankAccount>().Include(b => b.Employee).ThenInclude(e => e.Department)
            .Where(b => !b.IsDeleted && b.Employee.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(b => b.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(b => b.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Bank Name", "Branch", "Account Number", "Account Type" };
        var rows = data.Select(b => new Dictionary<string, object?>
        {
            ["Employee Code"] = b.Employee.EmployeeCode, ["Employee Name"] = b.Employee.FullName,
            ["Bank Name"] = b.BankName, ["Branch"] = b.BranchLocation,
            ["Account Number"] = b.AccountNumber, ["Account Type"] = b.AccountType,
        }).ToList();
        return Build("Bank Transfer List", cols, rows);
    }

    // ========== RECRUITMENT ==========

    private async Task<ReportResultDto> OpenRequisitionsReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var q = _db.Set<Requisition>().Include(r => r.Department).Include(r => r.JobTitle).Include(r => r.Candidates)
            .Where(r => !r.IsDeleted && r.Status != Domain.Enums.ApprovalStatus.Cancelled).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.DepartmentId == deptId);
        if (hasRange)
            q = q.Where(r => r.CreatedAt >= from && r.CreatedAt <= to);
        var data = await q.OrderByDescending(r => r.CreatedAt).ToListAsync();
        var cols = new List<string> { "Req Code", "Title", "Department", "Vacancies", "Candidates", "Status", "Target Date" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Req Code"] = r.Code, ["Title"] = r.Title, ["Department"] = r.Department?.Name,
            ["Vacancies"] = r.Vacancies, ["Candidates"] = r.Candidates.Count,
            ["Status"] = r.Status.ToString(), ["Target Date"] = r.TargetDate?.ToString("yyyy-MM-dd"),
        }).ToList();
        return Build("Open Requisitions", cols, rows);
    }

    private async Task<ReportResultDto> CandidatePipelineReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<Candidate>().Include(c => c.Requisition)
            .Where(c => !c.IsDeleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(c => c.Requisition != null && c.Requisition.DepartmentId == deptId);
        var data = await q
            .GroupBy(c => c.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).ToListAsync();
        var cols = new List<string> { "Pipeline Stage", "Candidate Count" };
        var rows = data.Select(d => new Dictionary<string, object?> { ["Pipeline Stage"] = d.Stage, ["Candidate Count"] = d.Count }).ToList();
        return Build("Candidate Pipeline", cols, rows);
    }

    private async Task<ReportResultDto> TimeToFillReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var q = _db.Set<Requisition>().Include(r => r.Department)
            .Where(r => !r.IsDeleted && r.Status == Domain.Enums.ApprovalStatus.Approved).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.DepartmentId == deptId);
        if (hasRange)
            q = q.Where(r => r.CreatedAt >= from && r.CreatedAt <= to);
        var data = await q.ToListAsync();
        var cols = new List<string> { "Req Code", "Title", "Department", "Created", "Target", "Days Open" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Req Code"] = r.Code, ["Title"] = r.Title, ["Department"] = r.Department?.Name,
            ["Created"] = r.CreatedAt.ToString("yyyy-MM-dd"), ["Target"] = r.TargetDate?.ToString("yyyy-MM-dd"),
            ["Days Open"] = (DateTime.UtcNow - r.CreatedAt).Days,
        }).ToList();
        return Build("Time to Fill", cols, rows);
    }

    private async Task<ReportResultDto> RecruitmentSummaryReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var reqQ = _db.Set<Requisition>().Where(r => !r.IsDeleted).AsQueryable();
        if (hasRange)
            reqQ = reqQ.Where(r => r.CreatedAt >= from && r.CreatedAt <= to);
        var reqs = await reqQ.ToListAsync();
        var candQ = _db.Set<Candidate>().Include(c => c.Requisition).Where(c => !c.IsDeleted).AsQueryable();
        if (hasRange)
            candQ = candQ.Where(c => c.AppliedAt >= from && c.AppliedAt <= to);
        var cands = await candQ.CountAsync();
        var offerQ = _db.Set<Offer>().Where(o => !o.IsDeleted).AsQueryable();
        if (hasRange)
            offerQ = offerQ.Where(o => o.OfferDate >= from && o.OfferDate <= to);
        var offers = await offerQ.CountAsync();
        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["Metric"] = "Total Requisitions", ["Count"] = reqs.Count },
            new() { ["Metric"] = "Open Requisitions", ["Count"] = reqs.Count(r => r.Status == Domain.Enums.ApprovalStatus.Pending || r.Status == Domain.Enums.ApprovalStatus.Approved) },
            new() { ["Metric"] = "Total Candidates", ["Count"] = cands },
            new() { ["Metric"] = "Total Offers", ["Count"] = offers },
            new() { ["Metric"] = "Total Vacancies", ["Count"] = reqs.Sum(r => r.Vacancies) },
        };
        return Build("Recruitment Summary", new List<string> { "Metric", "Count" }, rows);
    }

    // ========== PERFORMANCE ==========

    private async Task<ReportResultDto> GoalStatusReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var q = _db.Set<Goal>().Include(g => g.Employee).ThenInclude(e => e.Department)
            .Where(g => !g.IsDeleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(g => g.Employee.DepartmentId == deptId);
        if (hasRange)
            q = q.Where(g => (g.DueDate ?? g.CreatedAt) >= from && (g.DueDate ?? g.CreatedAt) <= to);
        var data = await q.OrderBy(g => g.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Goal Title", "Status", "Progress %", "Due Date" };
        var rows = data.Select(g => new Dictionary<string, object?>
        {
            ["Employee Code"] = g.Employee.EmployeeCode, ["Employee Name"] = g.Employee.FullName,
            ["Department"] = g.Employee.Department?.Name, ["Goal Title"] = g.Title,
            ["Status"] = g.Status, ["Progress %"] = g.Progress, ["Due Date"] = g.DueDate?.ToString("yyyy-MM-dd"),
        }).ToList();
        return Build("Goal Status", cols, rows);
    }

    private async Task<ReportResultDto> ReviewCompletionReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var q = _db.Set<PerformanceReview>().Include(r => r.Employee).Include(r => r.ReviewCycle).Include(r => r.Reviewer)
            .Where(r => !r.IsDeleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        if (hasRange)
            q = q.Where(r => r.CreatedAt >= from && r.CreatedAt <= to);
        var data = await q.OrderByDescending(r => r.CreatedAt).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Review Cycle", "Reviewer", "Rating", "Status" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Employee Code"] = r.Employee.EmployeeCode, ["Employee Name"] = r.Employee.FullName,
            ["Review Cycle"] = r.ReviewCycle?.Name, ["Reviewer"] = r.Reviewer?.FullName,
            ["Rating"] = r.OverallRating, ["Status"] = r.Status.ToString(),
        }).ToList();
        return Build("Review Completion", cols, rows);
    }

    private async Task<ReportResultDto> RatingDistributionReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<PerformanceReview>()
            .Where(r => !r.IsDeleted && r.OverallRating != null).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        var data = await q
            .GroupBy(r => r.OverallRating!.Value)
            .Select(g => new { Rating = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Rating).ToListAsync();
        var cols = new List<string> { "Rating", "Employee Count" };
        var rows = data.Select(d => new Dictionary<string, object?> { ["Rating"] = d.Rating, ["Employee Count"] = d.Count }).ToList();
        return Build("Rating Distribution", cols, rows);
    }

    // ========== ORGANIZATION ==========

    private async Task<ReportResultDto> DepartmentDirectoryReport()
    {
        var data = await _db.Departments.Include(d => d.ParentDepartment).Include(d => d.Employees)
            .OrderBy(d => d.Name).ToListAsync();
        var cols = new List<string> { "Department", "Code", "Parent Department", "Active Employees" };
        var rows = data.Select(d => new Dictionary<string, object?>
        {
            ["Department"] = d.Name, ["Code"] = d.Code,
            ["Parent Department"] = d.ParentDepartment?.Name,
            ["Active Employees"] = d.Employees.Count(e => !e.IsDeleted && e.Status != "Terminated"),
        }).ToList();
        return Build("Department Directory", cols, rows);
    }

    private async Task<ReportResultDto> ReportingStructureReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<EmployeeSupervisor>()
            .Include(s => s.Employee).ThenInclude(e => e.Department)
            .Include(s => s.Supervisor)
            .Where(s => !s.IsDeleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(s => s.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(s => s.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Department", "Supervisor", "Reporting Method" };
        var rows = data.Select(s => new Dictionary<string, object?>
        {
            ["Employee Code"] = s.Employee.EmployeeCode, ["Employee Name"] = s.Employee.FullName,
            ["Department"] = s.Employee.Department?.Name,
            ["Supervisor"] = s.Supervisor.FullName, ["Reporting Method"] = s.ReportingMethod,
        }).ToList();
        return Build("Reporting Structure", cols, rows);
    }

    private async Task<ReportResultDto> PositionVacancyReport(Dictionary<string, string>? filters)
    {
        var q = _db.Positions.Include(p => p.Department).Include(p => p.JobTitle).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(p => p.DepartmentId == deptId);
        var data = await q.OrderBy(p => p.Title).ToListAsync();
        var cols = new List<string> { "Position", "Code", "Department", "Job Title", "Vacant" };
        var rows = data.Select(p => new Dictionary<string, object?>
        {
            ["Position"] = p.Title, ["Code"] = p.Code, ["Department"] = p.Department?.Name,
            ["Job Title"] = p.JobTitle?.Title, ["Vacant"] = p.IsVacant ? "Yes" : "No",
        }).ToList();
        return Build("Position & Vacancy", cols, rows);
    }

    private async Task<ReportResultDto> ShiftRosterReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.MinValue;
        var to = DateTime.MaxValue;
        var hasRange = false;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) { from = fd.Date; hasRange = true; }
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) { to = td.Date.AddDays(1).AddTicks(-1); hasRange = true; }
        }
        var q = _db.Set<RosterAssignment>()
            .Include(r => r.Employee).Include(r => r.RosterTemplate)
            .Where(r => !r.IsDeleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(r => r.Employee.DepartmentId == deptId);
        if (hasRange)
            q = q.Where(r => r.EffectiveFrom <= to && (r.EffectiveTo == null || r.EffectiveTo >= from));
        var data = await q.OrderBy(r => r.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Roster Template", "Start Date", "End Date" };
        var rows = data.Select(r => new Dictionary<string, object?>
        {
            ["Employee Code"] = r.Employee.EmployeeCode, ["Employee Name"] = r.Employee.FullName,
            ["Roster Template"] = r.RosterTemplate?.Name, ["Start Date"] = r.EffectiveFrom.ToString("yyyy-MM-dd"),
            ["End Date"] = r.EffectiveTo?.ToString("yyyy-MM-dd"),
        }).ToList();
        return Build("Shift & Roster Assignment", cols, rows);
    }

    // ========== COMPLIANCE ==========

    private async Task<ReportResultDto> DocumentExpiryReport(Dictionary<string, string>? filters)
    {
        var from = DateTime.UtcNow.Date;
        var to = DateTime.UtcNow.AddDays(60).Date;
        if (filters != null)
        {
            if (filters.TryGetValue("from", out var f) && DateTime.TryParse(f, out var fd)) from = fd.Date;
            if (filters.TryGetValue("to", out var t) && DateTime.TryParse(t, out var td)) to = td.Date;
        }
        var q = _db.Set<Immigration>().Include(i => i.Employee)
            .Where(i => !i.IsDeleted && i.ExpiryDate != null && i.ExpiryDate >= from && i.ExpiryDate <= to.AddDays(1).AddTicks(-1)).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(i => i.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(i => i.ExpiryDate).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Document Type", "Number", "Expiry Date", "Status" };
        var rows = data.Select(i => new Dictionary<string, object?>
        {
            ["Employee Code"] = i.Employee.EmployeeCode, ["Employee Name"] = i.Employee.FullName,
            ["Document Type"] = i.DocumentType, ["Number"] = i.Number,
            ["Expiry Date"] = i.ExpiryDate?.ToString("yyyy-MM-dd"),
            ["Status"] = i.ExpiryDate < DateTime.UtcNow ? "EXPIRED" : "Expiring Soon",
        }).ToList();
        return Build("Document Expiry Tracker", cols, rows);
    }

    private async Task<ReportResultDto> ImmigrationStatusReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<Immigration>().Include(i => i.Employee)
            .Where(i => !i.IsDeleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(i => i.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(i => i.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Document Type", "Number", "Issued By", "Issue Date", "Expiry Date", "Eligible Status" };
        var rows = data.Select(i => new Dictionary<string, object?>
        {
            ["Employee Code"] = i.Employee.EmployeeCode, ["Employee Name"] = i.Employee.FullName,
            ["Document Type"] = i.DocumentType, ["Number"] = i.Number, ["Issued By"] = i.IssuedBy,
            ["Issue Date"] = i.IssuedDate?.ToString("yyyy-MM-dd"), ["Expiry Date"] = i.ExpiryDate?.ToString("yyyy-MM-dd"),
            ["Eligible Status"] = i.EligibleStatus,
        }).ToList();
        return Build("Immigration / Visa Status", cols, rows);
    }

    private async Task<ReportResultDto> EmergencyContactsReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<EmergencyContact>().Include(c => c.Employee)
            .Where(c => !c.IsDeleted && c.Employee.Status != "Terminated").AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(c => c.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(c => c.Employee.FirstName).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Contact Name", "Relationship", "Home Phone", "Mobile", "Work Phone" };
        var rows = data.Select(c => new Dictionary<string, object?>
        {
            ["Employee Code"] = c.Employee.EmployeeCode, ["Employee Name"] = c.Employee.FullName,
            ["Contact Name"] = c.Name, ["Relationship"] = c.Relationship,
            ["Home Phone"] = c.HomeTelephone, ["Mobile"] = c.MobileTelephone, ["Work Phone"] = c.WorkTelephone,
        }).ToList();
        return Build("Emergency Contacts", cols, rows);
    }

    private async Task<ReportResultDto> OnboardingStatusReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<OnboardingTask>().Include(t => t.Employee).Include(t => t.AssignedToUser)
            .Where(t => !t.IsDeleted && !t.IsCompleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(t => t.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(t => t.Employee.FirstName).ThenBy(t => t.Title).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Task", "Category", "Assigned To", "Completed" };
        var rows = data.Select(t => new Dictionary<string, object?>
        {
            ["Employee Code"] = t.Employee.EmployeeCode, ["Employee Name"] = t.Employee.FullName,
            ["Task"] = t.Title, ["Category"] = t.Category,
            ["Assigned To"] = t.AssignedToUser?.Username, ["Completed"] = t.IsCompleted ? "Yes" : "No",
        }).ToList();
        return Build("Onboarding Status", cols, rows);
    }

    private async Task<ReportResultDto> OffboardingStatusReport(Dictionary<string, string>? filters)
    {
        var q = _db.Set<OffboardingTask>().Include(t => t.Employee).Include(t => t.AssignedToUser)
            .Where(t => !t.IsDeleted && !t.IsCompleted).AsQueryable();
        if (TryGetDepartmentId(filters, out var deptId))
            q = q.Where(t => t.Employee.DepartmentId == deptId);
        var data = await q.OrderBy(t => t.Employee.FirstName).ThenBy(t => t.Title).ToListAsync();
        var cols = new List<string> { "Employee Code", "Employee Name", "Task", "Category", "Assigned To", "Completed" };
        var rows = data.Select(t => new Dictionary<string, object?>
        {
            ["Employee Code"] = t.Employee.EmployeeCode, ["Employee Name"] = t.Employee.FullName,
            ["Task"] = t.Title, ["Category"] = t.Category,
            ["Assigned To"] = t.AssignedToUser?.Username, ["Completed"] = t.IsCompleted ? "Yes" : "No",
        }).ToList();
        return Build("Offboarding Status", cols, rows);
    }
}
