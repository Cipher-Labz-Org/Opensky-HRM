-- Optional: link existing departments with no business unit to Head Office (BU-HQ) if present.
UPDATE "Departments" AS d
SET "BusinessUnitId" = bu."Id"
FROM "BusinessUnits" AS bu
WHERE d."BusinessUnitId" IS NULL
  AND bu."Code" = 'BU-HQ'
  AND d."IsDeleted" = false;
