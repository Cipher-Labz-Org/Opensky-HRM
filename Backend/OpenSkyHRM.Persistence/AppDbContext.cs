using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Employee & Organization
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<BusinessUnit> BusinessUnits => Set<BusinessUnit>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Grade> Grades => Set<Grade>();
    public DbSet<JobTitle> JobTitles => Set<JobTitle>();

    // Leave & Attendance
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeavePolicy> LeavePolicies => Set<LeavePolicy>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<LeaveBalance> LeaveBalances => Set<LeaveBalance>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<RosterTemplate> RosterTemplates => Set<RosterTemplate>();
    public DbSet<ShiftPattern> ShiftPatterns => Set<ShiftPattern>();

    // Recruitment & Onboarding
    public DbSet<Requisition> Requisitions => Set<Requisition>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<Interview> Interviews => Set<Interview>();
    public DbSet<Offer> Offers => Set<Offer>();
    public DbSet<OnboardingTask> OnboardingTasks => Set<OnboardingTask>();
    public DbSet<OnboardingMilestone> OnboardingMilestones => Set<OnboardingMilestone>();

    // Payroll & Compensation
    public DbSet<CompensationComponent> CompensationComponents => Set<CompensationComponent>();
    public DbSet<EmployeeCompensation> EmployeeCompensations => Set<EmployeeCompensation>();
    public DbSet<SalaryRevision> SalaryRevisions => Set<SalaryRevision>();
    public DbSet<PayrollBatch> PayrollBatches => Set<PayrollBatch>();
    public DbSet<PayStatement> PayStatements => Set<PayStatement>();

    // Performance & Learning
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<ReviewCycle> ReviewCycles => Set<ReviewCycle>();
    public DbSet<PerformanceReview> PerformanceReviews => Set<PerformanceReview>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Certification> Certifications => Set<Certification>();
    public DbSet<EmployeeCertification> EmployeeCertifications => Set<EmployeeCertification>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<SkillMatrix> SkillMatrices => Set<SkillMatrix>();
    public DbSet<SuccessionPlan> SuccessionPlans => Set<SuccessionPlan>();

    // Settings & Configuration
    public DbSet<ApprovalWorkflow> ApprovalWorkflows => Set<ApprovalWorkflow>();
    public DbSet<SecurityRole> SecurityRoles => Set<SecurityRole>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<CompanyCalendar> CompanyCalendars => Set<CompanyCalendar>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<NotificationConfig> NotificationConfigs => Set<NotificationConfig>();
    public DbSet<IntegrationConfig> IntegrationConfigs => Set<IntegrationConfig>();

    // Analytics & Reporting
    public DbSet<ReportDefinition> ReportDefinitions => Set<ReportDefinition>();
    public DbSet<ReportSchedule> ReportSchedules => Set<ReportSchedule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .HasQueryFilter(
                        BuildSoftDeleteFilter(entityType.ClrType));
            }
        }
    }

    public override int SaveChanges()
    {
        ApplyAuditInfo();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditInfo();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyAuditInfo()
    {
        var entries = ChangeTracker.Entries<BaseEntity>();
        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private static System.Linq.Expressions.LambdaExpression BuildSoftDeleteFilter(Type entityType)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(entityType, "e");
        var property = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
        var condition = System.Linq.Expressions.Expression.Equal(property,
            System.Linq.Expressions.Expression.Constant(false));
        return System.Linq.Expressions.Expression.Lambda(condition, parameter);
    }
}
