using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SeedBootstrapAdminUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BCrypt hash of "Admin@123" (work factor 11). Idempotent — safe on every deploy.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    admin_role_id uuid;
                    admin_user_id uuid;
                    admin_password_hash text := '$2a$11$12Qgc1ECPtHk07.wmIsg2uxzHGbiUcO02Gn32MGBb9UvCJc/YkEDG';
                BEGIN
                    ALTER TABLE "Users"
                    ADD COLUMN IF NOT EXISTS "MustChangePassword" boolean NOT NULL DEFAULT false;

                    SELECT "Id" INTO admin_role_id
                    FROM "SecurityRoles"
                    WHERE "Code" = 'ADMIN' AND NOT "IsDeleted"
                    LIMIT 1;

                    IF admin_role_id IS NULL THEN
                        admin_role_id := gen_random_uuid();
                        INSERT INTO "SecurityRoles" (
                            "Id", "Name", "Code", "Description", "IsSystemRole", "CreatedAt", "IsDeleted"
                        ) VALUES (
                            admin_role_id, 'Admin', 'ADMIN', 'Full system access', true, NOW(), false
                        );
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM "Permissions"
                        WHERE "RoleId" = admin_role_id AND NOT "IsDeleted"
                    ) THEN
                        INSERT INTO "Permissions" ("Id", "Module", "Action", "Scope", "RoleId", "CreatedAt", "IsDeleted")
                        SELECT gen_random_uuid(), m.module, a.action, 'All', admin_role_id, NOW(), false
                        FROM unnest(ARRAY[
                            'Dashboard', 'People', 'Leave', 'Attendance', 'Payroll', 'Performance', 'Learning',
                            'OrgStructure', 'Analytics', 'Settings', 'Administration', 'Billing'
                        ]) AS m(module)
                        CROSS JOIN unnest(ARRAY['Create', 'Read', 'Update', 'Delete']) AS a(action);
                    END IF;

                    SELECT "Id" INTO admin_user_id
                    FROM "Users"
                    WHERE LOWER("Username") = 'admin'
                    LIMIT 1;

                    IF admin_user_id IS NULL THEN
                        admin_user_id := gen_random_uuid();
                        INSERT INTO "Users" (
                            "Id", "Username", "Email", "PasswordHash", "IsActive",
                            "MustChangePassword", "CreatedAt", "IsDeleted"
                        ) VALUES (
                            admin_user_id,
                            'Admin',
                            'admin@openskyhrm.com',
                            admin_password_hash,
                            true,
                            false,
                            NOW(),
                            false
                        );
                    ELSE
                        UPDATE "Users"
                        SET
                            "Username" = 'Admin',
                            "IsDeleted" = false,
                            "IsActive" = true,
                            "Email" = CASE
                                WHEN "Email" IS NULL OR btrim("Email") = '' THEN 'admin@openskyhrm.com'
                                ELSE "Email"
                            END,
                            "PasswordHash" = CASE
                                WHEN "PasswordHash" IS NULL OR btrim("PasswordHash") = '' THEN admin_password_hash
                                ELSE "PasswordHash"
                            END
                        WHERE "Id" = admin_user_id;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM "UserRoles"
                        WHERE "UserId" = admin_user_id
                          AND "RoleId" = admin_role_id
                          AND NOT "IsDeleted"
                    ) THEN
                        INSERT INTO "UserRoles" ("Id", "UserId", "RoleId", "CreatedAt", "IsDeleted")
                        VALUES (gen_random_uuid(), admin_user_id, admin_role_id, NOW(), false);
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data seed — no rollback (admin may have been used in production).
        }
    }
}
