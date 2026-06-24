using Microsoft.Extensions.DependencyInjection;
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
        services.AddScoped<IShiftService, ShiftService>();
        services.AddScoped<IRosterService, RosterService>();
        services.AddScoped<IBiometricService, BiometricService>();
        services.AddScoped<BiometricAdmsIngestService>();
        services.AddScoped<IRecruitmentService, RecruitmentService>();
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

        return services;
    }
}
