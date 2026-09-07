using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence;

public class AppDbContext : DbContext
{
    private readonly IBusinessClock _clock;

    public AppDbContext(DbContextOptions<AppDbContext> options, IBusinessClock clock) : base(options)
    {
        _clock = clock;
    }

    // Employee & Organization
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeAttachment> EmployeeAttachments => Set<EmployeeAttachment>();
    public DbSet<EmployeeAttachmentType> EmployeeAttachmentTypes => Set<EmployeeAttachmentType>();
    public DbSet<EmployeeSupervisor> EmployeeSupervisors => Set<EmployeeSupervisor>();
    public DbSet<EmergencyContact> EmergencyContacts => Set<EmergencyContact>();
    public DbSet<Dependent> Dependents => Set<Dependent>();
    public DbSet<Education> Educations => Set<Education>();
    public DbSet<EmployeeSkill> EmployeeSkills => Set<EmployeeSkill>();
    public DbSet<EmployeeLanguage> EmployeeLanguages => Set<EmployeeLanguage>();
    public DbSet<EmployeeBenefit> EmployeeBenefits => Set<EmployeeBenefit>();
    public DbSet<EmployeeDriverLicense> EmployeeDriverLicenses => Set<EmployeeDriverLicense>();
    public DbSet<Immigration> Immigrations => Set<Immigration>();
    public DbSet<ImmigrationDocument> ImmigrationDocuments => Set<ImmigrationDocument>();
    public DbSet<WorkExperience> WorkExperiences => Set<WorkExperience>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
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
    public DbSet<LeaveMonthlyAccrual> LeaveMonthlyAccruals => Set<LeaveMonthlyAccrual>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<LeaveEntitlementRule> LeaveEntitlementRules => Set<LeaveEntitlementRule>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<AttendancePlace> AttendancePlaces => Set<AttendancePlace>();
    public DbSet<OvertimeNopayPeriodApproval> OvertimeNopayPeriodApprovals => Set<OvertimeNopayPeriodApproval>();
    public DbSet<RosterTemplate> RosterTemplates => Set<RosterTemplate>();
    public DbSet<RosterAssignment> RosterAssignments => Set<RosterAssignment>();
    public DbSet<ShiftPattern> ShiftPatterns => Set<ShiftPattern>();
    public DbSet<BiometricDevice> BiometricDevices => Set<BiometricDevice>();
    public DbSet<BiometricRawEvent> BiometricRawEvents => Set<BiometricRawEvent>();
    public DbSet<BiometricPunchEvent> BiometricPunchEvents => Set<BiometricPunchEvent>();
    public DbSet<PunchImportBatch> PunchImportBatches => Set<PunchImportBatch>();

    // Recruitment & Onboarding
    public DbSet<Requisition> Requisitions => Set<Requisition>();
    public DbSet<RequisitionSkillTemplate> RequisitionSkillTemplates => Set<RequisitionSkillTemplate>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<Interview> Interviews => Set<Interview>();
    public DbSet<Offer> Offers => Set<Offer>();
    public DbSet<InterviewScorecard> InterviewScorecards => Set<InterviewScorecard>();
    public DbSet<CandidateActivity> CandidateActivities => Set<CandidateActivity>();
    public DbSet<OnboardingTask> OnboardingTasks => Set<OnboardingTask>();
    public DbSet<OnboardingMilestone> OnboardingMilestones => Set<OnboardingMilestone>();
    public DbSet<OffboardingTask> OffboardingTasks => Set<OffboardingTask>();
    public DbSet<OffboardingTaskTemplate> OffboardingTaskTemplates => Set<OffboardingTaskTemplate>();
    public DbSet<EmployeeTaskTemplate> EmployeeTaskTemplates => Set<EmployeeTaskTemplate>();
    public DbSet<EmployeeTaskTemplateItem> EmployeeTaskTemplateItems => Set<EmployeeTaskTemplateItem>();
    public DbSet<EmploymentStatusType> EmploymentStatusTypes => Set<EmploymentStatusType>();
    public DbSet<EmployeeStatusType> EmployeeStatusTypes => Set<EmployeeStatusType>();

    // Payroll & Compensation
    public DbSet<CompensationComponent> CompensationComponents => Set<CompensationComponent>();
    public DbSet<EmployeeCompensation> EmployeeCompensations => Set<EmployeeCompensation>();
    public DbSet<SalaryRevision> SalaryRevisions => Set<SalaryRevision>();
    public DbSet<PayrollBatch> PayrollBatches => Set<PayrollBatch>();
    public DbSet<PayrollBatchAttendanceSnapshot> PayrollBatchAttendanceSnapshots => Set<PayrollBatchAttendanceSnapshot>();
    public DbSet<PayStatement> PayStatements => Set<PayStatement>();
    public DbSet<PayStatementLine> PayStatementLines => Set<PayStatementLine>();
    public DbSet<PayrollFormula> PayrollFormulas => Set<PayrollFormula>();
    public DbSet<EmployeeApitYearBalance> EmployeeApitYearBalances => Set<EmployeeApitYearBalance>();

    // Performance & Learning
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<ReviewCycle> ReviewCycles => Set<ReviewCycle>();
    public DbSet<PerformanceReview> PerformanceReviews => Set<PerformanceReview>();

