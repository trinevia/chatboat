import { zValidator } from '@hono/zod-validator';
import { and, asc, count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '@chatboat/db';
import type { Collection } from '@chatboat/shared';
import { requireUser, type AppEnv } from '../context';

const { chat, chatGroup } = schema;
const nameInput = z.object({ name: z.string().trim().min(1).max(60) });

export async function ownedCollection(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(chatGroup)
    .where(and(eq(chatGroup.id, id), eq(chatGroup.userId, userId)));
  return row;
}

/** Collections are folders for chats (stored in the chat_group table). */
export const collectionRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/collections', async c => {
    const rows = await db
      .select({ id: chatGroup.id, name: chatGroup.name, chatCount: count(chat.id) })
      .from(chatGroup)
      .leftJoin(chat, eq(chat.groupId, chatGroup.id))
      .where(eq(chatGroup.userId, c.get('user').id))
      .groupBy(chatGroup.id)
      .orderBy(asc(chatGroup.name));
    return c.json(rows satisfies Collection[]);
  })

  .post('/collections', zValidator('json', nameInput), async c => {
    const [row] = await db
      .insert(chatGroup)
      .values({ userId: c.get('user').id, name: c.req.valid('json').name })
      .returning();
    return c.json({ id: row.id, name: row.name, chatCount: 0 } satisfies Collection, 201);
  })

  .patch('/collections/:id', zValidator('json', nameInput), async c => {
    const row = await ownedCollection(Number(c.req.param('id')), c.get('user').id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await db.update(chatGroup).set(c.req.valid('json')).where(eq(chatGroup.id, row.id));
    return c.body(null, 204);
  })

  // Deleting a collection keeps its chats; they move back to the main list.
  .delete('/collections/:id', async c => {
    const row = await ownedCollection(Number(c.req.param('id')), c.get('user').id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await db.delete(chatGroup).where(eq(chatGroup.id, row.id));
    return c.body(null, 204);
  });
