import { max } from 'drizzle-orm';
import { db, schema, sql } from '@chatboat/db';

const { insight } = schema;
type Insight = typeof insight.$inferInsert;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const n = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b === 0 ? null : ((a - b) / Math.abs(b)) * 100);

/** Month-to-date sales vs the same number of days last month. */
async function salesPace(): Promise<Insight | null> {
  const [r] = await sql`
    WITH b AS (
      SELECT date_trunc('month', current_date)::date AS m0,
             (date_trunc('month', current_date) - interval '1 month')::date AS m1,
             (current_date - date_trunc('month', current_date)::date) + 1 AS days)
    SELECT
      (SELECT COALESCE(SUM(total_amount), 0) FROM biz.invoices, b WHERE status <> 'void' AND issue_date >= b.m0) AS this_mtd,
      (SELECT COALESCE(SUM(total_amount), 0) FROM biz.invoices, b WHERE status <> 'void'
         AND issue_date >= b.m1 AND issue_date < b.m1 + b.days) AS last_mtd,
      (SELECT days FROM b) AS days`;
  const p = pct(n(r.this_mtd), n(r.last_mtd));
  if (p == null) return null;
  const up = p >= 0;
  return {
    key: 'sales_pace',
    title: `Sales are ${up ? 'up' : 'down'} ${Math.abs(p).toFixed(0)}% this month`,
    body: `${money.format(n(r.this_mtd))} in the first ${r.days} days, vs ${money.format(n(r.last_mtd))} at the same point last month.`,
    question: 'Compare daily sales this month with the same days last month',
    tone: Math.abs(p) < 3 ? 'neutral' : up ? 'good' : 'bad',
    score: 50 + Math.min(40, Math.round(Math.abs(p))),
  };
}

async function overdue(): Promise<Insight | null> {
  const [r] = await sql`
    SELECT COALESCE(SUM(i.total_amount), 0) AS total, COUNT(*) AS invoices,
      (SELECT c.name FROM biz.invoices i2 JOIN biz.customers c ON c.id = i2.customer_id
         WHERE i2.status = 'overdue' GROUP BY c.name ORDER BY SUM(i2.total_amount) DESC LIMIT 1) AS top_customer,
      (SELECT SUM(i2.total_amount) FROM biz.invoices i2 JOIN biz.customers c ON c.id = i2.customer_id
         WHERE i2.status = 'overdue' GROUP BY c.name ORDER BY SUM(i2.total_amount) DESC LIMIT 1) AS top_amount
    FROM biz.invoices i WHERE i.status = 'overdue'`;
  if (!n(r.invoices)) return null;
  return {
    key: 'overdue',
    title: `${money.format(n(r.total))} is overdue`,
    body: `Across ${n(r.invoices)} invoices. The largest balance is ${r.top_customer} at ${money.format(n(r.top_amount))}.`,
    question: 'Which customers have the largest overdue balances?',
    tone: 'bad',
    score: 70,
  };
}

async function lowStock(): Promise<Insight | null> {
  const rows = await sql`
    SELECT p.name, v.warehouse, v.quantity_on_hand, v.reorder_level
    FROM biz.inventory v JOIN biz.products p ON p.id = v.product_id
    WHERE v.quantity_on_hand < v.reorder_level
    ORDER BY (v.reorder_level - v.quantity_on_hand) DESC`;
  if (!rows.length) return null;
  const worst = rows[0];
  return {
    key: 'low_stock',
    title: `${rows.length} stock ${rows.length === 1 ? 'item is' : 'items are'} below reorder level`,
    body: `Most urgent: ${worst.name} in ${worst.warehouse} (${worst.quantity_on_hand} on hand, reorder at ${worst.reorder_level}).`,
    question: 'Which products are below their reorder level?',
    tone: 'bad',
    score: 40 + Math.min(30, rows.length),
  };
}

/** Region with the biggest swing: last 30 days vs the 30 days before. */
async function regionSwing(): Promise<Insight | null> {
  const rows = await sql`
    SELECT r.name AS region,
      SUM(i.total_amount) FILTER (WHERE i.issue_date > current_date - 30) AS recent,
      SUM(i.total_amount) FILTER (WHERE i.issue_date <= current_date - 30 AND i.issue_date > current_date - 60) AS prior
    FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id JOIN biz.regions r ON r.id = c.region_id
    WHERE i.status <> 'void' AND i.issue_date > current_date - 60
    GROUP BY r.name`;
  const scored = rows
    .map(r => ({ region: r.region as string, recent: n(r.recent), prior: n(r.prior), p: pct(n(r.recent), n(r.prior)) }))
    .filter((r): r is typeof r & { p: number } => r.p != null)
    .sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
  const top = scored[0];
  if (!top) return null;
  const up = top.p >= 0;
  return {
    key: 'region_swing',
    title: `${top.region} sales ${up ? 'grew' : 'fell'} ${Math.abs(top.p).toFixed(0)}%`,
    body: `${money.format(top.recent)} in the last 30 days, vs ${money.format(top.prior)} in the 30 days before.`,
    question: `Show weekly sales for the ${top.region} region over the last 60 days`,
    tone: up ? 'good' : 'bad',
    score: 30 + Math.min(40, Math.round(Math.abs(top.p))),
  };
}

async function topCustomer(): Promise<Insight | null> {
  const [r] = await sql`
    SELECT c.name, SUM(i.total_amount) AS total
    FROM biz.invoices i JOIN biz.customers c ON c.id = i.customer_id
    WHERE i.status <> 'void' AND i.issue_date >= date_trunc('month', current_date)
    GROUP BY c.name ORDER BY total DESC LIMIT 1`;
  if (!r) return null;
  return {
    key: 'top_customer',
    title: `${r.name} is this month's top customer`,
    body: `${money.format(n(r.total))} invoiced so far this month.`,
    question: `What has ${r.name} bought this year, by product category?`,
    tone: 'good',
    score: 25,
  };
}

/** Recompute every insight. Each check is independent, so one failure doesn't hide the rest. */
export async function computeInsights() {
  const results = await Promise.allSettled([salesPace(), overdue(), lowStock(), regionSwing(), topCustomer()]);
  const rows = results.flatMap(r => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  for (const r of results) if (r.status === 'rejected') console.error('[insights] check failed:', r.reason);
  await db.transaction(async tx => {
    await tx.delete(insight);
    if (rows.length) await tx.insert(insight).values(rows.map(r => ({ ...r, computedAt: new Date() })));
  });
  return rows.length;
}

const STALE_MS = 6 * 60 * 60 * 1000;

export async function refreshInsightsIfStale() {
  const [{ last }] = await db.select({ last: max(insight.computedAt) }).from(insight);
  if (!last || Date.now() - last.getTime() > STALE_MS) {
    const count = await computeInsights();
    console.log(`[insights] computed ${count} insights`);
  }
}

