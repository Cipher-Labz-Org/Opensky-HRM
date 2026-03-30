SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'openskyhrm_Live' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "openskyhrm_Live";
