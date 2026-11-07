/**
 * Accuracy eval: asks each question in cases.ts with the same prompt and tools as
 * the app, then checks the numbers against the reference SQL.
 *
 *   pnpm --filter @chatboat/api eval                       # current AI_PROVIDER/AI_MODEL, all cases
 *   pnpm --filter @chatboat/api eval -- --limit 5
 *   pnpm --filter @chatboat/api eval -- --models nvidia:nvidia/nemotron-3-ultra-550b-a55b,nvidia:nvidia/nemotron-3.5-lightning-30b-a3b
 *
 * Every run calls the model once per case (several steps each), so it uses API credits.
 */
import { generateText, stepCountIs } from 'ai';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Row } from '@chatboat/shared';
import { runAnalystQuery } from '../src/ai/analyst-db';
import { getModel, modelFor } from '../src/ai/model';
import { SYSTEM_PROMPT, userContext } from '../src/ai/prompt';
import { createTools } from '../src/ai/tools';
import { CASES, type EvalCase } from './cases';
import { score } from './score';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const limit = Number(arg('limit') ?? CASES.length);
const only = arg('case');
const concurrency = Number(arg('concurrency') ?? 2);
const models = (arg('models') ?? '')
  .split(',')
  .filter(Boolean)
  .map(m => {
    const [provider, ...rest] = m.split(':');
    return modelFor(provider, rest.join(':') || undefined);
  });
if (!models.length) models.push(getModel());

const cases = CASES.filter(c => !only || c.id === only).slice(0, limit);

interface Outcome {
  id: string;
  pass: boolean;
  reason: string;
  seconds: number;
  inputTokens: number;
  outputTokens: number;
  sql?: string;
}

async function runCase(c: EvalCase, expected: Row[], model: ReturnType<typeof getModel>): Promise<Outcome> {
  const tools = createTools();
  const started = Date.now();
  try {
    const res = await generateText({
      model: model.model,
      system: `${SYSTEM_PROMPT}\n\n${userContext('executive')}`,
      prompt: c.question,
      tools,
      stopWhen: stepCountIs(8),
    });
    // The answer is the query the model charted, or else its last successful query.
    type SqlOut = { ok: boolean; queryId?: string; preview?: Row[] };
    const results = res.steps.flatMap(s => s.toolResults);
    const chart = results.find(r => r.toolName === 'renderChart')?.output as
      | { ok: true; chart: { rows: Row[]; sql?: string } }
      | { ok: false }
      | undefined;
    let rows: Row[] | null = null;
    let sql: string | undefined;
    if (chart?.ok) {
      rows = chart.chart.rows;
      sql = chart.chart.sql;
    } else {
      const lastSql = results.filter(r => r.toolName === 'runSql' && (r.output as SqlOut).ok).pop();
      rows = (lastSql?.output as SqlOut | undefined)?.preview ?? null;
    }
    const verdict = score(expected, rows);
    return {
      id: c.id,
      ...verdict,
      seconds: (Date.now() - started) / 1000,
      inputTokens: res.totalUsage.inputTokens ?? 0,
      outputTokens: res.totalUsage.outputTokens ?? 0,
      sql,
    };
  } catch (e) {
    return { id: c.id, pass: false, reason: `Error: ${(e as Error).message.slice(0, 120)}`, seconds: (Date.now() - started) / 1000, inputTokens: 0, outputTokens: 0 };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function main() {
  console.log(`Computing reference answers for ${cases.length} cases…`);
  const expected = new Map<string, Row[]>();
  for (const c of cases) expected.set(c.id, (await runAnalystQuery(c.sql)).rows);

  const lines: string[] = [`# Chatboat accuracy eval — ${new Date().toISOString()}`, ''];
  const summary: string[] = ['| Model | Passed | Avg time | Tokens (in / out) |', '|---|---|---|---|'];

  for (const m of models) {
    console.log(`\n${m.label}`);
    const outcomes = await pool(cases, concurrency, async c => {
      const o = await runCase(c, expected.get(c.id)!, m);
      console.log(`  ${o.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(28)} ${o.seconds.toFixed(1)}s  ${o.pass ? '' : o.reason}`);
      return o;
    });
    const passed = outcomes.filter(o => o.pass).length;
    const avg = outcomes.reduce((s, o) => s + o.seconds, 0) / outcomes.length;
    const tin = outcomes.reduce((s, o) => s + o.inputTokens, 0);
    const tout = outcomes.reduce((s, o) => s + o.outputTokens, 0);
    console.log(`  → ${passed}/${outcomes.length} passed, ${avg.toFixed(1)}s average`);
    summary.push(`| ${m.label} | ${passed}/${outcomes.length} (${Math.round((passed / outcomes.length) * 100)}%) | ${avg.toFixed(1)}s | ${tin} / ${tout} |`);
    lines.push(`## ${m.label}`, '', '| Case | Result | Time | Notes |', '|---|---|---|---|');
    for (const o of outcomes) lines.push(`| ${o.id} | ${o.pass ? '✅' : '❌'} | ${o.seconds.toFixed(1)}s | ${o.pass ? '' : o.reason.replace(/\|/g, '/')} |`);
    lines.push('');
  }

  const report = [lines[0], '', ...summary, '', ...lines.slice(2)].join('\n');
  const dir = path.join(here, 'results');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  await writeFile(file, report);
  console.log(`\n${summary.join('\n')}\n\nReport: ${file}`);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
