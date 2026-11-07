import { zValidator } from '@hono/zod-validator';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '@chatboat/db';
import {
  chartSpec,
  type ChartSpec,
  type PublicChart,
  type PublicShare,
  type ShareLinkInfo,
  type ShareSnapshot,
} from '@chatboat/shared';
import { requireUser, type AppEnv } from '../context';

const { chat, message, dashboard, dashboardWidget, shareLink, user } = schema;
const target = z.object({ kind: z.enum(['chat', 'dashboard']), id: z.string().min(1) });

/** Viewers of a public link never see the SQL behind a chart. */
const toPublic = ({ sql: _sql, ...chart }: ChartSpec): PublicChart => chart;

type Part = { type: string; text?: string; state?: string; output?: { ok?: boolean; chart?: unknown } };

/** Freeze what the owner sees right now. Returns null if the target isn't theirs. */
async function buildSnapshot(kind: 'chat' | 'dashboard', id: string, userId: string): Promise<ShareSnapshot | null> {
  if (kind === 'chat') {
    const [c] = await db.select().from(chat).where(and(eq(chat.id, id), eq(chat.userId, userId)));
    if (!c) return null;
    const rows = await db.select().from(message).where(eq(message.chatId, c.id)).orderBy(asc(message.createdAt));
    return {
      kind,
      title: c.title,
      messages: rows
        .filter(r => r.role === 'user' || r.role === 'assistant')
        .map(r => {
          const parts = r.parts as Part[];
          return {
            role: r.role as 'user' | 'assistant',
            text: parts.map(p => (p.type === 'text' ? p.text ?? '' : '')).join('').trim(),
            charts: parts
              .filter(p => p.type === 'tool-renderChart' && p.state === 'output-available' && p.output?.ok)
              .map(p => toPublic(chartSpec.parse(p.output!.chart))),
          };
        }),
    };
  }
  const [d] = await db
    .select()
    .from(dashboard)
    .where(and(eq(dashboard.id, Number(id)), eq(dashboard.userId, userId)));
  if (!d) return null;
  const widgets = await db
    .select()
    .from(dashboardWidget)
    .where(eq(dashboardWidget.dashboardId, d.id))
    .orderBy(asc(dashboardWidget.createdAt));
  return { kind, title: d.name, charts: widgets.map(w => toPublic(chartSpec.parse(w.chart))) };
}

async function activeLink(kind: 'chat' | 'dashboard', id: string, userId: string) {
  const [row] = await db
    .select()
    .from(shareLink)
    .where(
      and(eq(shareLink.kind, kind), eq(shareLink.targetId, id), eq(shareLink.userId, userId), isNull(shareLink.revokedAt))
    );
  return row;
}

const info = (row: { token: string; updatedAt: Date }): ShareLinkInfo => ({
  token: row.token,
  updatedAt: row.updatedAt.toISOString(),
});

/** Owner-side: create, refresh, look up and revoke links. */
export const shareRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/shares', zValidator('query', target), async c => {
    const { kind, id } = c.req.valid('query');
    const row = await activeLink(kind, id, c.get('user').id);
    return c.json(row ? info(row) : null);
  })

  // Creates a link, or refreshes the snapshot of the existing one (same URL).
  .post('/shares', zValidator('json', target), async c => {
    const { kind, id } = c.req.valid('json');
    const userId = c.get('user').id;
    const snapshot = await buildSnapshot(kind, id, userId);
    if (!snapshot) return c.json({ error: 'Not found' }, 404);
    const existing = await activeLink(kind, id, userId);
    if (existing) {
      const [row] = await db
        .update(shareLink)
        .set({ snapshot, updatedAt: new Date() })
        .where(eq(shareLink.token, existing.token))
        .returning();
      return c.json(info(row));
    }
    const [row] = await db
      .insert(shareLink)
      .values({ token: randomBytes(18).toString('base64url'), userId, kind, targetId: id, snapshot })
      .returning();
    return c.json(info(row), 201);
  })

  .delete('/shares/:token', async c => {
    const [row] = await db
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.token, c.req.param('token')), eq(shareLink.userId, c.get('user').id)))
      .returning();
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  });

/** Public, no login: read a frozen snapshot by token. */
export const publicShareRoutes = new Hono().get('/public/shares/:token', async c => {
  const [row] = await db
    .select({ snapshot: shareLink.snapshot, updatedAt: shareLink.updatedAt, revokedAt: shareLink.revokedAt, name: user.name })
    .from(shareLink)
    .innerJoin(user, eq(user.id, shareLink.userId))
    .where(eq(shareLink.token, c.req.param('token')));
  if (!row || row.revokedAt) return c.json({ error: 'This link is no longer available.' }, 404);
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Robots-Tag', 'noindex');
  const body: PublicShare = {
    snapshot: row.snapshot as ShareSnapshot,
    sharedBy: row.name,
    updatedAt: row.updatedAt.toISOString(),
  };
  return c.json(body);
});
