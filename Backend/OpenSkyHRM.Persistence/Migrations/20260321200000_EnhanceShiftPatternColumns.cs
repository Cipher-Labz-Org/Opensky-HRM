using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    public partial class EnhanceShiftPatternColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use raw SQL with IF NOT EXISTS so this is safe to run
            // even if some columns were already added via manual scripts.
            migrationBuilder.Sql(@"
                ALTER TABLE ""ShiftPatterns""
                    ADD COLUMN IF NOT EXISTS ""ShiftType"" character varying(20) NOT NULL DEFAULT 'Regular',
                    ADD COLUMN IF NOT EXISTS ""Session2StartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""Session2EndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""FlexiWindowStart"" interval,
                    ADD COLUMN IF NOT EXISTS ""FlexiWindowEnd"" interval,
                    ADD COLUMN IF NOT EXISTS ""MinimumWorkHours"" numeric,
                    ADD COLUMN IF NOT EXISTS ""LateGraceMinutes"" integer NOT NULL DEFAULT 5,
                    ADD COLUMN IF NOT EXISTS ""EarlyDepartureGraceMinutes"" integer NOT NULL DEFAULT 5,
                    ADD COLUMN IF NOT EXISTS ""HalfDayHours"" integer NOT NULL DEFAULT 4,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnMonday"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnTuesday"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnWednesday"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnThursday"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnFriday"" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnSaturday"" boolean NOT NULL DEFAULT false,
                    ADD COLUMN IF NOT EXISTS ""AppliesOnSunday"" boolean NOT NULL DEFAULT false,
                    ADD COLUMN IF NOT EXISTS ""MondayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""MondayEndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""TuesdayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""TuesdayEndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""WednesdayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""WednesdayEndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""ThursdayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""ThursdayEndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""FridayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""FridayEndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""SaturdayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""SaturdayEndTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""SundayStartTime"" interval,
                    ADD COLUMN IF NOT EXISTS ""SundayEndTime"" interval;

                -- Drop old half-day boolean columns if they exist
                ALTER TABLE ""ShiftPatterns""
                    DROP COLUMN IF EXISTS ""HalfDayMonday"",
                    DROP COLUMN IF EXISTS ""HalfDayTuesday"",
                    DROP COLUMN IF EXISTS ""HalfDayWednesday"",
                    DROP COLUMN IF EXISTS ""HalfDayThursday"",
                    DROP COLUMN IF EXISTS ""HalfDayFriday"",
                    DROP COLUMN IF EXISTS ""HalfDaySaturday"",
                    DROP COLUMN IF EXISTS ""HalfDaySunday"";
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""ShiftPatterns""
                    DROP COLUMN IF EXISTS ""ShiftType"",
                    DROP COLUMN IF EXISTS ""Session2StartTime"",
                    DROP COLUMN IF EXISTS ""Session2EndTime"",
                    DROP COLUMN IF EXISTS ""FlexiWindowStart"",
                    DROP COLUMN IF EXISTS ""FlexiWindowEnd"",
                    DROP COLUMN IF EXISTS ""MinimumWorkHours"",
                    DROP COLUMN IF EXISTS ""LateGraceMinutes"",
                    DROP COLUMN IF EXISTS ""EarlyDepartureGraceMinutes"",
                    DROP COLUMN IF EXISTS ""HalfDayHours"",
                    DROP COLUMN IF EXISTS ""AppliesOnMonday"",
                    DROP COLUMN IF EXISTS ""AppliesOnTuesday"",
                    DROP COLUMN IF EXISTS ""AppliesOnWednesday"",
                    DROP COLUMN IF EXISTS ""AppliesOnThursday"",
                    DROP COLUMN IF EXISTS ""AppliesOnFriday"",
                    DROP COLUMN IF EXISTS ""AppliesOnSaturday"",
                    DROP COLUMN IF EXISTS ""AppliesOnSunday"",
                    DROP COLUMN IF EXISTS ""MondayStartTime"",
                    DROP COLUMN IF EXISTS ""MondayEndTime"",
                    DROP COLUMN IF EXISTS ""TuesdayStartTime"",
                    DROP COLUMN IF EXISTS ""TuesdayEndTime"",
                    DROP COLUMN IF EXISTS ""WednesdayStartTime"",
                    DROP COLUMN IF EXISTS ""WednesdayEndTime"",
                    DROP COLUMN IF EXISTS ""ThursdayStartTime"",
                    DROP COLUMN IF EXISTS ""ThursdayEndTime"",
                    DROP COLUMN IF EXISTS ""FridayStartTime"",
                    DROP COLUMN IF EXISTS ""FridayEndTime"",
                    DROP COLUMN IF EXISTS ""SaturdayStartTime"",
                    DROP COLUMN IF EXISTS ""SaturdayEndTime"",
                    DROP COLUMN IF EXISTS ""SundayStartTime"",
                    DROP COLUMN IF EXISTS ""SundayEndTime"";
            ");
        }
    }
}
