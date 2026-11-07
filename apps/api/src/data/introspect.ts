import type postgres from 'postgres';
import { BIZ_SCHEMA_DOC } from '@chatboat/db/biz-schema-doc';
import { connectExternal, type DataSource, type PgConfig } from './sources';
import { describeCollections, mongoCollectionsFor } from './mongo';

export interface TableInfo {
  schema: string;
  table: string;
  rows: number;
  columns: { name: string; type: string }[];
  /** column -> "schema.table.column" */
  references: Record<string, string>;
}

const SYSTEM_SCHEMAS = `('pg_catalog', 'information_schema', 'pg_toast')`;

/** Every table/view the login can SELECT from, optionally limited to some schemas. */
export async function listTables(sql: postgres.Sql, onlySchemas?: string[]): Promise<TableInfo[]> {
  const schemaFilter = onlySchemas?.length ? sql`AND n.nspname = ANY(${onlySchemas})` : sql``;
  const tables = await sql<{ schema: string; table: string; rows: string }[]>`
    SELECT n.nspname AS schema, c.relname AS table, GREATEST(c.reltuples, 0)::bigint AS rows
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'v', 'm', 'p', 'f')
      AND n.nspname NOT IN ${sql.unsafe(SYSTEM_SCHEMAS)} AND n.nspname NOT LIKE 'pg\\_%'
      AND has_table_privilege(c.oid, 'SELECT') ${schemaFilter}
    ORDER BY 1, 2
    LIMIT 500`;
  if (!tables.length) return [];
  const cols = await sql<{ schema: string; table: string; name: string; type: string }[]>`
    SELECT table_schema AS schema, table_name AS table, column_name AS name, data_type AS type
    FROM information_schema.columns
    WHERE table_schema NOT IN ${sql.unsafe(SYSTEM_SCHEMAS)} ${onlySchemas?.length ? sql`AND table_schema = ANY(${onlySchemas})` : sql``}
    ORDER BY table_schema, table_name, ordinal_position`;
  const fks = await sql<{ schema: string; table: string; col: string; ref: string }[]>`
    SELECT ns.nspname AS schema, cl.relname AS table, a.attname AS col,
           rns.nspname || '.' || rcl.relname || '.' || ra.attname AS ref
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_class rcl ON rcl.oid = con.confrelid JOIN pg_namespace rns ON rns.oid = rcl.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = con.confkey[1]
    WHERE con.contype = 'f' AND cardinality(con.conkey) = 1`;
  const key = (s: string, t: string) => `${s}.${t}`;
  const byTable = new Map<string, TableInfo>(
    tables.map(t => [key(t.schema, t.table), { schema: t.schema, table: t.table, rows: Number(t.rows), columns: [], references: {} }])
  );
  for (const c of cols) byTable.get(key(c.schema, c.table))?.columns.push({ name: c.name, type: c.type });
  for (const f of fks) {
    const t = byTable.get(key(f.schema, f.table));
    if (t) t.references[f.col] = f.ref;
  }
  return [...byTable.values()];
}

/** Compact, prompt-friendly description of the tables. */
export function describeTables(tables: TableInfo[]): string {
  return tables
    .map(t => {
      const cols = t.columns.map(c => {
        const ref = t.references[c.name];
        return `${c.name} ${shortType(c.type)}${ref ? ` -> ${ref}` : ''}`;
      });
      return `${t.schema}.${t.table}(${cols.join(', ')})  -- ~${t.rows.toLocaleString('en-US')} rows`;
    })
    .join('\n');
}

function shortType(t: string) {
  return t
    .replace('character varying', 'text')
    .replace('timestamp without time zone', 'timestamp')
    .replace('timestamp with time zone', 'timestamptz')
    .replace('double precision', 'float');
}

export interface ConnectionCheck {
  ok: boolean;
  error?: string;
  /** True when the login could INSERT/UPDATE/DELETE somewhere. Queries are still forced read-only. */
  canWrite?: boolean;
  isSuperuser?: boolean;
  tables?: TableInfo[];
}

