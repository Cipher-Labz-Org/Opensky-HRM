INSERT INTO "OffboardingTaskTemplates" ("Id", "Title", "Category", "SortOrder", "IsActive", "CreatedAt", "IsDeleted")
SELECT gen_random_uuid(), t.title, t.category, t.sort_order, true, now(), false
FROM (VALUES
  ('Return company laptop / equipment', 'IT & Assets', 1),
  ('Revoke system access & email', 'IT & Assets', 2),
  ('Return ID badge & access cards', 'IT & Assets', 3),
  ('Collect company property (keys, uniforms, etc.)', 'IT & Assets', 4),
  ('Conduct exit interview', 'HR', 5),
  ('Process final pay & benefits settlement', 'Finance', 6),
  ('Settle outstanding expense claims', 'Finance', 7),
  ('Update insurance / benefits termination', 'HR', 8),
  ('Transfer knowledge & handover duties', 'Department', 9),
  ('Remove from org chart & distribution lists', 'HR', 10),
  ('Issue experience / service letter', 'HR', 11)
) AS t(title, category, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "OffboardingTaskTemplates" WHERE "IsDeleted" = false LIMIT 1);
