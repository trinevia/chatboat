import nodeSqlParser from 'node-sql-parser';

const { Parser } = nodeSqlParser;
const parser = new Parser();
const OPT = { database: 'PostgreSQL' } as const;
export const MAX_ROWS = 1000;

export class UnsafeSqlError extends Error {}

/**
 * Defence-in-depth check before the AI's SQL reaches Postgres. The database role
 * (analyst_ro: read-only, biz schema only, 5s timeout) is the real boundary; this
 * rejects anything that is not a single SELECT over biz.* so the model gets a clear error.
 */
export function guardSql(input: string): string {
  const sql = input.trim().replace(/;+\s*$/, '');
  if (!sql) throw new UnsafeSqlError('Empty query.');
  if (sql.includes(';')) throw new UnsafeSqlError('Only a single statement is allowed.');

  let ast;
  try {
    ast = parser.astify(sql, OPT);
  } catch (e) {
    throw new UnsafeSqlError(`Could not parse SQL: ${(e as Error).message.split('\n')[0]}`);
  }
  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1 || statements[0]?.type !== 'select') {
    throw new UnsafeSqlError('Only SELECT queries are allowed.');
  }

  // tableList entries look like "select::<schema>::<table>"
  const cteNames = new Set(
    ((statements[0] as { with?: { name: { value: string } }[] | null }).with ?? []).map(w =>
      w.name.value.toLowerCase()
    )
  );
  for (const entry of parser.tableList(sql, OPT)) {
    const [action, schemaName, table] = entry.split('::');
    if (action !== 'select') throw new UnsafeSqlError('Only SELECT queries are allowed.');
    const isCte = (schemaName === 'null' || !schemaName) && cteNames.has(table.toLowerCase());
    if (!isCte && schemaName !== 'biz') {
      throw new UnsafeSqlError(`Table "${schemaName}.${table}" is not allowed. Query biz.* tables only.`);
    }
  }
  return sql;
}

/** Wrap the query so at most MAX_ROWS come back, whatever the model wrote. */
export function limitSql(sql: string): string {
  return `SELECT * FROM (\n${sql}\n) AS ai_query LIMIT ${MAX_ROWS}`;
}