    // Appraisal (360-Degree)
    public DbSet<RatingScale> RatingScales => Set<RatingScale>();
    public DbSet<RatingScaleItem> RatingScaleItems => Set<RatingScaleItem>();
    public DbSet<CompetencyCategory> CompetencyCategories => Set<CompetencyCategory>();
    public DbSet<Competency> Competencies => Set<Competency>();
    public DbSet<AppraisalTemplate> AppraisalTemplates => Set<AppraisalTemplate>();
    public DbSet<AppraisalTemplateSection> AppraisalTemplateSections => Set<AppraisalTemplateSection>();
    public DbSet<AppraisalTemplateSectionItem> AppraisalTemplateSectionItems => Set<AppraisalTemplateSectionItem>();
    public DbSet<AppraisalCycle> AppraisalCycles => Set<AppraisalCycle>();
    public DbSet<Appraisal> Appraisals => Set<Appraisal>();
    public DbSet<AppraisalReviewer> AppraisalReviewers => Set<AppraisalReviewer>();
    public DbSet<AppraisalResponseItem> AppraisalResponseItems => Set<AppraisalResponseItem>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Certification> Certifications => Set<Certification>();
    public DbSet<EmployeeCertification> EmployeeCertifications => Set<EmployeeCertification>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<SkillMatrix> SkillMatrices => Set<SkillMatrix>();
    public DbSet<TrainingAssignment> TrainingAssignments => Set<TrainingAssignment>();
    public DbSet<SuccessionPlan> SuccessionPlans => Set<SuccessionPlan>();

    // Settings & Configuration
    public DbSet<ApprovalWorkflow> ApprovalWorkflows => Set<ApprovalWorkflow>();
    public DbSet<SecurityRole> SecurityRoles => Set<SecurityRole>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<UserAssignedLocation> UserAssignedLocations => Set<UserAssignedLocation>();
    public DbSet<UserAssignedBusinessUnit> UserAssignedBusinessUnits => Set<UserAssignedBusinessUnit>();
    public DbSet<UserAssignedGrade> UserAssignedGrades => Set<UserAssignedGrade>();
    public DbSet<UserAssignedJobTitle> UserAssignedJobTitles => Set<UserAssignedJobTitle>();
    public DbSet<CompanyCalendar> CompanyCalendars => Set<CompanyCalendar>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<EmployeeLifecycleEvent> EmployeeLifecycleEvents => Set<EmployeeLifecycleEvent>();
    public DbSet<OutboundEmailLog> OutboundEmailLogs => Set<OutboundEmailLog>();
    public DbSet<NotificationConfig> NotificationConfigs => Set<NotificationConfig>();
    public DbSet<IntegrationConfig> IntegrationConfigs => Set<IntegrationConfig>();

    // Analytics & Reporting
    public DbSet<ReportDefinition> ReportDefinitions => Set<ReportDefinition>();
    public DbSet<ReportSchedule> ReportSchedules => Set<ReportSchedule>();
    public DbSet<AnalyticsSnapshotCache> AnalyticsSnapshotCaches => Set<AnalyticsSnapshotCache>();

    // System
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<DocumentTemplate> DocumentTemplates => Set<DocumentTemplate>();

    // Licensing (per-instance)
    public DbSet<LicensedModule> LicensedModules => Set<LicensedModule>();
    public DbSet<InstanceSubscription> InstanceSubscriptions => Set<InstanceSubscription>();
    public DbSet<InstanceModuleEntitlement> InstanceModuleEntitlements => Set<InstanceModuleEntitlement>();

    // OpenSky AI (AiAssistant)
    public DbSet<AiConversation> AiConversations => Set<AiConversation>();
    public DbSet<AiMessage> AiMessages => Set<AiMessage>();
    public DbSet<AiMessageFeedback> AiMessageFeedbacks => Set<AiMessageFeedback>();
    public DbSet<AiToolAuditLog> AiToolAuditLogs => Set<AiToolAuditLog>();

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
        var now = _clock.Now;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity is OutboundEmailLog emailLog)
                {
                    emailLog.CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
                    emailLog.CreatedAtIsUtc = true;
                }
                else
                {
                    entry.Entity.CreatedAt = now;
                }
            }

            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = now;
        }

        NormalizeDateTimesToUtc();
    }

    /// <summary>
    /// Marks unspecified DateTime values as UTC for Npgsql where appropriate.
    /// Skips <see cref="AuditLog"/> (business-local wall times) and <see cref="BaseEntity.CreatedAt"/> / <see cref="BaseEntity.UpdatedAt"/> (also business local).
    /// </summary>
    private void NormalizeDateTimesToUtc()
    {
        foreach (var entry in ChangeTracker.Entries()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified))
        {
            // Audit + lifecycle use timestamp without time zone / business-local wall dates.
            if (entry.Entity is AuditLog or EmployeeLifecycleEvent)
                continue;

            foreach (var prop in entry.Properties)
            {
                if (prop.Metadata.Name is nameof(BaseEntity.CreatedAt) or nameof(BaseEntity.UpdatedAt))
                    continue;

                // Punch times and attendance dates are business-local wall clock (Asia/Colombo).
                if (entry.Entity is AttendanceRecord
                    && prop.Metadata.Name is nameof(AttendanceRecord.PunchIn)
                        or nameof(AttendanceRecord.PunchOut)
                        or nameof(AttendanceRecord.Date))
                    continue;

                // Last login is timestamp without time zone; UTC Kind cannot be written.
                if (entry.Entity is User && prop.Metadata.Name is nameof(User.LastLoginAt))
                    continue;

                if (prop.CurrentValue is DateTime dt && dt.Kind == DateTimeKind.Unspecified)
                    prop.CurrentValue = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
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
