import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@chatboat/db';
import { chartSpec, type ChartSpec } from '@chatboat/shared';
import { getSourceForChart, runOnSource } from '../data/sources';
import { renderChartPng } from './chart-image';
import { sendEmail } from './email';
import { describeSchedule } from './schedule';
import { getBranding } from '../settings';
import { publicWebUrl } from '../origins';
import { chartTotal, describeChange } from './totals';

const { subscription, subscriptionRun, dashboard, dashboardWidget, user } = schema;
const appUrl = publicWebUrl;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

interface Section {
  widgetId: number;
  chart: ChartSpec;
  change: string | null;
  error?: string;
}

/** Re-run each widget's stored SQL (no AI call) so the digest has today's numbers. */
async function freshCharts(dashboardId: number) {
  const widgets = await db
    .select()
    .from(dashboardWidget)
    .where(eq(dashboardWidget.dashboardId, dashboardId))
    .orderBy(asc(dashboardWidget.createdAt));
  return Promise.all(
    widgets.map(async w => {
      const stored = chartSpec.parse(w.chart);
      if (!w.sql) return { widgetId: w.id, chart: stored };
      try {
        const result = await runOnSource(await getSourceForChart(stored.sourceId), w.sql);
        const chart = { ...stored, columns: result.columns, rows: result.rows };
        await db.update(dashboardWidget).set({ chart }).where(eq(dashboardWidget.id, w.id));
        return { widgetId: w.id, chart };
      } catch (e) {
        return { widgetId: w.id, chart: stored, error: `Could not refresh: ${(e as Error).message}` };
      }
    })
  );
}

function smallTable(chart: ChartSpec) {
  const rows = chart.rows.slice(0, 8);
  const cell = 'padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;';
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:8px">
    <tr>${chart.columns.map(c => `<th align="left" style="${cell}color:#6b7280;font-weight:600">${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr>
    ${rows.map(r => `<tr>${chart.columns.map(c => `<td style="${cell}">${esc(typeof r[c] === 'number' ? fmt.format(r[c] as number) : String(r[c] ?? '—'))}</td>`).join('')}</tr>`).join('')}
  </table>${chart.rows.length > rows.length ? `<p style="font-size:12px;color:#6b7280">+ ${chart.rows.length - rows.length} more rows in the app</p>` : ''}`;
}

function buildEmail(opts: { companyName: string; dashboardName: string; dashboardId: number; schedule: string; sections: Section[] }) {
  const images: { cid: string; content: Buffer }[] = [];
  const blocks = opts.sections.map((s, i) => {
    const png = renderChartPng(s.chart);
    let visual: string;
    if (png) {
      const cid = `chart${i}`;
      images.push({ cid, content: png });
      visual = `<img src="cid:${cid}" width="560" alt="${esc(s.chart.title)}" style="width:100%;max-width:560px;height:auto;border:0;display:block;margin-top:8px"/>`;
    } else if (s.chart.type === 'kpi') {
      const total = chartTotal(s.chart);
      visual = `<div style="font-size:32px;font-weight:700;margin-top:8px">${total == null ? '—' : fmt.format(total)}</div>`;
    } else {
      visual = smallTable(s.chart);
    }
    return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0">
      <div style="font-size:15px;font-weight:600">${esc(s.chart.title)}</div>
      ${s.change ? `<div style="font-size:13px;color:#4f46e5;margin-top:4px">${esc(s.change)}</div>` : ''}
      ${s.error ? `<div style="font-size:13px;color:#dc2626;margin-top:4px">${esc(s.error)}</div>` : ''}
      ${visual}
    </div>`;
  });
  const link = `${appUrl()}/dashboards/${opts.dashboardId}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f9;font-family:Arial,Helvetica,sans-serif;color:#16181d">
    <div style="max-width:600px;margin:0 auto;padding:24px">
      <div style="font-size:13px;color:#6b7280">${esc(opts.companyName)} · Chatboat digest</div>
      <h1 style="font-size:22px;margin:4px 0 0">${esc(opts.dashboardName)}</h1>
      <div style="font-size:13px;color:#6b7280;margin-top:4px">${new Date().toUTCString()}</div>
      ${blocks.join('') || '<p>This dashboard has no charts yet.</p>'}
      <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Open dashboard</a>
      <p style="font-size:12px;color:#6b7280;margin-top:24px">You get this digest: ${esc(opts.schedule)}. Manage it in Chatboat → Subscriptions.</p>
    </div></body></html>`;
  const text = [
    `${opts.dashboardName} (Chatboat digest)`,
    '',
    ...opts.sections.map(s => `• ${s.chart.title}${s.change ? ` – ${s.change}` : ''}`),
    '',
    `Open dashboard: ${link}`,
  ].join('\n');
  return { html, text, images };
}

/** Build and send one digest. Records the run whether it succeeds or fails. */
export async function runSubscription(subscriptionId: number, trigger: 'schedule' | 'manual') {
  const [row] = await db
    .select({ sub: subscription, dash: dashboard, email: user.email })
    .from(subscription)
    .innerJoin(dashboard, eq(dashboard.id, subscription.dashboardId))
    .innerJoin(user, eq(user.id, subscription.userId))
    .where(eq(subscription.id, subscriptionId));
  if (!row) throw new Error(`Subscription ${subscriptionId} not found`);
  const { sub, dash, email } = row;

  try {
    const previous = (sub.lastTotals ?? {}) as Record<string, number | null>;
    const charts = await freshCharts(dash.id);
    const totals: Record<string, number | null> = {};
    const sections: Section[] = charts.map(c => {
      const total = chartTotal(c.chart);
      totals[c.widgetId] = total;
      return { ...c, change: describeChange(previous[c.widgetId], total) };
    });
    const schedule = describeSchedule(sub);
    const { companyName } = await getBranding();
    const mail = buildEmail({ companyName, dashboardName: dash.name, dashboardId: dash.id, schedule, sections });
    await sendEmail({ to: email, subject: `${dash.name} — your Chatboat digest`, ...mail });

    await db.update(subscription).set({ lastRunAt: new Date(), lastTotals: totals }).where(eq(subscription.id, sub.id));
    await db.insert(subscriptionRun).values({ subscriptionId: sub.id, trigger, status: 'sent', sentTo: email });
    return { ok: true as const, sentTo: email };
  } catch (e) {
    const error = (e as Error).message;
    console.error(`[digest] subscription ${sub.id} failed:`, error);
    await db.insert(subscriptionRun).values({ subscriptionId: sub.id, trigger, status: 'failed', error });
    return { ok: false as const, error };
  }
}
