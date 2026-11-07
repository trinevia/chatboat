import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '@chatboat/db';
import { subscriptionInput, type SubscriptionInfo } from '@chatboat/shared';
import { runSubscription } from '../digest/digest';
import { emailConfigured } from '../digest/email';
import { describeSchedule, isValidTimezone, nextRunAt } from '../digest/schedule';
import { requireUser, type AppEnv } from '../context';

const { subscription, subscriptionRun, dashboard } = schema;

async function load(userId: string, id?: number): Promise<SubscriptionInfo[]> {
  const rows = await db
    .select({ s: subscription, dashboardName: dashboard.name })
    .from(subscription)
    .innerJoin(dashboard, eq(dashboard.id, subscription.dashboardId))
    .where(and(eq(subscription.userId, userId), id ? eq(subscription.id, id) : undefined))
    .orderBy(desc(subscription.createdAt));
  return Promise.all(
    rows.map(async ({ s, dashboardName }) => {
      const [last] = await db
        .select()
        .from(subscriptionRun)
        .where(eq(subscriptionRun.subscriptionId, s.id))
        .orderBy(desc(subscriptionRun.createdAt))
        .limit(1);
      return {
        id: s.id,
        dashboardId: s.dashboardId,
        dashboardName,
        frequency: s.frequency,
        hour: s.hour,
        minute: s.minute,
        dayOfWeek: s.dayOfWeek,
        dayOfMonth: s.dayOfMonth,
        timezone: s.timezone,
        isActive: s.isActive,
        schedule: describeSchedule(s),
        nextRunAt: s.nextRunAt.toISOString(),
        lastRun: last ? { status: last.status, at: last.createdAt.toISOString(), error: last.error } : null,
      };
    })
  );
}

async function owned(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(subscription)
    .where(and(eq(subscription.id, id), eq(subscription.userId, userId)));
  return row;
}

export const subscriptionRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/subscriptions', zValidator('query', z.object({ dashboardId: z.coerce.number().optional() })), async c => {
    const { dashboardId } = c.req.valid('query');
    const all = await load(c.get('user').id);
    return c.json({
      emailConfigured,
      subscriptions: dashboardId ? all.filter(s => s.dashboardId === dashboardId) : all,
    });
  })

  .post('/subscriptions', zValidator('json', subscriptionInput), async c => {
    const input = c.req.valid('json');
    const userId = c.get('user').id;
    if (!isValidTimezone(input.timezone)) return c.json({ error: 'Unknown timezone' }, 400);
    const [d] = await db
      .select()
      .from(dashboard)
      .where(and(eq(dashboard.id, input.dashboardId), eq(dashboard.userId, userId)));
    if (!d) return c.json({ error: 'Dashboard not found' }, 404);
    const [row] = await db
      .insert(subscription)
      .values({ ...input, userId, nextRunAt: nextRunAt(input) })
      .returning();
    return c.json((await load(userId, row.id))[0], 201);
  })

  .patch(
    '/subscriptions/:id',
    zValidator('json', z.object({ isActive: z.boolean() }).or(subscriptionInput)),
    async c => {
      const userId = c.get('user').id;
      const row = await owned(Number(c.req.param('id')), userId);
      if (!row) return c.json({ error: 'Not found' }, 404);
      const body = c.req.valid('json');
      if ('frequency' in body) {
        if (!isValidTimezone(body.timezone)) return c.json({ error: 'Unknown timezone' }, 400);
        if (body.dashboardId !== row.dashboardId) return c.json({ error: 'Cannot change the dashboard' }, 400);
        await db.update(subscription).set({ ...body, nextRunAt: nextRunAt(body) }).where(eq(subscription.id, row.id));
      } else {
        // Resuming recomputes the next run so a long pause doesn't fire immediately.
        await db
          .update(subscription)
          .set({ isActive: body.isActive, ...(body.isActive ? { nextRunAt: nextRunAt(row) } : {}) })
          .where(eq(subscription.id, row.id));
      }
      return c.json((await load(userId, row.id))[0]);
    }
  )

  .delete('/subscriptions/:id', async c => {
    const row = await owned(Number(c.req.param('id')), c.get('user').id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await db.delete(subscription).where(eq(subscription.id, row.id));
    return c.body(null, 204);
  })

  // "Send now": same digest as the schedule, delivered immediately.
  .post('/subscriptions/:id/send', async c => {
    const row = await owned(Number(c.req.param('id')), c.get('user').id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    const result = await runSubscription(row.id, 'manual');
    return result.ok ? c.json(result) : c.json(result, 502);
  });
