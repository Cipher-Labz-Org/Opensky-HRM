using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnhancePayrollModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""EmployeeCompensations"" DROP CONSTRAINT IF EXISTS ""FK_EmployeeCompensations_CompensationComponents_ComponentId""");
            migrationBuilder.Sql(@"ALTER TABLE ""PayStatements"" DROP CONSTRAINT IF EXISTS ""FK_PayStatements_Employees_EmployeeId""");
            migrationBuilder.Sql(@"ALTER TABLE ""PayStatements"" DROP CONSTRAINT IF EXISTS ""FK_PayStatements_PayrollBatches_BatchId""");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_PayStatements_EmployeeId""");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_LeaveMonthlyAccruals_EmployeeId""");
            migrationBuilder.Sql(@"ALTER TABLE ""PayStatements"" DROP COLUMN IF EXISTS ""Deductions""");
            migrationBuilder.Sql(@"ALTER TABLE ""ShiftPatterns"" ALTER COLUMN ""ShiftType"" TYPE text");

            migrationBuilder.Sql(@"ALTER TABLE ""SalaryRevisions"" ADD COLUMN IF NOT EXISTS ""ApprovedAt"" timestamp without time zone");
            migrationBuilder.Sql(@"ALTER TABLE ""SalaryRevisions"" ADD COLUMN IF NOT EXISTS ""ApprovedBy"" text");
            migrationBuilder.Sql(@"ALTER TABLE ""SalaryRevisions"" ADD COLUMN IF NOT EXISTS ""Remarks"" text");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""ClosedAt"" timestamp without time zone");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""EmploymentType"" text");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""ExperienceMax"" integer");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""ExperienceMin"" integer");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""LocationId"" uuid");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""PositionId"" uuid");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""SalaryMax"" numeric");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""SalaryMin"" numeric");
            migrationBuilder.Sql(@"ALTER TABLE ""Requisitions"" ADD COLUMN IF NOT EXISTS ""Skills"" text");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "PayStatements",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<decimal>(
                name: "NetPay",
                table: "PayStatements",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<decimal>(
                name: "GrossPay",
                table: "PayStatements",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<string>(
                name: "Currency",
                table: "PayStatements",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "LKR",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<Guid>(
                name: "BatchId",
                table: "PayStatements",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BasicPay",
                table: "PayStatements",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "EmployerCost",
                table: "PayStatements",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalDeductions",
                table: "PayStatements",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalEarnings",
                table: "PayStatements",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalNet",
                table: "PayrollBatches",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalGross",
                table: "PayrollBatches",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "PayrollBatches",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "BatchCode",
                table: "PayrollBatches",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                table: "PayrollBatches",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "PayrollBatches",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalDeductions",
                table: "PayrollBatches",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalEmployerCost",
                table: "PayrollBatches",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "OnboardingTasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "Offers",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "Offers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "JobTitleId",
                table: "Offers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "JoiningDate",
                table: "Offers",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferLetterUrl",
                table: "Offers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PositionId",
                table: "Offers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                table: "Offers",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Offers",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "OffboardingTaskTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "OffboardingTaskTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "OffboardingTaskTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "OffboardingTasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "OffboardingTasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "OffboardingTasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<int>(
                name: "Duration",
                table: "Interviews",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "InterviewerId",
                table: "Interviews",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Interviews",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverallRating",
                table: "Interviews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Recommendation",
                table: "Interviews",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Interviews",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "Interviews",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "AppraisalCycleId",
                table: "Goals",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ManagerRating",
                table: "Goals",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SelfRating",
                table: "Goals",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "EmployeeTaskTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "EmployeeTaskTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "EmployeeTaskTemplateItems",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "EmployeeTaskTemplateItems",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "EmployeeTaskTemplateItems",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "TerminationReason",
                table: "Employees",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Currency",
                table: "EmployeeCompensations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "LKR",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "EmployeeCompensations",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "EmployeeCompensations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "CompensationComponents",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "CompensationComponents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "CompensationComponents",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                table: "CompensationComponents",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "CompensationComponents",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DependsOnComponentCode",
                table: "CompensationComponents",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FormulaExpression",
                table: "CompensationComponents",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsEmployerContribution",
                table: "CompensationComponents",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "CompensationComponents",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "AppliedAt",
                table: "Candidates",
                type: "timestamp without time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "CurrentCompany",
                table: "Candidates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentTitle",
                table: "Candidates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EmployeeId",
                table: "Candidates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExpectedSalary",
                table: "Candidates",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Candidates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NoticePeriod",
                table: "Candidates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Rating",
                table: "Candidates",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Candidates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tags",
                table: "Candidates",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CandidateActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityType = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PerformedBy = table.Column<string>(type: "text", nullable: true),
                    PerformedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateActivities_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CompetencyCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompetencyCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InterviewScorecards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Criteria = table.Column<string>(type: "text", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: true),
                    InterviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewScorecards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewScorecards_Interviews_InterviewId",
                        column: x => x.InterviewId,
                        principalTable: "Interviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PayrollFormulas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ComponentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Expression = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollFormulas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollFormulas_CompensationComponents_ComponentId",
                        column: x => x.ComponentId,
                        principalTable: "CompensationComponents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PayStatementLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayStatementId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComponentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComponentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ComponentCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    IsEmployerContribution = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayStatementLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayStatementLines_CompensationComponents_ComponentId",
                        column: x => x.ComponentId,
                        principalTable: "CompensationComponents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayStatementLines_PayStatements_PayStatementId",
                        column: x => x.PayStatementId,
                        principalTable: "PayStatements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RatingScales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatingScales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Competencies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Competencies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Competencies_CompetencyCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "CompetencyCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppraisalTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RatingScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraisalTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppraisalTemplates_RatingScales_RatingScaleId",
                        column: x => x.RatingScaleId,
                        principalTable: "RatingScales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RatingScaleItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    RatingScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatingScaleItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RatingScaleItems_RatingScales_RatingScaleId",
                        column: x => x.RatingScaleId,
                        principalTable: "RatingScales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppraisalCycles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CycleType = table.Column<string>(type: "text", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Phase = table.Column<string>(type: "text", nullable: false),
                    IncludeSelfAssessment = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeManagerReview = table.Column<bool>(type: "boolean", nullable: false),
                    IncludePeerReview = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeDirectReportReview = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeExternalReview = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeGoals = table.Column<bool>(type: "boolean", nullable: false),
                    SelfWeight = table.Column<int>(type: "integer", nullable: false),
                    ManagerWeight = table.Column<int>(type: "integer", nullable: false),
                    PeerWeight = table.Column<int>(type: "integer", nullable: false),
                    DirectReportWeight = table.Column<int>(type: "integer", nullable: false),
                    ExternalWeight = table.Column<int>(type: "integer", nullable: false),
                    SelfDeadline = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ManagerDeadline = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    PeerDeadline = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CompletionDeadline = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraisalCycles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppraisalCycles_AppraisalTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "AppraisalTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppraisalTemplateSections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Weight = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraisalTemplateSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppraisalTemplateSections_AppraisalTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "AppraisalTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Appraisals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    FinalRating = table.Column<decimal>(type: "numeric", nullable: true),
                    FinalComments = table.Column<string>(type: "text", nullable: true),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AcknowledgementComment = table.Column<string>(type: "text", nullable: true),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Appraisals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Appraisals_AppraisalCycles_CycleId",
                        column: x => x.CycleId,
                        principalTable: "AppraisalCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Appraisals_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppraisalTemplateSectionItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Weight = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    SectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompetencyId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraisalTemplateSectionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppraisalTemplateSectionItems_AppraisalTemplateSections_Sec~",
                        column: x => x.SectionId,
                        principalTable: "AppraisalTemplateSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AppraisalTemplateSectionItems_Competencies_CompetencyId",
                        column: x => x.CompetencyId,
                        principalTable: "Competencies",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AppraisalReviewers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerType = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    OverallRating = table.Column<decimal>(type: "numeric", nullable: true),
                    OverallComments = table.Column<string>(type: "text", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AppraisalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraisalReviewers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppraisalReviewers_Appraisals_AppraisalId",
                        column: x => x.AppraisalId,
                        principalTable: "Appraisals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AppraisalReviewers_Employees_ReviewerEmployeeId",
                        column: x => x.ReviewerEmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppraisalResponseItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingValue = table.Column<int>(type: "integer", nullable: true),
                    Comment = table.Column<string>(type: "text", nullable: true),
                    ReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateSectionItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraisalResponseItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppraisalResponseItems_AppraisalReviewers_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "AppraisalReviewers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AppraisalResponseItems_AppraisalTemplateSectionItems_Templa~",
                        column: x => x.TemplateSectionItemId,
                        principalTable: "AppraisalTemplateSectionItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RosterAssignments_RosterTemplateId",
                table: "RosterAssignments",
                column: "RosterTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_Requisitions_LocationId",
                table: "Requisitions",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_Requisitions_PositionId",
                table: "Requisitions",
                column: "PositionId");

            migrationBuilder.CreateIndex(
                name: "IX_PayStatements_EmployeeId_Year_Month",
                table: "PayStatements",
                columns: new[] { "EmployeeId", "Year", "Month" });

            migrationBuilder.CreateIndex(
                name: "IX_PayrollBatches_Year_Month",
                table: "PayrollBatches",
                columns: new[] { "Year", "Month" });

            migrationBuilder.CreateIndex(
                name: "IX_Offers_DepartmentId",
                table: "Offers",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Offers_JobTitleId",
                table: "Offers",
                column: "JobTitleId");

            migrationBuilder.CreateIndex(
                name: "IX_Offers_PositionId",
                table: "Offers",
                column: "PositionId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_Level1ApproverId",
                table: "LeaveRequests",
                column: "Level1ApproverId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_Level2ApproverId",
                table: "LeaveRequests",
                column: "Level2ApproverId");

            migrationBuilder.CreateIndex(
                name: "IX_Interviews_InterviewerId",
                table: "Interviews",
                column: "InterviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_Goals_AppraisalCycleId",
                table: "Goals",
                column: "AppraisalCycleId");

            migrationBuilder.CreateIndex(
                name: "IX_CompensationComponents_Code",
                table: "CompensationComponents",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_EmployeeId",
                table: "Candidates",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalCycles_TemplateId",
                table: "AppraisalCycles",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalResponseItems_ReviewerId",
                table: "AppraisalResponseItems",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalResponseItems_TemplateSectionItemId",
                table: "AppraisalResponseItems",
                column: "TemplateSectionItemId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalReviewers_AppraisalId",
                table: "AppraisalReviewers",
                column: "AppraisalId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalReviewers_ReviewerEmployeeId",
                table: "AppraisalReviewers",
                column: "ReviewerEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_Appraisals_CycleId",
                table: "Appraisals",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_Appraisals_EmployeeId",
                table: "Appraisals",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalTemplates_RatingScaleId",
                table: "AppraisalTemplates",
                column: "RatingScaleId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalTemplateSectionItems_CompetencyId",
                table: "AppraisalTemplateSectionItems",
                column: "CompetencyId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalTemplateSectionItems_SectionId",
                table: "AppraisalTemplateSectionItems",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_AppraisalTemplateSections_TemplateId",
                table: "AppraisalTemplateSections",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateActivities_CandidateId",
                table: "CandidateActivities",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_Competencies_CategoryId",
                table: "Competencies",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewScorecards_InterviewId",
                table: "InterviewScorecards",
                column: "InterviewId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollFormulas_ComponentId",
                table: "PayrollFormulas",
                column: "ComponentId");

            migrationBuilder.CreateIndex(
                name: "IX_PayStatementLines_ComponentId",
                table: "PayStatementLines",
                column: "ComponentId");

            migrationBuilder.CreateIndex(
                name: "IX_PayStatementLines_PayStatementId",
                table: "PayStatementLines",
                column: "PayStatementId");

            migrationBuilder.CreateIndex(
                name: "IX_RatingScaleItems_RatingScaleId",
                table: "RatingScaleItems",
                column: "RatingScaleId");

            migrationBuilder.AddForeignKey(
                name: "FK_Candidates_Employees_EmployeeId",
                table: "Candidates",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeCompensations_CompensationComponents_ComponentId",
                table: "EmployeeCompensations",
                column: "ComponentId",
                principalTable: "CompensationComponents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Goals_AppraisalCycles_AppraisalCycleId",
                table: "Goals",
                column: "AppraisalCycleId",
                principalTable: "AppraisalCycles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Interviews_Employees_InterviewerId",
                table: "Interviews",
                column: "InterviewerId",
                principalTable: "Employees",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_Employees_Level1ApproverId",
                table: "LeaveRequests",
                column: "Level1ApproverId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_Employees_Level2ApproverId",
                table: "LeaveRequests",
                column: "Level2ApproverId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Offers_Departments_DepartmentId",
                table: "Offers",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Offers_JobTitles_JobTitleId",
                table: "Offers",
                column: "JobTitleId",
                principalTable: "JobTitles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Offers_Positions_PositionId",
                table: "Offers",
                column: "PositionId",
                principalTable: "Positions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PayStatements_Employees_EmployeeId",
                table: "PayStatements",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PayStatements_PayrollBatches_BatchId",
                table: "PayStatements",
                column: "BatchId",
                principalTable: "PayrollBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Requisitions_Locations_LocationId",
                table: "Requisitions",
                column: "LocationId",
                principalTable: "Locations",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Requisitions_Positions_PositionId",
                table: "Requisitions",
                column: "PositionId",
                principalTable: "Positions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Candidates_Employees_EmployeeId",
                table: "Candidates");

            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeCompensations_CompensationComponents_ComponentId",
                table: "EmployeeCompensations");

            migrationBuilder.DropForeignKey(
                name: "FK_Goals_AppraisalCycles_AppraisalCycleId",
                table: "Goals");

            migrationBuilder.DropForeignKey(
                name: "FK_Interviews_Employees_InterviewerId",
                table: "Interviews");

            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_Employees_Level1ApproverId",
                table: "LeaveRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_Employees_Level2ApproverId",
                table: "LeaveRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_Offers_Departments_DepartmentId",
                table: "Offers");

            migrationBuilder.DropForeignKey(
                name: "FK_Offers_JobTitles_JobTitleId",
                table: "Offers");

            migrationBuilder.DropForeignKey(
                name: "FK_Offers_Positions_PositionId",
                table: "Offers");

            migrationBuilder.DropForeignKey(
                name: "FK_PayStatements_Employees_EmployeeId",
                table: "PayStatements");

            migrationBuilder.DropForeignKey(
                name: "FK_PayStatements_PayrollBatches_BatchId",
                table: "PayStatements");

            migrationBuilder.DropForeignKey(
                name: "FK_Requisitions_Locations_LocationId",
                table: "Requisitions");

            migrationBuilder.DropForeignKey(
                name: "FK_Requisitions_Positions_PositionId",
                table: "Requisitions");

            migrationBuilder.DropTable(
                name: "AppraisalResponseItems");

            migrationBuilder.DropTable(
                name: "CandidateActivities");

            migrationBuilder.DropTable(
                name: "InterviewScorecards");

            migrationBuilder.DropTable(
                name: "PayrollFormulas");

            migrationBuilder.DropTable(
                name: "PayStatementLines");

            migrationBuilder.DropTable(
                name: "RatingScaleItems");

            migrationBuilder.DropTable(
                name: "AppraisalReviewers");

            migrationBuilder.DropTable(
                name: "AppraisalTemplateSectionItems");

            migrationBuilder.DropTable(
                name: "Appraisals");

            migrationBuilder.DropTable(
                name: "AppraisalTemplateSections");

            migrationBuilder.DropTable(
                name: "Competencies");

            migrationBuilder.DropTable(
                name: "AppraisalCycles");

            migrationBuilder.DropTable(
                name: "CompetencyCategories");

            migrationBuilder.DropTable(
                name: "AppraisalTemplates");

            migrationBuilder.DropTable(
                name: "RatingScales");

            migrationBuilder.DropIndex(
                name: "IX_RosterAssignments_RosterTemplateId",
                table: "RosterAssignments");

            migrationBuilder.DropIndex(
                name: "IX_Requisitions_LocationId",
                table: "Requisitions");

            migrationBuilder.DropIndex(
                name: "IX_Requisitions_PositionId",
                table: "Requisitions");

            migrationBuilder.DropIndex(
                name: "IX_PayStatements_EmployeeId_Year_Month",
                table: "PayStatements");

            migrationBuilder.DropIndex(
                name: "IX_PayrollBatches_Year_Month",
                table: "PayrollBatches");

            migrationBuilder.DropIndex(
                name: "IX_Offers_DepartmentId",
                table: "Offers");

            migrationBuilder.DropIndex(
                name: "IX_Offers_JobTitleId",
                table: "Offers");

            migrationBuilder.DropIndex(
                name: "IX_Offers_PositionId",
                table: "Offers");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_Level1ApproverId",
                table: "LeaveRequests");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_Level2ApproverId",
                table: "LeaveRequests");

            migrationBuilder.DropIndex(
                name: "IX_Interviews_InterviewerId",
                table: "Interviews");

            migrationBuilder.DropIndex(
                name: "IX_Goals_AppraisalCycleId",
                table: "Goals");

            migrationBuilder.DropIndex(
                name: "IX_CompensationComponents_Code",
                table: "CompensationComponents");

            migrationBuilder.DropIndex(
                name: "IX_Candidates_EmployeeId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "SalaryRevisions");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "SalaryRevisions");

            migrationBuilder.DropColumn(
                name: "Remarks",
                table: "SalaryRevisions");

            migrationBuilder.DropColumn(
                name: "ClosedAt",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "ExperienceMax",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "ExperienceMin",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "PositionId",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "SalaryMax",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "SalaryMin",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "Skills",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "BasicPay",
                table: "PayStatements");

            migrationBuilder.DropColumn(
                name: "EmployerCost",
                table: "PayStatements");

            migrationBuilder.DropColumn(
                name: "TotalDeductions",
                table: "PayStatements");

            migrationBuilder.DropColumn(
                name: "TotalEarnings",
                table: "PayStatements");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "PayrollBatches");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "PayrollBatches");

            migrationBuilder.DropColumn(
                name: "TotalDeductions",
                table: "PayrollBatches");

            migrationBuilder.DropColumn(
                name: "TotalEmployerCost",
                table: "PayrollBatches");

            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "JobTitleId",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "JoiningDate",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "OfferLetterUrl",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "PositionId",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "RejectedAt",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "Duration",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "InterviewerId",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "OverallRating",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Recommendation",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "AppraisalCycleId",
                table: "Goals");

            migrationBuilder.DropColumn(
                name: "ManagerRating",
                table: "Goals");

            migrationBuilder.DropColumn(
                name: "SelfRating",
                table: "Goals");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "EmployeeCompensations");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "CompensationComponents");

            migrationBuilder.DropColumn(
                name: "DependsOnComponentCode",
                table: "CompensationComponents");

            migrationBuilder.DropColumn(
                name: "FormulaExpression",
                table: "CompensationComponents");

            migrationBuilder.DropColumn(
                name: "IsEmployerContribution",
                table: "CompensationComponents");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "CompensationComponents");

            migrationBuilder.DropColumn(
                name: "AppliedAt",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "CurrentCompany",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "CurrentTitle",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "ExpectedSalary",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "NoticePeriod",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Rating",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Candidates");

            migrationBuilder.AlterColumn<string>(
                name: "ShiftType",
                table: "ShiftPatterns",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "PayStatements",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<decimal>(
                name: "NetPay",
                table: "PayStatements",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "GrossPay",
                table: "PayStatements",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<string>(
                name: "Currency",
                table: "PayStatements",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10,
                oldDefaultValue: "LKR");

            migrationBuilder.AlterColumn<Guid>(
                name: "BatchId",
                table: "PayStatements",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<decimal>(
                name: "Deductions",
                table: "PayStatements",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalNet",
                table: "PayrollBatches",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalGross",
                table: "PayrollBatches",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "PayrollBatches",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "BatchCode",
                table: "PayrollBatches",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "OnboardingTasks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "OffboardingTaskTemplates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "OffboardingTaskTemplates",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "OffboardingTaskTemplates",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "OffboardingTasks",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "OffboardingTasks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "OffboardingTasks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "EmployeeTaskTemplates",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "EmployeeTaskTemplates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "EmployeeTaskTemplateItems",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "EmployeeTaskTemplateItems",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "AssignmentType",
                table: "EmployeeTaskTemplateItems",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "TerminationReason",
                table: "Employees",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Currency",
                table: "EmployeeCompensations",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10,
                oldDefaultValue: "LKR");

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "EmployeeCompensations",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "CompensationComponents",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "CompensationComponents",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "CompensationComponents",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                table: "CompensationComponents",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.CreateIndex(
                name: "IX_PayStatements_EmployeeId",
                table: "PayStatements",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveMonthlyAccruals_EmployeeId",
                table: "LeaveMonthlyAccruals",
                column: "EmployeeId");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeCompensations_CompensationComponents_ComponentId",
                table: "EmployeeCompensations",
                column: "ComponentId",
                principalTable: "CompensationComponents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PayStatements_Employees_EmployeeId",
                table: "PayStatements",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PayStatements_PayrollBatches_BatchId",
                table: "PayStatements",
                column: "BatchId",
                principalTable: "PayrollBatches",
                principalColumn: "Id");
        }
    }
}
