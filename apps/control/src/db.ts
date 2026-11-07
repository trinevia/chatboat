import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function connect(url: string) {
  const sql = postgres(url, { max: 5 });
  return { sql, db: drizzle(sql, { schema }) };
}
export type ControlDB = ReturnType<typeof connect>['db'];
