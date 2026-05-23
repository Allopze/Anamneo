#!/bin/sh
set -eu

app_password_sql=$(printf "%s" "$ANAMNEO_APP_DB_PASSWORD" | sed "s/'/''/g")
monitor_password_sql=$(printf "%s" "$ANAMNEO_MONITOR_DB_PASSWORD" | sed "s/'/''/g")
database_name_sql=$(printf "%s" "$POSTGRES_DB" | sed "s/'/''/g")
owner_name_sql=$(printf "%s" "$POSTGRES_USER" | sed "s/'/''/g")

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
DO \$\$
DECLARE
  app_password text := '${app_password_sql}';
  monitor_password text := '${monitor_password_sql}';
  database_name text := '${database_name_sql}';
  owner_name text := '${owner_name_sql}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anamneo_app') THEN
    EXECUTE format('CREATE ROLE anamneo_app LOGIN PASSWORD %L', app_password);
  ELSE
    EXECUTE format('ALTER ROLE anamneo_app WITH LOGIN PASSWORD %L', app_password);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anamneo_monitor') THEN
    EXECUTE format('CREATE ROLE anamneo_monitor LOGIN PASSWORD %L', monitor_password);
  ELSE
    EXECUTE format('ALTER ROLE anamneo_monitor WITH LOGIN PASSWORD %L', monitor_password);
  END IF;

  EXECUTE format('ALTER SCHEMA public OWNER TO %I', owner_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO anamneo_app, anamneo_monitor', database_name);
  GRANT USAGE ON SCHEMA public TO anamneo_app, anamneo_monitor;
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anamneo_app', owner_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anamneo_app', owner_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON TABLES TO anamneo_monitor', owner_name);
END
\$\$;
EOSQL
