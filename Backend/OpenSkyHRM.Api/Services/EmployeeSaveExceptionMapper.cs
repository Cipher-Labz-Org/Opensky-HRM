using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace OpenSkyHRM.Api.Services;

public static class EmployeeSaveExceptionMapper
{
    public static string Map(DbUpdateException ex)
    {
        for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
        {
            if (inner is not PostgresException pg) continue;

            if (pg.SqlState == "22001")
            {
                return "One or more values exceed the maximum allowed length (employee code, phone, email, etc.).";
            }

            if (pg.SqlState == "23505")
            {
                var detail = pg.MessageText ?? pg.Message ?? "";
                var constraint = pg.ConstraintName ?? "";

                if (constraint.Contains("EmployeeCode", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("IX_Employees_EmployeeCode", StringComparison.OrdinalIgnoreCase)
                    || (detail.Contains("EmployeeCode", StringComparison.OrdinalIgnoreCase)
                        && detail.Contains("unique", StringComparison.OrdinalIgnoreCase)))
                {
                    return "Employee code is already in use (including archived employees). Choose a different code.";
                }

                if (constraint.Contains("Email", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("IX_Employees_Email", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("email", StringComparison.OrdinalIgnoreCase))
                {
                    return "Email is already used by another employee (including archived records). Use a different email.";
                }

                return "Duplicate value conflicts with existing employee data.";
            }

            if (pg.SqlState == "23503")
                return "One of the selected organization values (department, location, etc.) is invalid.";

            if (pg.SqlState == "23502")
            {
                var column = pg.ColumnName ?? "";
                if (column.Contains("Email", StringComparison.OrdinalIgnoreCase))
                    return "Work email could not be saved. Enter an email address or contact your administrator.";
                return "A required employee field is missing. Check department, name, and dates.";
            }

            if (pg.SqlState == "23514")
                return "One or more values are not allowed. Check dates and organization selections.";

            if (pg.SqlState == "22P02")
                return "Invalid data format. Check department and other dropdown selections.";
        }

        return TryMapInnerMessage(ex) ?? "Could not save employee. Check the data and try again.";
    }

    public static string Map(Exception ex)
    {
        if (ex is DbUpdateException db)
            return Map(db);

        for (var inner = ex; inner != null; inner = inner.InnerException!)
        {
            if (inner is PostgresException)
                return Map(new DbUpdateException(inner.Message, inner));

            var msg = inner.Message ?? "";
            if (msg.Contains("timestamp", StringComparison.OrdinalIgnoreCase)
                && msg.Contains("DateTime", StringComparison.OrdinalIgnoreCase))
                return "A date could not be saved. Check date of birth, joined date, and license dates.";
        }

        return TryMapInnerMessage(ex) ?? "Could not save employee. Check the data and try again.";
    }

    private static string? TryMapInnerMessage(Exception ex)
    {
        for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
        {
            if (inner is PostgresException) continue;
            var msg = inner.Message?.Trim();
            if (!string.IsNullOrEmpty(msg)
                && !msg.Contains("See the inner exception", StringComparison.OrdinalIgnoreCase))
            {
                return msg;
            }
        }

        return null;
    }
}
