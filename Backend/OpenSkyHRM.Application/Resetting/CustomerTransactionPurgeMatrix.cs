namespace OpenSkyHRM.Application.Resetting;

/// <summary>
/// Tables that hold transactional/customer operational data and should be purged when onboarding a new customer.
/// Reference/master catalogs and configuration tables are intentionally not included.
/// </summary>
public static class CustomerTransactionPurgeMatrix
{
    // IMPORTANT: table names are case-sensitive in Postgres because EF migrations create them with quoted identifiers.
    // Keep this list aligned with AppDbContext entity DbSets.
    public static readonly string[] TransactionTables =
    [
        // Employee lifecycle
        "Employees",
        "EmployeeAttachments",
        "EmployeeSupervisors",
        "EmergencyContacts",
        "Dependents",
        "Educations",
        "EmployeeSkills",
        "EmployeeLanguages",
        "EmployeeBenefits",
        "Immigrations",
        "ImmigrationDocuments",
        "WorkExperiences",
        "BankAccounts",

        // Leave & attendance
        "LeaveRequests",
        "LeaveBalances",
        "LeaveMonthlyAccruals",
        "AttendanceRecords",
        "RosterAssignments",
        "PunchImportBatches",

        // Recruitment
        "Requisitions",
        "Candidates",
        "Interviews",
        "Offers",
        "InterviewScorecards",
        "CandidateActivities",

        // Onboarding / offboarding instances (templates are excluded)
        "OnboardingTasks",
        "OnboardingMilestones",
        "OffboardingTasks",

        // Payroll & compensation instances
        "EmployeeCompensations",
        "SalaryRevisions",
        "PayrollBatches",
        "PayStatements",
        "PayStatementLines",

        // Performance / appraisal instances
        "Goals",
        "ReviewCycles",
        "PerformanceReviews",
        "Appraisals",
        "AppraisalReviewers",
        "AppraisalResponseItems",
        "AppraisalCycles",

        // Learning / skills assignments
        "TrainingAssignments",
        "EmployeeCertifications",
        "SkillMatrices",

        // Org planning instances
        "SuccessionPlans",

        // Analytics & operational logs
        "AnalyticsSnapshotCaches",
        "AuditLogs",
        "OutboundEmailLogs",
    ];
}

