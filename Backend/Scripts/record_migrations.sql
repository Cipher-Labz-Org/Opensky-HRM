INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260322000000_AddTerminationReasonNote', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260322100000_AddOffboardingTasks', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
