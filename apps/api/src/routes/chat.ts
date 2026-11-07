import { zValidator } from '@hono/zod-validator';
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  toUIMessageStream,
  TypeValidationError,
  validateUIMessages,
  type UIMessage,
} from 'ai';
import { and, asc, desc, eq, ilike, sql as dsql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '@chatboat/db';
import { chartSpec, chatPatch, createChatInput, type ChatListItem } from '@chatboat/shared';
import { getModel } from '../ai/model';
import { chartContext, SYSTEM_PROMPT, userContext } from '../ai/prompt';
import { createTools } from '../ai/tools';
import { requireUser, type AppEnv } from '../context';
import { startUsage } from '../usage';
import { ownedCollection } from './collections';

const { chat, message } = schema;
const newMessageId = createIdGenerator({ prefix: 'msg', size: 16 });

async function ownedChat(chatId: string, userId: string) {
  const [row] = await db
    .select()
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
  return row;
}

async function loadMessages(chatId: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt));
  return rows.map(r => ({ id: r.id, role: r.role, parts: r.parts as UIMessage['parts'] }));
}

async function saveMessages(chatId: string, messages: UIMessage[]) {
  if (!messages.length) return;
  const base = Date.now() - messages.length;
  await db
    .insert(message)
    .values(
      messages.map((m, i) => ({
        id: m.id,
        chatId,
        role: m.role,
        parts: m.parts,
        // keep insertion order stable for messages saved in the same batch
        createdAt: new Date(base + i),
      }))
    )
    .onConflictDoUpdate({ target: message.id, set: { parts: dsql`excluded.parts` } });
  await db.update(chat).set({ updatedAt: new Date() }).where(eq(chat.id, chatId));
}

function firstText(m: UIMessage) {
  return m.parts.map(p => (p.type === 'text' ? p.text : '')).join(' ').trim();
}

export const chatRoutes = new Hono<AppEnv>()
  .use(requireUser)

  // List chats (sidebar), newest first, optional search.
  .get('/chats', zValidator('query', z.object({ q: z.string().optional() })), async c => {
    const { q } = c.req.valid('query');
    const user = c.get('user');
    const rows = await db
      .select()
      .from(chat)
      .where(and(eq(chat.userId, user.id), q ? ilike(chat.title, `%${q}%`) : undefined))
      .orderBy(desc(chat.updatedAt))
      .limit(200);
    const items: ChatListItem[] = rows.map(r => ({
      id: r.id,
      title: r.title,
      isSaved: r.isSaved,
      groupId: r.groupId,
      updatedAt: r.updatedAt.toISOString(),
    }));
    return c.json(items);
  })

  // Create an empty chat; the first question is sent by the conversation page.
  .post('/chats', zValidator('json', createChatInput), async c => {
    const { title, contextChart } = c.req.valid('json');
    const id = generateId();
    await db.insert(chat).values({
      id,
      userId: c.get('user').id,
      title: title ? title.slice(0, 80) : contextChart ? `About: ${contextChart.title}`.slice(0, 80) : 'New chat',
      context: contextChart ?? null,
    });
    return c.json({ id }, 201);
  })

  .get('/chats/:id', async c => {
    const row = await ownedChat(c.req.param('id'), c.get('user').id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json({ chat: row, messages: await loadMessages(row.id) });
  })

  .patch('/chats/:id', zValidator('json', chatPatch), async c => {
    const userId = c.get('user').id;
    const row = await ownedChat(c.req.param('id'), userId);
    if (!row) return c.json({ error: 'Not found' }, 404);
    const patch = c.req.valid('json');
    // Only allow moving into the user's own collections.
    if (patch.groupId != null && !(await ownedCollection(patch.groupId, userId))) {
      return c.json({ error: 'Collection not found' }, 404);
    }
    // Renaming or filing a chat shouldn't move it to the top of "recent".
    const [updated] = await db.update(chat).set(patch).where(eq(chat.id, row.id)).returning();
    return c.json(updated);
  })

  .delete('/chats/:id', async c => {
    const row = await ownedChat(c.req.param('id'), c.get('user').id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await db.delete(chat).where(eq(chat.id, row.id));
    return c.body(null, 204);
  })

  // Streaming AI endpoint used by useChat. Client sends only the newest message.
  .post('/chat', async c => {
    const body = (await c.req.json()) as { id?: string; message?: UIMessage };
    if (!body.id || !body.message || body.message.role !== 'user') {
      return c.json({ error: 'Expected { id, message } with a user message' }, 400);
    }
    const user = c.get('user');
    const row = await ownedChat(body.id, user.id);
    if (!row) return c.json({ error: 'Not found' }, 404);

    const tools = createTools();
    const previous = await loadMessages(row.id);
    let messages: UIMessage[];
    try {
      // On "try again" the client resends a message the server already has:
      // keep history up to that message instead of appending a duplicate.
      const existing = previous.findIndex(m => m.id === body.message!.id);
      const history = existing === -1 ? previous : previous.slice(0, existing);
      messages = await validateUIMessages({ messages: [...history, body.message], tools });
    } catch (e) {
      if (e instanceof TypeValidationError) return c.json({ error: 'Invalid message' }, 400);
      throw e;
    }

    const { model, label } = getModel();
    // Check the daily limit before saving anything, so a refused question leaves no trace.
    const usage = await startUsage(user.id, row.id, label);
    if (!usage.allowed) {
      // Plain text so the chat UI can show it as the error message.
      return c.text(
        `You've reached today's limit of ${usage.limit} questions. It resets at midnight UTC.`,
        429
      );
    }

    // Persist the user's message right away so it survives even if the model call fails.
    await saveMessages(row.id, [body.message]);
    if (row.title === 'New chat') {
      const title = firstText(body.message).slice(0, 80) || 'New chat';
      await db.update(chat).set({ title }).where(eq(chat.id, row.id));
    }

    const result = streamText({
      model,
      system: [
        SYSTEM_PROMPT,
        userContext((user as { role?: string }).role ?? 'sales'),
        ...(row.context ? [chartContext(chartSpec.parse(row.context))] : []),
      ].join('\n\n'),
      messages: await convertToModelMessages(messages, { tools }),
      tools,
      stopWhen: stepCountIs(8),
      onEnd: ({ totalUsage }) =>
        usage.finish('completed', { input: totalUsage.inputTokens, output: totalUsage.outputTokens }),
      onError: () => usage.finish('failed'),
    });
    // Keep running if the browser disconnects so the answer is still saved.
    result.consumeStream();

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        tools,
        originalMessages: messages,
        generateMessageId: newMessageId,
        onError: error => {
          console.error('[chat] stream error', error);
          return 'Sorry, something went wrong while answering. Please try again.';
        },
        onEnd: async ({ responseMessage }) => {
          // Don't store an empty answer when the model call failed before producing anything.
          const hasContent = responseMessage.parts.some(
            p => (p.type === 'text' && p.text.trim()) || p.type.startsWith('tool-')
          );
          if (hasContent) await saveMessages(row.id, [responseMessage]);
        },
      }),
    });
  });
