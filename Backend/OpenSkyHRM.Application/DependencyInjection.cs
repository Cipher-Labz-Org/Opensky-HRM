using Microsoft.Extensions.DependencyInjection;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Jobs;
using OpenSkyHRM.Application.Services;

namespace OpenSkyHRM.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMemoryCache();
        services.AddHttpClient();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ILicensingService, LicensingService>();
        services.AddScoped<IEmployeeService, EmployeeService>();
        services.AddScoped<IEmployeeLifecycleService, EmployeeLifecycleService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<ILeaveService, LeaveService>();
        services.AddScoped<ILeaveEntitlementService, LeaveEntitlementService>();
        services.AddScoped<IAttendanceService, AttendanceService>();
        services.AddScoped<IAttendancePlaceService, AttendancePlaceService>();
        services.AddScoped<IAttendanceQrTokenService, AttendanceQrTokenService>();
        services.AddScoped<IShiftService, ShiftService>();
        services.AddScoped<IRosterService, RosterService>();
        services.AddScoped<IBiometricService, BiometricService>();
        services.AddScoped<BiometricAdmsIngestService>();
        services.AddScoped<IRecruitmentService, RecruitmentService>();
        services.AddScoped<OpenAiSettingsResolver>();
        services.AddScoped<IOpenAiChatClient, OpenAiChatClient>();
        services.AddScoped<AiLlmPayloadSanitizer>();
        services.AddScoped<IAiDataRetentionService, AiDataRetentionService>();
        services.AddScoped<IRequisitionSkillSuggestionService, RequisitionSkillSuggestionService>();
        services.AddScoped<IOpenAiSkillSuggestionService, OpenAiSkillSuggestionService>();
        services.AddScoped<IPeopleScopeService, PeopleScopeService>();
        services.AddScoped<AiConversationService>();
        services.AddScoped<IAiConversationService>(sp => sp.GetRequiredService<AiConversationService>());
        services.AddScoped<IAiContextBuilder, AiContextBuilder>();
        services.AddScoped<IAiAuditLogger, AiAuditLogger>();
        services.AddScoped<IAiToolExecutor, AiToolExecutor>();
        services.AddScoped<IAiToolRegistry, AiToolRegistry>();
        services.AddScoped<IAiAssistantService, AiAssistantService>();
        services.AddScoped<Services.AiTools.ExplainModuleHelpTool>();
        services.AddScoped<Services.AiTools.GetOrgHeadcountTool>();
        services.AddScoped<Services.AiTools.GetPendingApprovalsTool>();
        services.AddScoped<Services.AiTools.SearchEmployeesTool>();
        services.AddScoped<Services.AiTools.GetEmployeeSummaryTool>();
        services.AddScoped<Services.AiTools.GetMyLeaveBalanceTool>();
        services.AddScoped<Services.AiTools.GetTeamLeaveRequestsTool>();
        services.AddScoped<Services.AiTools.GetAttendanceSummaryTool>();
        services.AddScoped<Services.AiTools.GetRecruitmentPipelineTool>();
        services.AddScoped<Services.AiTools.GetUpcomingBirthdaysTool>();
        services.AddScoped<Services.AiTools.GetEmployeesWithoutSupervisorsTool>();
        services.AddScoped<Services.AiTools.GetRecentNewHiresTool>();
        services.AddScoped<Services.AiTools.GetUpcomingProbationEndTool>();
        services.AddScoped<Services.AiTools.GetPayrollBatchStatusTool>();
        services.AddScoped<Services.AiTools.GetPendingOnboardingTasksTool>();
        services.AddScoped<Services.AiTools.GetActiveOffboardingSummaryTool>();
        services.AddScoped<Services.AiTools.GetVacantPositionsTool>();
        services.AddScoped<Services.AiTools.GetEmployeesOnLeaveTodayTool>();
        services.AddScoped<Services.AiTools.GetOverdueTrainingTool>();
        services.AddScoped<Services.AiTools.GetExpiringDocumentsTool>();
        services.AddScoped<Services.AiTools.GetPendingAppraisalReviewsTool>();
        services.AddScoped<IOnboardingService, OnboardingService>();
        services.AddScoped<IOffboardingService, OffboardingService>();
        services.AddScoped<IEmployeeTaskService, EmployeeTaskService>();
        services.AddScoped<IPayrollService, PayrollService>();
        services.AddScoped<IPayrollAttendanceImportService, PayrollAttendanceImportService>();
        services.AddScoped<PayrollCalculationEngine>();
        services.AddScoped<IPerformanceService, PerformanceService>();
        services.AddScoped<IAppraisalService, AppraisalService>();
        services.AddScoped<ILearningService, LearningService>();
        services.AddScoped<ITrainingAssignmentService, TrainingAssignmentService>();
        services.AddScoped<IUserNotificationService, UserNotificationService>();
        services.AddScoped<IDrugTransportLicenseExpiryReminderService, DrugTransportLicenseExpiryReminderService>();
        services.AddScoped<IEmployeeBirthdayDigestReminderService, EmployeeBirthdayDigestReminderService>();
        services.AddScoped<ICertificationService, CertificationService>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddScoped<ISystemSettingService, SystemSettingService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddSingleton<IHtmlToPdfService, PuppeteerHtmlToPdfService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IEmailDeliveryLogWriter, EmailDeliveryLogService>();
        services.AddScoped<ICustomerDataResetService, CustomerDataResetService>();

        // Hangfire jobs
        services.AddScoped<AttendanceReconciliationJob>();
        services.AddScoped<BiometricAdmsProcessorJob>();
        services.AddScoped<LeaveAccrualJob>();
        services.AddScoped<PayrollBatchExportJob>();
        services.AddScoped<ReportGenerationJob>();
        services.AddScoped<AnalyticsSnapshotRefreshJob>();
        services.AddScoped<TrainingDueReminderJob>();
        services.AddScoped<DrugTransportLicenseExpiryReminderJob>();
        services.AddScoped<EmployeeBirthdayDigestReminderJob>();
        services.AddScoped<AiDataRetentionJob>();

        return services;
    }
}
