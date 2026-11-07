import { and, count, eq, gte, sql as dsql, sum } from 'drizzle-orm';
import { db, schema } from '@chatboat/db';

const { aiUsage } = schema;

export const DAILY_LIMIT = Number(process.env.DAILY_QUESTION_LIMIT ?? 100);
// Prices per million tokens for cost estimates. Leave at 0 if your plan is free or flat-rate.
const PRICE_IN = Number(process.env.AI_PRICE_INPUT_PER_M ?? 0);
const PRICE_OUT = Number(process.env.AI_PRICE_OUTPUT_PER_M ?? 0);

const startOfUtcDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export function estimateCost(inputTokens: number, outputTokens: number) {
  if (!PRICE_IN && !PRICE_OUT) return null;
  return (inputTokens / 1e6) * PRICE_IN + (outputTokens / 1e6) * PRICE_OUT;
}

/**
 * Reserve one question for today, or refuse if the daily limit is used up.
 * The row is inserted up front so parallel requests can't slip past the limit.
 */
export async function startUsage(userId: string, chatId: string, model: string) {
  const [{ used }] = await db
    .select({ used: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, startOfUtcDay())));
  if (used >= DAILY_LIMIT) return { allowed: false as const, used, limit: DAILY_LIMIT };
  const [row] = await db.insert(aiUsage).values({ userId, chatId, model, status: 'started' }).returning({ id: aiUsage.id });
  const startedAt = Date.now();
  return {
    allowed: true as const,
    finish: async (status: 'completed' | 'failed', tokens?: { input?: number; output?: number }) => {
      await db
        .update(aiUsage)
        .set({
          status,
          inputTokens: tokens?.input ?? 0,
          outputTokens: tokens?.output ?? 0,
          durationMs: Date.now() - startedAt,
        })
        .where(eq(aiUsage.id, row.id));
    },
  };
}

export async function usageSummary(userId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [[today], [month], days] = await Promise.all([
    db
      .select({ used: count() })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, startOfUtcDay()))),
    db
      .select({
        questions: count(),
        failed: count(dsql`CASE WHEN ${aiUsage.status} = 'failed' THEN 1 END`),
        input: sum(aiUsage.inputTokens),
        output: sum(aiUsage.outputTokens),
        avgMs: dsql<number>`AVG(${aiUsage.durationMs})`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, monthStart))),
    db
      .select({
        day: dsql<string>`to_char(${aiUsage.createdAt}, 'YYYY-MM-DD')`,
        questions: count(),
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, dsql`now() - interval '13 days'`)))
      .groupBy(dsql`1`)
      .orderBy(dsql`1`),
  ]);
  const input = Number(month.input ?? 0);
  const output = Number(month.output ?? 0);
  return {
    today: { used: today.used, limit: DAILY_LIMIT },
    month: {
      questions: month.questions,
      failed: month.failed,
      inputTokens: input,
      outputTokens: output,
      avgSeconds: month.avgMs ? Math.round(Number(month.avgMs) / 100) / 10 : null,
      estimatedCost: estimateCost(input, output),
    },
    days,
  };
}
