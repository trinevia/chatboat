import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '@chatboat/db';
import { chartSpec, pinWidgetInput, type ChartSpec } from '@chatboat/shared';
import { getSourceForChart, runOnSource } from '../data/sources';
import { requireUser, type AppEnv } from '../context';

const { dashboard, dashboardWidget } = schema;

async function ownedDashboard(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(dashboard)
    .where(and(eq(dashboard.id, id), eq(dashboard.userId, userId)));
  return row;
}

export const dashboardRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/dashboards', async c => {
    const rows = await db.query.dashboard.findMany({
      where: eq(dashboard.userId, c.get('user').id),
      orderBy: desc(dashboard.createdAt),
      with: { widgets: { columns: { id: true } } },
    });
    return c.json(rows.map(d => ({ id: d.id, name: d.name, widgetCount: d.widgets.length, createdAt: d.createdAt })));
  })

  .get('/dashboards/:id', async c => {
    const d = await ownedDashboard(Number(c.req.param('id')), c.get('user').id);
    if (!d) return c.json({ error: 'Not found' }, 404);
    const widgets = await db
      .select()
      .from(dashboardWidget)
      .where(eq(dashboardWidget.dashboardId, d.id))
      .orderBy(dashboardWidget.createdAt);
    return c.json({ ...d, widgets });
  })

  // Pin a chart to an existing dashboard or a new one.
  .post('/dashboards/widgets', zValidator('json', pinWidgetInput), async c => {
    const input = c.req.valid('json');
    const userId = c.get('user').id;
    let dashboardId = input.dashboardId;
    if (dashboardId) {
      if (!(await ownedDashboard(dashboardId, userId))) return c.json({ error: 'Not found' }, 404);
    } else {
      const [created] = await db
        .insert(dashboard)
        .values({ userId, name: input.dashboardName ?? 'My dashboard' })
        .returning();
      dashboardId = created.id;
    }
    const [widget] = await db
      .insert(dashboardWidget)
      .values({ dashboardId, chatId: input.chatId, chart: input.chart, sql: input.chart.sql })
      .returning();
    return c.json({ dashboardId, widget }, 201);
  })

  // Re-run the stored SQL so the widget shows fresh numbers (no LLM call).
  .post('/dashboards/widgets/:id/refresh', async c => {
    const [w] = await db
      .select({ widget: dashboardWidget, userId: dashboard.userId })
      .from(dashboardWidget)
      .innerJoin(dashboard, eq(dashboard.id, dashboardWidget.dashboardId))
      .where(eq(dashboardWidget.id, Number(c.req.param('id'))));
    if (!w || w.userId !== c.get('user').id) return c.json({ error: 'Not found' }, 404);
    if (!w.widget.sql) return c.json({ error: 'Widget has no query' }, 400);
    const stored = chartSpec.parse(w.widget.chart);
    const result = await runOnSource(await getSourceForChart(stored.sourceId), w.widget.sql);
    const chart: ChartSpec = { ...stored, columns: result.columns, rows: result.rows };
    const [updated] = await db
      .update(dashboardWidget)
      .set({ chart })
      .where(eq(dashboardWidget.id, w.widget.id))
      .returning();
    return c.json(updated);
  })

  .delete('/dashboards/widgets/:id', async c => {
    const [w] = await db
      .select({ id: dashboardWidget.id, userId: dashboard.userId })
      .from(dashboardWidget)
      .innerJoin(dashboard, eq(dashboard.id, dashboardWidget.dashboardId))
      .where(eq(dashboardWidget.id, Number(c.req.param('id'))));
    if (!w || w.userId !== c.get('user').id) return c.json({ error: 'Not found' }, 404);
    await db.delete(dashboardWidget).where(eq(dashboardWidget.id, w.id));
    return c.body(null, 204);
  })

  .patch('/dashboards/:id', zValidator('json', z.object({ name: z.string().min(1).max(80) })), async c => {
    const d = await ownedDashboard(Number(c.req.param('id')), c.get('user').id);
    if (!d) return c.json({ error: 'Not found' }, 404);
    const [updated] = await db.update(dashboard).set(c.req.valid('json')).where(eq(dashboard.id, d.id)).returning();
    return c.json(updated);
  })

  .delete('/dashboards/:id', async c => {
    const d = await ownedDashboard(Number(c.req.param('id')), c.get('user').id);
    if (!d) return c.json({ error: 'Not found' }, 404);
    await db.delete(dashboard).where(eq(dashboard.id, d.id));
    return c.body(null, 204);
  });
