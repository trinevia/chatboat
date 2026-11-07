import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '@chatboat/db';
import type { InsightInfo } from '@chatboat/shared';
import { computeInsights, refreshInsightsIfStale } from '../insights/compute';
import { requireUser, type AppEnv } from '../context';

const { insight } = schema;

async function list(): Promise<InsightInfo[]> {
  const rows = await db.select().from(insight).orderBy(desc(insight.score)).limit(4);
  return rows.map(r => ({
    key: r.key,
    title: r.title,
    body: r.body,
    question: r.question,
    tone: r.tone,
    computedAt: r.computedAt.toISOString(),
  }));
}

export const insightRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get('/insights', async c => {
    await refreshInsightsIfStale();
    return c.json(await list());
  })
  .post('/insights/refresh', async c => {
    await computeInsights();
    return c.json(await list());
  });