/** Try a connection the admin typed in, without saving it. */
export async function checkConnection(cfg: PgConfig, password: string): Promise<ConnectionCheck> {
  const sql = connectExternal(cfg, password, 1);
  try {
    const [{ superuser }] = await sql<{ superuser: boolean }[]>`
      SELECT rolsuper AS superuser FROM pg_roles WHERE rolname = current_user`;
    const [{ can_write }] = await sql<{ can_write: boolean | null }[]>`
      SELECT bool_or(has_table_privilege(c.oid, 'INSERT') OR has_table_privilege(c.oid, 'UPDATE')
                  OR has_table_privilege(c.oid, 'DELETE') OR has_table_privilege(c.oid, 'TRUNCATE')) AS can_write
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname NOT IN ${sql.unsafe(SYSTEM_SCHEMAS)} AND n.nspname NOT LIKE 'pg\\_%'`;
    const tables = await listTables(sql);
    return { ok: true, canWrite: !!can_write || superuser, isSuperuser: superuser, tables };
  } catch (e) {
    return { ok: false, error: friendlyError(e as Error) };
  } finally {
    await sql.end({ timeout: 2 });
  }
}

function friendlyError(e: Error & { code?: string }) {
  const m = e.message;
  if (e.code === '28P01' || /password authentication/i.test(m)) return 'Wrong username or password.';
  if (e.code === '3D000') return 'That database does not exist.';
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return 'Host not found. Check the host name.';
  if (/ECONNREFUSED/.test(m)) return 'Connection refused. Check the host, port and firewall.';
  if (/timeout|ETIMEDOUT|CONNECT_TIMEOUT/i.test(m)) return 'Connection timed out. Check the host, port and firewall.';
  if (/secure TLS connection|does not support SSL|SSL off/i.test(m)) {
    return "This database doesn't accept SSL connections. Untick “Require SSL” if it's on a private network, or enable SSL on the server.";
  }
  if (/self[- ]signed|certificate/i.test(m)) return `The database's SSL certificate wasn't accepted: ${m}`;
  if (/SSL|ssl/.test(m)) return `SSL problem: ${m}`;
  return m;
}

// ---- Schema text for the prompt, cached per source version ---------------------------

const docCache = new Map<number, { stamp: number; doc: string; tables: TableInfo[] }>();

export async function tablesFor(source: DataSource, pool: () => postgres.Sql): Promise<TableInfo[]> {
  if (source.kind === 'sample') return [];
  const stamp = source.updatedAt.getTime();
  const hit = docCache.get(source.id);
  if (hit?.stamp === stamp) return hit.tables;
  if (source.kind === 'mongodb') {
    const infos = await mongoCollectionsFor(source);
    const tables = infos.map(c => ({
      schema: (source.config as { database: string }).database,
      table: c.name,
      rows: c.documents,
      columns: Object.entries(c.fields).map(([name, types]) => ({ name, type: types.join('|') })),
      references: {},
    }));
    docCache.set(source.id, { stamp, doc: describeCollections(infos), tables });
    return tables;
  }
  let tables: TableInfo[];
  if (source.kind === 'upload') tables = await listTables(pool(), ['uploads']);
  else {
    const allowed = new Set(source.allowedTables.map(t => t.toLowerCase()));
    tables = (await listTables(pool())).filter(t => allowed.has(`${t.schema}.${t.table}`.toLowerCase()));
  }
  docCache.set(source.id, { stamp, doc: describeTables(tables), tables });
  return tables;
}

export async function schemaDocFor(source: DataSource, pool: () => postgres.Sql): Promise<string> {
  if (source.kind === 'sample') return BIZ_SCHEMA_DOC;
  await tablesFor(source, pool);
  return docCache.get(source.id)!.doc;
}

export function forgetSchema(sourceId: number) {
  docCache.delete(sourceId);
}
