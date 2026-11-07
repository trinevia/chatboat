import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { connect, type ControlDB } from './db';

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

/** Applies migrations to the `control` schema. Its journal lives in control.__drizzle_migrations,
 * separate from the product's own migrations table. */
export async function runMigrations(db: ControlDB) {
  await migrate(db, { migrationsFolder, migrationsSchema: 'control', migrationsTable: '__drizzle_migrations' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.CONTROL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('CONTROL_DATABASE_URL (or DATABASE_URL) is not set');
  const { sql, db } = connect(url);
  await runMigrations(db);
  await sql.end();
  console.log('control schema migrated');
}
