import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, schema } from '@chatboat/db';
import { feedbackInput, type Role, type SuggestedQuestions } from '@chatboat/shared';
import { requireUser, type AppEnv } from '../context';

const ROLE_QUESTIONS: Record<Role, string[]> = {
  sales: [
    'Show me the sales data for California',
    'Who are my top 10 customers by revenue this year?',
    'Compare monthly sales by region for the last 12 months',
    'Which sales rep closed the most revenue last quarter?',
  ],
  finance: [
    'How much is overdue right now, by customer segment?',
    'What is our monthly revenue trend over the last 2 years?',
    'Average days to pay by payment method',
    'Gross margin by product category this year',
  ],
  operations: [
    'Which products are below their reorder level?',
    'Inventory on hand by warehouse',
    'Top 10 products by units sold last month',
    'Stock value by category and warehouse',
  ],
  executive: [
    'Revenue this year vs last year',
    'Revenue share by region',
    'How many new customers did we add each month?',
    'What share of invoices is overdue?',
  ],
};

export const miscRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/suggestions', async c => {
    const user = c.get('user') as { id: string; role?: string };
    const role = (user.role && user.role in ROLE_QUESTIONS ? user.role : 'sales') as Role;
    const recentRows = await db
      .select({ parts: schema.message.parts })
      .from(schema.message)
      .innerJoin(schema.chat, eq(schema.chat.id, schema.message.chatId))
      .where(and(eq(schema.chat.userId, user.id), eq(schema.message.role, 'user')))
      .orderBy(desc(schema.message.createdAt))
      .limit(30);
    const recent = [
      ...new Set(
        recentRows
          .map(r => (r.parts as { type: string; text?: string }[]).find(p => p.type === 'text')?.text?.trim())
          .filter((t): t is string => !!t)
      ),
    ].slice(0, 5);
    const body: SuggestedQuestions = { recent, roleBased: ROLE_QUESTIONS[role], role };
    return c.json(body);
  })

  .post('/feedback', zValidator('json', feedbackInput), async c => {
    const input = c.req.valid('json');
    const userId = c.get('user').id;
    // Only allow feedback on messages in the user's own chats.
    const [owned] = await db
      .select({ id: schema.message.id })
      .from(schema.message)
      .innerJoin(schema.chat, eq(schema.chat.id, schema.message.chatId))
      .where(and(eq(schema.message.id, input.messageId), eq(schema.chat.userId, userId)));
    if (!owned) return c.json({ error: 'Not found' }, 404);
    await db
      .insert(schema.feedback)
      .values({ ...input, reasons: input.reasons ?? [], userId })
      .onConflictDoUpdate({
        target: [schema.feedback.messageId, schema.feedback.userId],
        set: { rating: input.rating, reasons: input.reasons ?? [], comment: input.comment ?? null },
      });
    return c.body(null, 204);
  });
