using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260325140000_AddTrainingAssignments")]
public partial class AddTrainingAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "TrainingAssignments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                AssignedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                AssignedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                DueDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                Status = table.Column<string>(type: "text", nullable: false),
                CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                ScorePercent = table.Column<int>(type: "integer", nullable: true),
                EvidenceUrl = table.Column<string>(type: "text", nullable: true),
                ExternalTranscriptId = table.Column<string>(type: "text", nullable: true),
                Notes = table.Column<string>(type: "text", nullable: true),
                WaiverReason = table.Column<string>(type: "text", nullable: true),
                LastDueReminderSentAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TrainingAssignments", x => x.Id);
                table.ForeignKey(
                    name: "FK_TrainingAssignments_Courses_CourseId",
                    column: x => x.CourseId,
                    principalTable: "Courses",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_TrainingAssignments_Employees_AssignedByEmployeeId",
                    column: x => x.AssignedByEmployeeId,
                    principalTable: "Employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "FK_TrainingAssignments_Employees_EmployeeId",
                    column: x => x.EmployeeId,
                    principalTable: "Employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_TrainingAssignments_AssignedByEmployeeId",
            table: "TrainingAssignments",
            column: "AssignedByEmployeeId");

        migrationBuilder.CreateIndex(
            name: "IX_TrainingAssignments_CourseId",
            table: "TrainingAssignments",
            column: "CourseId");

        migrationBuilder.CreateIndex(
            name: "IX_TrainingAssignments_DueDate",
            table: "TrainingAssignments",
            column: "DueDate");

        migrationBuilder.CreateIndex(
            name: "IX_TrainingAssignments_EmployeeId_CourseId_Status",
            table: "TrainingAssignments",
            columns: new[] { "EmployeeId", "CourseId", "Status" });

        migrationBuilder.CreateIndex(
            name: "IX_Courses_Code",
            table: "Courses",
            column: "Code",
            unique: true,
            filter: "\"IsDeleted\" = false");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Courses_Code",
            table: "Courses");

        migrationBuilder.DropTable(
            name: "TrainingAssignments");
    }
}
