using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateEmploymentStatusEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE \"Employees\" SET \"Status\" = CASE " +
                "WHEN \"Status\" = 'Active' THEN 'FullTimePermanent' " +
                "WHEN \"Status\" = 'Probation' THEN 'FullTimeProbation' " +
                "WHEN \"Status\" = 'Inactive' THEN 'Freelance' " +
                "WHEN \"Status\" = 'OnLeave' THEN 'FullTimePermanent' " +
                "WHEN \"Status\" = 'Terminated' THEN 'FullTimePermanent' " +
                "ELSE 'FullTimePermanent' END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
