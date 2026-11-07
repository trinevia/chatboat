import type { ChartSpec } from '@chatboat/shared';
import { schemaDocFor } from '../data/introspect';
import { poolFor, type DataSource } from '../data/sources';
import { getSetting } from '../settings';

export interface GlossaryTerm {
  term: string;
  definition: string;
}

const HOW_TO_ANSWER = `How to answer a data question:
1. Call runSql with one PostgreSQL SELECT query. Aggregate in SQL (GROUP BY, SUM, COUNT) and return few, well-named columns, e.g. "month", "total_sales". Use to_char(date_trunc('month', <date column>), 'YYYY-MM') for monthly buckets and ORDER BY the x axis. Round money with ROUND(x, 2).
2. If runSql returns an error, fix the query and try again (at most twice).
3. Call renderChart with the queryId from runSql. Fill explanation with a plain-English description of the metric, filters and date range so a non-technical reader can trust the number. Choose the type: line for trends over time, bar for comparing categories, pie for shares of a whole (6 slices or fewer), stacked/grouped/multi_line when there are several numeric series, kpi for a single number, table for detailed lists. For several series over the same x axis, either return one numeric column per series (wide format) or return long rows (x, series, value) and set seriesKey.
4. Call suggestFollowups with 3 short follow-up questions.
5. Finish with at most two sentences of plain text (no markdown). Do not repeat the numbers in a markdown table; the chart shows them.

Rules:
- Never invent numbers. Every figure must come from a runSql result.
- Only use the tables and columns listed above. If a question cannot be answered from them, say so briefly and suggest a question that can.
- For greetings or questions about what you can do, answer in text and suggest example questions with suggestFollowups.
- Relative dates ("this year", "last month") are relative to CURRENT_DATE.
- The current month is still in progress, so its totals are partial. Don't describe it as a drop or decline; say it is month-to-date, or leave it out of trend comparisons. If you leave it out, filter it in SQL (date < date_trunc('month', CURRENT_DATE)) so the chart matches what you say.`;

/** MongoDB sources: the same steps, written for aggregation pipelines. */
const HOW_TO_ANSWER_MONGO = HOW_TO_ANSWER.replace(
  /1\. Call runSql[\s\S]*?\n2\. If runSql/,
  `1. Call runMongo with a collection and an aggregation pipeline (JSON array of stages). Use $match to filter, $unwind for arrays, $group to aggregate ($sum, $avg, $count), then $project to return few flat, well-named fields, e.g. { "_id": 0, "city": "$_id", "total_sales": 1 }. For monthly buckets use { "$dateToString": { "format": "%Y-%m", "date": "$createdAt" } } and $sort by it. Round money with { "$round": ["$x", 2] }. Dates in $match must be written as { "$gte": { "$date": "2025-01-01T00:00:00Z" } }.
2. If runMongo`
)
  .replace("filter it in SQL (date < date_trunc('month', CURRENT_DATE))", 'filter it out in $match')
  .replace('Every figure must come from a runSql result.', 'Every figure must come from a runMongo result.');

/** Business definitions that only make sense for the built-in sample tables. */
const SAMPLE_RULES = `- "Sales" or "revenue" means SUM(total_amount) of invoices whose status is not 'void'.
- Always qualify tables as biz.<table>.`;

function sourceIntro(source: DataSource) {
  if (source.kind === 'sample') {
    return 'Business users ask questions about sales, invoices, customers, products, payments and inventory, and you answer with charts built from the company database.';
  }
  if (source.kind === 'upload') {
    return 'Business users ask questions about spreadsheets their company uploaded (now database tables in the "uploads" schema), and you answer with charts.';
  }
  if (source.kind === 'mongodb') {
    return "Business users ask questions about their company's MongoDB database, and you answer with charts.";
  }
  return "Business users ask questions about their company's own database, and you answer with charts.";
}

/**
 * System prompt for a data source: general rules, the tables the AI may use, the
 * admin's notes and the company glossary. Built from stable inputs so providers
 * can cache it.
 */
export async function buildSystemPrompt(source: DataSource): Promise<string> {
  const [doc, glossary] = await Promise.all([
    schemaDocFor(source, () => poolFor(source)),
    getSetting<GlossaryTerm[]>('glossary'),
  ]);
  const terms = (glossary ?? []).filter(g => g.term.trim() && g.definition.trim());
  return [
    `You are Chatboat, a data analyst assistant. ${sourceIntro(source)}`,
    source.kind === 'sample'
      ? doc
      : source.kind === 'mongodb'
        ? `Collections you can query (MongoDB; fields from sampled documents, a.b = nested field, items[].x = field inside an array):\n${doc || '(no collections)'}`
        : `Tables you can query (PostgreSQL):\n${doc || '(no tables yet)'}`,
    source.notes.trim() ? `Notes from the company about this data:\n${source.notes.trim()}` : '',
    terms.length
      ? `Company definitions. Always follow these when a question uses the term:\n${terms.map(t => `- ${t.term}: ${t.definition}`).join('\n')}`
      : '',
    source.kind === 'sample' ? `${HOW_TO_ANSWER}\n${SAMPLE_RULES}` : source.kind === 'mongodb' ? HOW_TO_ANSWER_MONGO : HOW_TO_ANSWER,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function userContext(role: string) {
  return `The user's role is "${role}". Today's date is ${new Date().toISOString().slice(0, 10)}.`;
}

/** Context for chats started with "Ask about this chart". */
export function chartContext(chart: ChartSpec) {
  const preview = JSON.stringify(chart.rows.slice(0, 40));
  return [
    `The user opened this conversation from a saved chart titled "${chart.title}" and is asking about it.`,
    chart.explanation ? `How it was calculated: ${chart.explanation}` : '',
    chart.sql ? `Its SQL:\n${chart.sql}` : '',
    `Columns: ${chart.columns.join(', ')}. First rows: ${preview}`,
    'Build on this query when answering (reuse its filters unless the user changes them).',
  ]
    .filter(Boolean)
    .join('\n');
}
