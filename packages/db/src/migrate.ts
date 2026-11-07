import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

// Password for the read-only role, taken from ANALYST_DATABASE_URL so there is one source of truth.
const analystPassword = decodeURIComponent(
  new URL(process.env.ANALYST_DATABASE_URL ?? 'postgres://analyst_ro:analyst_ro@x/y').password
);

const client = postgres(url, { max: 1, onnotice: () => {} });

await migrate(drizzle(client), { migrationsFolder: path.join(here, '../migrations') });

// Read-only role used by the AI: SELECT on biz only, no access to app.
await client.unsafe(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analyst_ro') THEN
    CREATE ROLE analyst_ro LOGIN;
  END IF;
END $$;
`);
await client.unsafe(`ALTER ROLE analyst_ro WITH LOGIN PASSWORD '${analystPassword.replace(/'/g, "''")}'`);
await client.unsafe(`
ALTER ROLE analyst_ro SET statement_timeout = '5s';
ALTER ROLE analyst_ro SET default_transaction_read_only = on;
REVOKE ALL ON SCHEMA app FROM analyst_ro;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM analyst_ro;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA biz TO analyst_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA biz TO analyst_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA biz GRANT SELECT ON TABLES TO analyst_ro;
`);

console.log('Migrations applied and analyst_ro role configured.');
await client.end();
