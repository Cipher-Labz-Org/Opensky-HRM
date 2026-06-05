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
                if (detail.Contains("IX_Employees_EmployeeCode", StringComparison.OrdinalIgnoreCase)
                    || (detail.Contains("EmployeeCode", StringComparison.OrdinalIgnoreCase)
                        && detail.Contains("unique", StringComparison.OrdinalIgnoreCase)))
                {
                    return "Employee code is already in use (including archived employees). Choose a different code.";
                }

                if (detail.Contains("IX_Employees_Email", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("email", StringComparison.OrdinalIgnoreCase))
                {
                    return "Email is already used by another employee (including archived records). Use a different email.";
                }

                return "Duplicate value conflicts with existing employee data.";
            }

            if (pg.SqlState == "23503")
                return "One of the selected organization values (department, location, etc.) is invalid.";
        }

        return "Could not save employee. Check the data and try again.";
    }
}
