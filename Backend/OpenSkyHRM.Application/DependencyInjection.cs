using Microsoft.Extensions.DependencyInjection;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Jobs;
using OpenSkyHRM.Application.Services;

namespace OpenSkyHRM.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IEmployeeService, EmployeeService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<ILeaveService, LeaveService>();
        services.AddScoped<IAttendanceService, AttendanceService>();
        services.AddScoped<IRecruitmentService, RecruitmentService>();
        services.AddScoped<IOnboardingService, OnboardingService>();
        services.AddScoped<IPayrollService, PayrollService>();
        services.AddScoped<IPerformanceService, PerformanceService>();
        services.AddScoped<ILearningService, LearningService>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();

        // Hangfire jobs
        services.AddScoped<AttendanceReconciliationJob>();
        services.AddScoped<PayrollBatchExportJob>();
        services.AddScoped<ReportGenerationJob>();

        return services;
    }
}
