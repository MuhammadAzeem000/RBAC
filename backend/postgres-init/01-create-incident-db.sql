-- Runs once, only when the postgres_data volume is freshly initialized (the
-- official postgres image only executes docker-entrypoint-initdb.d scripts
-- on first init). POSTGRES_DB creates the primary database (rbac_db); this
-- creates incident-service's separate database on the same Postgres server.
-- If you're adding this to an ALREADY-initialized volume, this script won't
-- run automatically — create the database manually instead:
--   docker exec <postgres-container> psql -U <user> -d rbac_db -c "CREATE DATABASE incident_db;"
SELECT 'CREATE DATABASE incident_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'incident_db')\gexec
