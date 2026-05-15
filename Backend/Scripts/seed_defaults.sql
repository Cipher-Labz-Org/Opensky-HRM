INSERT INTO "OffboardingTaskTemplates" ("Id", "Title", "Category", "SortOrder", "IsActive", "CreatedAt", "IsDeleted")
VALUES
  (gen_random_uuid(), 'Return company laptop / equipment', 'IT & Assets', 2, true, now(), false),
  (gen_random_uuid(), 'Revoke system access & email', 'IT & Assets', 3, true, now(), false),
  (gen_random_uuid(), 'Return ID badge & access cards', 'IT & Assets', 4, true, now(), false),
  (gen_random_uuid(), 'Collect company property (keys, uniforms, etc.)', 'IT & Assets', 5, true, now(), false),
  (gen_random_uuid(), 'Conduct exit interview', 'HR', 6, true, now(), false),
  (gen_random_uuid(), 'Process final pay & benefits settlement', 'Finance', 7, true, now(), false),
  (gen_random_uuid(), 'Settle outstanding expense claims', 'Finance', 8, true, now(), false),
  (gen_random_uuid(), 'Update insurance / benefits termination', 'HR', 9, true, now(), false),
  (gen_random_uuid(), 'Transfer knowledge & handover duties', 'Department', 10, true, now(), false),
  (gen_random_uuid(), 'Remove from org chart & distribution lists', 'HR', 11, true, now(), false),
  (gen_random_uuid(), 'Issue experience / service letter', 'HR', 12, true, now(), false);
