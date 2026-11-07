import { tool } from 'ai';
import { z } from 'zod';
import {
  renderChartInput,
  suggestFollowupsInput,
  type ChartSpec,
  type Row,
} from '@chatboat/shared';
import { runAnalystQuery } from './analyst-db';
import { UnsafeSqlError } from './sql-guard';

const PREVIEW_ROWS = 30;

/**
 * Tools are created per request: runSql stores full results in `results`, and
 * renderChart turns a queryId into a chart spec that streams to the browser.
 * The model only ever sees a short preview, which keeps token usage low.
 */
export function createTools() {
  const results = new Map<string, { sql: string; columns: string[]; rows: Row[] }>();

  return {
    runSql: tool({
      description:
        'Run one read-only PostgreSQL SELECT against the biz schema. Returns a queryId, the columns, the row count and a preview of the rows.',
      inputSchema: z.object({
        sql: z.string().describe('A single SELECT statement over biz.* tables.'),
      }),
      execute: async ({ sql }) => {
        try {
          const result = await runAnalystQuery(sql);
          const queryId = `q${results.size + 1}`;
          results.set(queryId, result);
          return {
            ok: true as const,
            queryId,
            columns: result.columns,
            rowCount: result.rows.length,
            preview: result.rows.slice(0, PREVIEW_ROWS),
          };
        } catch (e) {
          const message =
            e instanceof UnsafeSqlError ? e.message : `Database error: ${(e as Error).message}`;
          return { ok: false as const, error: message };
        }
      },
    }),

    renderChart: tool({
      description:
        'Show the rows of a previous runSql call to the user as a chart or table. Call once per answer.',
      inputSchema: renderChartInput,
      execute: async (input): Promise<{ ok: true; chart: ChartSpec } | { ok: false; error: string }> => {
        const result = results.get(input.queryId);
        if (!result) return { ok: false, error: `Unknown queryId "${input.queryId}". Call runSql first.` };
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
          },
        };
      },
      // The model doesn't need the rows back; it already saw the preview.
      toModelOutput: ({ output }) => ({
        type: 'text',
        value: output.ok ? `Chart "${output.chart.title}" shown to the user.` : output.error,
      }),
    }),

    suggestFollowups: tool({
      description: 'Offer the user short follow-up questions as clickable suggestions.',
      inputSchema: suggestFollowupsInput,
      execute: async ({ questions }) => ({ questions }),
    }),
  };
}

export type ChatTools = ReturnType<typeof createTools>;
