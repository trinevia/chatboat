import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  renderChartInput,
  suggestFollowupsInput,
  type ChartSpec,
  type Row,
} from '@chatboat/shared';
import { runOnSource, type DataSource } from '../data/sources';
import { UnsafeSqlError } from './sql-guard';
import { UnsafeQueryError } from '../data/mongo-guard';

const PREVIEW_ROWS = 30;

/**
 * Tools are created per request: runSql stores full results in `results`, and
 * renderChart turns a queryId into a chart spec that streams to the browser.
 * The model only ever sees a short preview, which keeps token usage low.
 */
type Results = Map<string, { sql: string; columns: string[]; rows: Row[] }>;

function preview(results: Results, result: { sql: string; columns: string[]; rows: Row[] }) {
  const queryId = `q${results.size + 1}`;
  results.set(queryId, result);
  return { ok: true as const, queryId, columns: result.columns, rowCount: result.rows.length, preview: result.rows.slice(0, PREVIEW_ROWS) };
}

/** MongoDB sources get an aggregation tool instead of SQL. */
function mongoTool(source: DataSource, results: Results) {
  return tool({
    description:
      'Run one read-only MongoDB aggregation on one of the listed collections. Returns a queryId, the (flattened) columns, the row count and a preview.',
    inputSchema: z.object({
      collection: z.string().describe('Collection to aggregate.'),
      pipeline: z
        .array(z.record(z.string(), z.unknown()))
        .describe('Aggregation stages, e.g. [{"$match": {...}}, {"$group": {...}}, {"$sort": {...}}].'),
    }),
    execute: async ({ collection, pipeline }) => {
      try {
        return preview(results, await runOnSource(source, JSON.stringify({ collection, pipeline })));
      } catch (e) {
        const message = e instanceof UnsafeQueryError ? e.message : `Database error: ${(e as Error).message}`;
        return { ok: false as const, error: message };
      }
    },
  });
}

export function createTools(source: DataSource): ToolSet {
  const results: Results = new Map();

  const runSql = tool({
    description:
      'Run one read-only PostgreSQL SELECT against the listed tables. Returns a queryId, the columns, the row count and a preview of the rows.',
    inputSchema: z.object({
      sql: z.string().describe('A single SELECT statement over the listed tables.'),
    }),
    execute: async ({ sql }) => {
      try {
        return preview(results, await runOnSource(source, sql));
      } catch (e) {
        const message = e instanceof UnsafeSqlError ? e.message : `Database error: ${(e as Error).message}`;
        return { ok: false as const, error: message };
      }
    },
  });

  const renderChart = tool({
    description: 'Show the rows of a previous query to the user as a chart or table. Call once per answer.',
    inputSchema: renderChartInput,
    execute: async (input): Promise<{ ok: true; chart: ChartSpec } | { ok: false; error: string }> => {
      const result = results.get(input.queryId);
      if (!result) return { ok: false, error: `Unknown queryId "${input.queryId}". Run a query first.` };
      // kpi and table don't need an x axis; every other type does.
      const needsX = input.type !== 'kpi' && input.type !== 'table';
      const required = [...(needsX ? [input.xKey] : []), ...input.yKeys, ...(input.seriesKey ? [input.seriesKey] : [])];
      const missing = required.filter(k => !result.columns.includes(k));
      if (missing.length) {
        return { ok: false, error: `Columns not in result: ${missing.join(', ')}. Available: ${result.columns.join(', ')}` };
      }
      return {
        ok: true,
        chart: {
          type: input.type,
          title: input.title,
          xKey: input.xKey,
          yKeys: input.yKeys,
          seriesKey: input.seriesKey,
          summary: input.summary,
          explanation: input.explanation,
          columns: result.columns,
          rows: result.rows,
          sql: result.sql,
          ...(source.kind === 'sample' ? {} : { sourceId: source.id }),
        },
      };
    },
    // The model doesn't need the rows back; it already saw the preview.
    toModelOutput: ({ output }) => ({
      type: 'text',
      value: output.ok ? `Chart "${output.chart.title}" shown to the user.` : output.error,
    }),
  });

  const suggestFollowups = tool({
    description: 'Offer the user short follow-up questions as clickable suggestions.',
    inputSchema: suggestFollowupsInput,
    execute: async ({ questions }) => ({ questions }),
  });

  // Each source gets only the query tool that fits it.
  return source.kind === 'mongodb'
    ? { runMongo: mongoTool(source, results), renderChart, suggestFollowups }
    : { runSql, renderChart, suggestFollowups };
}

export type ChatTools = ReturnType<typeof createTools>;
