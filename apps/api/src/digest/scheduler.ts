import { and, eq, lte } from 'drizzle-orm';
import { db, schema } from '@chatboat/db';
import { refreshInsightsIfStale } from '../insights/compute';
import { runSubscription } from './digest';
import { nextRunAt } from './schedule';

const { subscription } = schema;
const TICK_MS = 60_000;

/**
 * Claim due subscriptions and move their next_run_at forward in one transaction.
 * FOR UPDATE SKIP LOCKED means several API instances can tick at once without
 * sending the same digest twice.
 */
async function claimDue(limit = 10) {
  return db.transaction(async tx => {
    const due = await tx
      .select()
      .from(subscription)
      .where(and(eq(subscription.isActive, true), lte(subscription.nextRunAt, new Date())))
      .orderBy(subscription.nextRunAt)
      .limit(limit)
      .for('update', { skipLocked: true });
    for (const s of due) {
      await tx.update(subscription).set({ nextRunAt: nextRunAt(s) }).where(eq(subscription.id, s.id));
    }
    return due.map(s => s.id);
  });
}

async function tick() {
  try {
    const ids = await claimDue();
    for (const id of ids) await runSubscription(id, 'schedule');
    await refreshInsightsIfStale();
  } catch (e) {
    console.error('[scheduler] tick failed:', e);
  }
}

let timer: NodeJS.Timeout | undefined;

export function startScheduler() {
  if (timer || process.env.DISABLE_SCHEDULER === '1') return;
  void tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref();
  console.log('[scheduler] started (checks every minute)');
}
