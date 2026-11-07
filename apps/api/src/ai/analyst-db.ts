import postgres from 'postgres';
import type { Row } from '@chatboat/shared';
import { guardSql, limitSql } from './sql-guard';

const url = process.env.ANALYST_DATABASE_URL;
if (!url) throw new Error('ANALYST_DATABASE_URL is not set');

/** Connection as the read-only analyst_ro role. */
const analyst = postgres(url, {
  max: 5,
  connection: { search_path: 'biz', statement_timeout: 5000 },
  // numeric/bigint come back as strings by default; charts need numbers.
  types: {
    numeric: { to: 1700, from: [1700, 20], serialize: String, parse: (v: string) => Number(v) },
  },
});

export async function runAnalystQuery(rawSql: string) {
  const sql = guardSql(rawSql);
  const rows = (await analyst.begin('read only', tx => tx.unsafe(limitSql(sql)))) as unknown as Row[];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { sql, columns, rows: rows.map(normalizeRow) };
}

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
