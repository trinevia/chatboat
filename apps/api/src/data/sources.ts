import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { db, schema } from '@chatboat/db';
import type { Row } from '@chatboat/shared';
import { guardSql, limitSql, type GuardOptions } from '../ai/sql-guard';
import { decrypt } from './crypto';

const { dataSource } = schema;
export type DataSource = typeof dataSource.$inferSelect;

export interface PgConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
}

const QUERY_TIMEOUT_MS = 5000;

/** numeric/bigint arrive as strings by default; charts need numbers. */
const numberTypes = {
  numeric: { to: 1700, from: [1700, 20], serialize: String, parse: (v: string) => Number(v) },
};

function normalizeRow(row: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v === 'number' || typeof v === 'string') out[k] = v;
    else if (typeof v === 'bigint') out[k] = Number(v);
    else if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
    else out[k] = String(v);
  }
  return out;
}

// ---- Connections ---------------------------------------------------------------

/** Our own read-only role: serves the sample data (biz) and uploaded files (uploads). */
let analystPool: postgres.Sql | undefined;
function analyst() {
  const url = process.env.ANALYST_DATABASE_URL;
  if (!url) throw new Error('ANALYST_DATABASE_URL is not set');
  analystPool ??= postgres(url, { max: 5, types: numberTypes, connection: { statement_timeout: QUERY_TIMEOUT_MS } });
  return analystPool;
}

export function connectExternal(cfg: PgConfig, password: string, max = 3) {
  return postgres({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    username: cfg.user,
    password,
    ssl: cfg.ssl ? 'require' : false,
    max,
    connect_timeout: 8,
    idle_timeout: 60,
    types: numberTypes,
    onnotice: () => {},
    // Belt and braces: the company's login should already be read-only.
    connection: { default_transaction_read_only: true, statement_timeout: QUERY_TIMEOUT_MS, application_name: 'chatboat' },
  });
}

/** One pool per external source, rebuilt when the source is edited. */
const externalPools = new Map<number, { stamp: number; sql: postgres.Sql }>();
export function poolFor(source: DataSource) {
  if (source.kind !== 'postgres') return analyst();
  const stamp = source.updatedAt.getTime();
  const cached = externalPools.get(source.id);
  if (cached?.stamp === stamp) return cached.sql;
  void cached?.sql.end({ timeout: 5 });
  if (!source.secret) throw new Error(`Data source "${source.name}" has no password saved.`);
  const sql = connectExternal(source.config as PgConfig, decrypt(source.secret));
  externalPools.set(source.id, { stamp, sql });
  return sql;
}

// ---- Lookup ----------------------------------------------------------------------

export async function getActiveSource(): Promise<DataSource> {
  const [active] = await db.select().from(dataSource).where(eq(dataSource.isActive, true));
  if (active) return active;
  const [sample] = await db.select().from(dataSource).where(eq(dataSource.kind, 'sample'));
  if (!sample) throw new Error('No data source configured');
  return sample;
}

/** The source a saved chart was built on; charts from before sources existed use the sample. */
export async function getSourceForChart(sourceId: number | undefined): Promise<DataSource> {
  if (sourceId != null) {
    const [row] = await db.select().from(dataSource).where(eq(dataSource.id, sourceId));
    if (row) return row;
    throw new Error('The data source for this chart was removed.');
  }
  const [sample] = await db.select().from(dataSource).where(eq(dataSource.kind, 'sample'));
  return sample;
}

/** Schema that unqualified table names mean for this source. */
export function defaultSchemaOf(source: DataSource) {
  return source.kind === 'sample' ? null : source.kind === 'upload' ? 'uploads' : 'public';
}

export async function guardOptionsFor(source: DataSource): Promise<GuardOptions> {
  if (source.kind === 'sample') return { allowedSchemas: ['biz'], defaultSchema: null };
  if (source.kind === 'upload') return { allowedSchemas: ['uploads'], defaultSchema: 'uploads' };
  return {
    allowedTables: new Set(source.allowedTables.map(t => t.toLowerCase())),
    defaultSchema: 'public',
  };
}

// ---- Running queries ---------------------------------------------------------------

/** Validate and run one AI-written SELECT against a source, read-only, with a row limit. */
export async function runOnSource(source: DataSource, rawSql: string) {
  const sql = guardSql(rawSql, await guardOptionsFor(source));
  const pool = poolFor(source);
  const searchPath = defaultSchemaOf(source) ?? 'biz';
  const rows = (await pool.begin('read only', async tx => {
    // Unqualified names resolve to the same schema the guard assumed.
    await tx.unsafe(`SET LOCAL search_path TO "${searchPath.replace(/"/g, '')}"`);
    await tx.unsafe(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
    return tx.unsafe(limitSql(sql));
  })) as unknown as Record<string, unknown>[];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { sql, columns, rows: rows.map(normalizeRow) };
}

/** Run with the sample data (insights, older charts). */
export async function runOnSample(rawSql: string) {
  return runOnSource(await getSourceForChart(undefined), rawSql);
}

export function forgetPool(sourceId: number) {
  const cached = externalPools.get(sourceId);
  externalPools.delete(sourceId);
  void cached?.sql.end({ timeout: 5 });
}
