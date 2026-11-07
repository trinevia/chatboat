import nodeSqlParser from 'node-sql-parser';

const { Parser } = nodeSqlParser;
const parser = new Parser();
const OPT = { database: 'PostgreSQL' } as const;
export const MAX_ROWS = 1000;

export class UnsafeSqlError extends Error {}

export interface GuardOptions {
  /**
   * Tables the query may read, as lower-case "schema.table". When absent, any
   * table in `allowedSchemas` is allowed (the sample data uses this).
   */
  allowedTables?: Set<string>;
  /** Schemas whose tables are all allowed when `allowedTables` isn't given. */
  allowedSchemas?: string[];
  /**
   * Schema that unqualified table names resolve to. The query runner pins
   * search_path to the same schema, so the check and the execution agree.
   * When null, unqualified names are rejected.
   */
  defaultSchema?: string | null;
}

const SAMPLE: GuardOptions = { allowedSchemas: ['biz'], defaultSchema: null };

/**
 * Defence-in-depth check before the AI's SQL reaches a database. The database
 * login (read-only role, forced read-only transaction, statement timeout) is the
 * real boundary; this rejects anything that is not a single SELECT over the
 * allowed tables so the model gets a clear error it can fix.
 */
export function guardSql(input: string, opts: GuardOptions = SAMPLE): string {
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
    const [action, rawSchema, rawTable] = entry.split('::');
    if (action !== 'select') throw new UnsafeSqlError('Only SELECT queries are allowed.');
    const table = rawTable.toLowerCase();
    const unqualified = rawSchema === 'null' || !rawSchema;
    if (unqualified && cteNames.has(table)) continue;

    const schema = unqualified ? opts.defaultSchema : rawSchema.toLowerCase();
    if (!schema) {
      throw new UnsafeSqlError(`Table "${rawTable}" must be qualified with its schema, e.g. biz.${rawTable}.`);
    }
    const allowed = opts.allowedTables
      ? opts.allowedTables.has(`${schema}.${table}`)
      : (opts.allowedSchemas ?? []).includes(schema);
    if (!allowed) {
      throw new UnsafeSqlError(`Table "${schema}.${rawTable}" is not allowed. Use only the tables listed in the schema.`);
    }
  }
  return sql;
}

/** Wrap the query so at most MAX_ROWS come back, whatever the model wrote. */
export function limitSql(sql: string): string {
  return `SELECT * FROM (\n${sql}\n) AS ai_query LIMIT ${MAX_ROWS}`;
}
