using System.Linq;

namespace OpenSkyHRM.Application.Resetting;

public static class CustomerDataResetSqlBuilder
{
    public static string BuildTransactionTruncateSql(string[] tables, bool cascade = false)
    {
        var truncateTables = string.Join(", ", tables.Select(t => $"\"{t}\""));
        return cascade
            ? $"TRUNCATE TABLE {truncateTables} RESTART IDENTITY CASCADE;"
            : $"TRUNCATE TABLE {truncateTables} RESTART IDENTITY;";
    }

    // Truncates all base tables in the Hangfire schema variants, if present.
    // This avoids hardcoding Hangfire's internal table list for PostgreSQL.
    public static string BuildHangfirePurgeSql()
    {
        return @"
DO $$
DECLARE s text;
DECLARE stmt text;
BEGIN
  FOREACH s IN ARRAY ARRAY['Hangfire','hangfire'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      SELECT
        'TRUNCATE TABLE ' ||
        string_agg(format('%I.%I', table_schema, table_name), ', ') ||
        ' RESTART IDENTITY CASCADE;'
      INTO stmt
      FROM information_schema.tables
      WHERE table_schema = s
        AND table_type = 'BASE TABLE';

      IF stmt IS NOT NULL THEN
        EXECUTE stmt;
      END IF;
    END IF;
  END LOOP;
END $$;";
    }
}

