using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace OpenSkyHRM.Api.Services;

public static class UserSaveExceptionMapper
{
    public static string Map(DbUpdateException ex)
    {
        for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
        {
            if (inner is not PostgresException pg) continue;

            if (pg.SqlState == "23505")
            {
                var detail = pg.MessageText ?? pg.Message ?? "";
                if (detail.Contains("IX_Users_Username", StringComparison.OrdinalIgnoreCase)
                    || (detail.Contains("Username", StringComparison.OrdinalIgnoreCase)
                        && detail.Contains("unique", StringComparison.OrdinalIgnoreCase)))
                {
                    return "Username is already in use (including archived accounts). Choose a different username.";
                }

                if (detail.Contains("IX_Users_Email", StringComparison.OrdinalIgnoreCase)
                    || (detail.Contains("Email", StringComparison.OrdinalIgnoreCase)
                        && detail.Contains("unique", StringComparison.OrdinalIgnoreCase)))
                {
                    return "Email is already in use (including archived accounts). Choose a different email.";
                }

                if (detail.Contains("IX_UserRoles_UserId_RoleId", StringComparison.OrdinalIgnoreCase))
                    return "This user already has one of the selected roles.";

                return "Duplicate value conflicts with existing user data.";
            }

            if (pg.SqlState == "23503")
                return "One of the selected roles or linked employee records is invalid.";
        }

        return "Could not save user. Check the details and try again.";
    }
}
