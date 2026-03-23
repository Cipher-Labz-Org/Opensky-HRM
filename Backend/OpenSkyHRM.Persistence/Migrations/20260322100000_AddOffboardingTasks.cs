using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    public partial class AddOffboardingTasks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""OffboardingTasks"" (
                    ""Id"" uuid NOT NULL DEFAULT gen_random_uuid(),
                    ""Title"" character varying(200) NOT NULL,
                    ""Description"" text NULL,
                    ""Category"" character varying(100) NOT NULL,
                    ""IsCompleted"" boolean NOT NULL DEFAULT false,
                    ""DueDate"" timestamp without time zone NULL,
                    ""CompletedAt"" timestamp without time zone NULL,
                    ""SortOrder"" integer NOT NULL DEFAULT 0,
                    ""EmployeeId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp without time zone NOT NULL DEFAULT now(),
                    ""CreatedBy"" text NULL,
                    ""UpdatedAt"" timestamp without time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    CONSTRAINT ""PK_OffboardingTasks"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_OffboardingTasks_Employees_EmployeeId"" FOREIGN KEY (""EmployeeId"") REFERENCES ""Employees"" (""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_OffboardingTasks_EmployeeId"" ON ""OffboardingTasks"" (""EmployeeId"");
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""OffboardingTasks"";");
        }
    }
}
