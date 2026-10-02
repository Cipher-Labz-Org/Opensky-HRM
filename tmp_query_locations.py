import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    dbname="openskyhrm_dev",
    user="postgres",
    password="postgres",
)
cur = conn.cursor()
cur.execute(
    'SELECT "Name", "Code", "City", "Address" FROM "Locations" WHERE "IsDeleted" = false ORDER BY "Name"'
)
rows = cur.fetchall()
print("LOCATIONS", len(rows))
for r in rows:
    print(r)

cur.execute(
    """
    SELECT "FirstName", "LastName", "EmployeeNumber"
    FROM "Employees"
    WHERE "IsDeleted" = false
      AND (
        "FirstName" ILIKE '%subeth%'
        OR "FirstName" ILIKE '%yogath%'
        OR "LastName" ILIKE '%subeth%'
        OR "LastName" ILIKE '%yogath%'
        OR "FirstName" ILIKE '%akshaya%'
      )
    """
)
print("STAFF")
for r in cur.fetchall():
    print(r)

cur.execute(
    'SELECT "Name", "Code", "Latitude", "Longitude", "LocationId" FROM "AttendancePlaces" WHERE "IsDeleted" = false ORDER BY "Name"'
)
print("PLACES")
for r in cur.fetchall():
    print(r)
conn.close()
